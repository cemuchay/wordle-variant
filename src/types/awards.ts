export type AwardType = 'weekly_champion' | 'monthly_champion' | 'bot_marathon_weekly';

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
};
