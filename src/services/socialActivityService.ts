/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '../lib/supabaseClient';
import { logger } from '../lib/logger';

export type ActivityCategory = 'daily_game' | 'wordup' | 'marathon' | 'achievement' | 'social';

export type ActivityType =
  | 'game_started'
  | 'guess_submitted'
  | 'hint_used'
  | 'game_won'
  | 'game_lost'
  | 'guess_comment_posted'
  | 'guess_reaction_posted'
  | 'streak_milestone'
  | 'award_unlocked'
  | string;

export interface SocialActivityItem {
  id: string;
  user_id: string;
  username?: string;
  avatar_url?: string;
  game_date: string;
  category: ActivityCategory;
  activity_type: ActivityType;
  guess_index?: number | null;
  payload: Record<string, any>;
  metadata?: Record<string, any>;
  reactions_count?: Record<string, number>;
  comments_count?: number;
  created_at: string;
}

export interface SocialActivityPayload {
  userId: string;
  gameDate: string;
  category?: ActivityCategory;
  activityType: ActivityType;
  guessIndex?: number | null;
  payload: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * Inserts or updates a social activity event.
 */
export async function recordSocialActivity({
  userId,
  gameDate,
  category = 'daily_game',
  activityType,
  guessIndex = null,
  payload,
  metadata = {},
}: SocialActivityPayload): Promise<boolean> {
  if (!userId || !gameDate) return false;

  try {
    const { error } = await supabase.from('social_activities').upsert(
      {
        user_id: userId,
        game_date: gameDate,
        category,
        activity_type: activityType,
        guess_index: guessIndex,
        payload,
        metadata,
        created_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,game_date,activity_type,guess_index',
      }
    );

    if (error) {
      logger.warn('[socialActivityService] Error upserting social activity:', error.message);
      return false;
    }

    // Broadcast update across clients
    try {
      const feedChannel = supabase.channel('global_feed_activities_broadcast');
      feedChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          feedChannel.send({
            type: 'broadcast',
            event: 'activity_recorded',
            payload: { userId, gameDate, activityType, guessIndex },
          });
          setTimeout(() => supabase.removeChannel(feedChannel), 1000);
        }
      });
    } catch (e) {
      logger.warn('[socialActivityService] Broadcast error:', e);
    }

    return true;
  } catch (err: any) {
    logger.warn('[socialActivityService] Unexpected exception recording activity:', err?.message || err);
    return false;
  }
}

/**
 * Fetches chronological social activities (both daily_game & social comments/reactions) for a specific date.
 */
export async function fetchSocialActivities(
  gameDate: string,
  category?: ActivityCategory,
  limit = 80
): Promise<SocialActivityItem[]> {
  if (!gameDate) return [];

  try {
    let query = supabase
      .from('social_activities')
      .select('*')
      .eq('game_date', gameDate)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (category) {
      query = query.eq('category', category);
    }

    const { data: activities, error } = await query;

    if (error) {
      logger.warn('[socialActivityService] Fetch error:', error.message);
      return [];
    }

    if (!activities || activities.length === 0) {
      return [];
    }

    // Collect profile data and real scores for unique users
    const userIds = Array.from(
      new Set(
        activities.flatMap((a) => [a.user_id, a.payload?.target_user_id]).filter(Boolean)
      )
    );

    const [profilesRes, scoresRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', userIds),
      supabase
        .from('scores')
        .select('user_id, skill_score, attempts, status')
        .eq('game_date', gameDate)
        .in('user_id', userIds),
    ]);

    const profileMap = new Map(profilesRes.data?.map((p) => [p.id, p]));
    const scoreMap = new Map(scoresRes.data?.map((s) => [s.user_id, s]));

    return activities.map((item) => {
      const profile = profileMap.get(item.user_id);
      const targetProfile = item.payload?.target_user_id
        ? profileMap.get(item.payload.target_user_id)
        : null;
      const userScore = scoreMap.get(item.user_id);

      // Extract accurate score directly from scores table if available
      const dbScore = userScore ? userScore.skill_score : null;

      return {
        ...item,
        username: profile?.username || 'Player',
        avatar_url: profile?.avatar_url || '',
        payload: {
          ...item.payload,
          total_score: dbScore !== null && dbScore !== undefined ? dbScore : (item.payload?.total_score ?? item.payload?.skill_score ?? 0),
          skill_score: dbScore !== null && dbScore !== undefined ? dbScore : (item.payload?.skill_score ?? item.payload?.total_score ?? 0),
          target_username: targetProfile?.username || item.payload?.target_username || 'Player',
        },
      };
    });
  } catch (err: any) {
    logger.warn('[socialActivityService] Failed to load activities:', err?.message || err);
    return [];
  }
}

/**
 * Updates a user's own activity content (e.g. edited comment content in newsfeed item).
 */
export async function updateSocialActivity(
  activityId: string,
  updatedPayload: Record<string, any>
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('social_activities')
      .update({
        payload: updatedPayload,
      })
      .eq('id', activityId);

    if (error) throw error;
    return true;
  } catch (e) {
    logger.warn('[socialActivityService] Update activity failed:', e);
    return false;
  }
}

/**
 * Deletes a social activity item (Full CRUD deletion).
 */
export async function deleteSocialActivity(activityId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('social_activities')
      .delete()
      .eq('id', activityId);

    if (error) throw error;
    return true;
  } catch (e) {
    logger.warn('[socialActivityService] Delete activity failed:', e);
    return false;
  }
}
