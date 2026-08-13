export type AwardType =
  | 'weekly_champion'
  | 'monthly_champion'
  | 'bot_marathon_weekly'
  | 'streak_50'
  | 'streak_100'
  | 'streak_250'
  | 'streak_365'
  | 'streak_500'
  | 'streak_1000';

export interface UserAward {
  id: string;
  user_id: string;
  award_type: AwardType;
  period_key: string;
  score: number;
  awarded_at: string;
}

export interface ReigningBadgeInfo {
  is_reigning_weekly: boolean;
  is_reigning_bot_marathon: boolean;
}

export const AWARD_LABELS: Record<AwardType, { label: string; icon: string }> = {
  weekly_champion: { label: 'Weekly Champion', icon: 'crown' },
  monthly_champion: { label: 'Monthly Dominator', icon: 'trophy' },
  bot_marathon_weekly: { label: 'Bot Marathon Champion', icon: 'bot' },
  streak_50: { label: '50-Day Streak', icon: 'flame' },
  streak_100: { label: '100-Day Streak', icon: 'flame' },
  streak_250: { label: '250-Day Streak', icon: 'flame' },
  streak_365: { label: '365-Day Streak (1 Year)', icon: 'flame' },
  streak_500: { label: '500-Day Streak', icon: 'flame' },
  streak_1000: { label: '1000-Day Streak Legend', icon: 'flame' },
};
