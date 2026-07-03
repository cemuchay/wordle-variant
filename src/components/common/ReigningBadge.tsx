import { Crown, Bot } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { getPreviousIsoWeekKey } from '../../utils/isoWeek';

interface ReigningBadgeProps {
  userId: string;
  type: 'weekly' | 'bot_marathon';
  className?: string;
}

function useReigningBadges(userId: string | undefined) {
  return useQuery({
    queryKey: ['reigning-badges', userId],
    queryFn: async () => {
      if (!userId) return { isReigningWeekly: false, isReigningBotMarathon: false };
      const prevWeek = getPreviousIsoWeekKey();
      const { data } = await supabase
        .from('user_awards')
        .select('award_type')
        .eq('user_id', userId)
        .eq('period_key', prevWeek)
        .in('award_type', ['weekly_champion', 'bot_marathon_weekly']);
      return {
        isReigningWeekly: data?.some(a => a.award_type === 'weekly_champion') ?? false,
        isReigningBotMarathon: data?.some(a => a.award_type === 'bot_marathon_weekly') ?? false,
      };
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!userId,
  });
}

export const ReigningBadge: React.FC<ReigningBadgeProps> = ({ userId, type, className = '' }) => {
  const { data } = useReigningBadges(userId);

  const isReigning = type === 'weekly' ? data?.isReigningWeekly : data?.isReigningBotMarathon;

  if (!isReigning) return null;

  const Icon = type === 'weekly' ? Crown : Bot;
  const tooltip = type === 'weekly'
    ? 'Reigning Weekly Champion'
    : 'Reigning Bot Marathon Champion';
  const glowColor = type === 'weekly' ? 'shadow-yellow-500/40' : 'shadow-purple-500/40';
  const iconColor = type === 'weekly' ? 'text-yellow-400' : 'text-purple-400';

  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      title={tooltip}
    >
      <Icon
        size={10}
        className={`${iconColor} drop-shadow-[0_0_3px_var(--tw-shadow-color)] ${glowColor}`}
        style={{ filter: `drop-shadow(0 0 2px currentColor)` }}
      />
    </span>
  );
};
