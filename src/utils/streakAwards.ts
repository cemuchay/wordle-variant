import { supabase } from '../lib/supabaseClient';
import type { AwardType } from '../types/awards';
import { safeLocalStorage } from './storage';

const MILESTONES: Array<{ value: number; type: AwardType }> = [
  { value: 50, type: 'streak_50' },
  { value: 100, type: 'streak_100' },
  { value: 250, type: 'streak_250' },
  { value: 365, type: 'streak_365' },
  { value: 500, type: 'streak_500' },
  { value: 1000, type: 'streak_1000' },
];

/**
 * Checks if a user's streak reaches a milestone (50, 100, 250, 365, 500, 1000),
 * grants the permanent milestone award in user_awards table, and triggers celebratory modal event.
 */
export async function checkAndGrantStreakMilestoneOnWin(
  userId: string,
  currentStreak: number,
  gameDate?: string
) {
  if (!userId || currentStreak < 50) return;

  const exactMilestone = MILESTONES.find((m) => m.value === currentStreak);
  const achievedMilestones = MILESTONES.filter((m) => currentStreak >= m.value);
  if (achievedMilestones.length === 0) return;

  try {
    const awardedAt = gameDate ? `${gameDate}T12:00:00.000Z` : new Date().toISOString();

    for (const milestone of achievedMilestones) {
      await supabase.from('user_awards').upsert(
        {
          user_id: userId,
          award_type: milestone.type,
          period_key: milestone.type,
          score: milestone.value,
          awarded_at: awardedAt,
        },
        { onConflict: 'user_id,award_type,period_key', ignoreDuplicates: true }
      );
    }

    // Trigger celebratory popup when hitting exact milestone after gameplay
    if (exactMilestone) {
      const storageKey = `streak_milestone_celebrated_${userId}_${exactMilestone.value}`;
      const alreadyCelebrated = safeLocalStorage.getItem(storageKey);

      if (!alreadyCelebrated) {
        safeLocalStorage.setItem(storageKey, 'true');
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent('streak-milestone-unlocked', {
              detail: {
                milestone: exactMilestone.value,
                type: exactMilestone.type,
              },
            })
          );
        }, 600); // short delay after game over screen
      }
    }
  } catch (e) {
    console.error('Failed to grant streak milestone award:', e);
  }
}
