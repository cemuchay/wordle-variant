import { Trophy, Award, Crown, Zap, Sparkles } from 'lucide-react'
import type { UserAward } from '../../types/awards'
import { isCurrentPeriod, formatAwardPeriod } from '../../utils/isoWeek'

interface TrophyCabinetStats {
   dailyWins: number
   weeklyWins: number
   monthlyWins: number
}

interface TrophyCabinetProps {
   stats: TrophyCabinetStats
   awards: UserAward[]
   onExplore: () => void
}

const counterTrophies = [
   {
      key: 'daily',
      label: 'Daily Champion',
      icon: Award,
      count: (s: TrophyCabinetStats) => s.dailyWins,
      gradient: 'from-amber-500/20 to-yellow-500/5',
      border: 'border-amber-500/30',
      glow: 'shadow-amber-500/20',
      iconColor: 'text-amber-400',
   },
   {
      key: 'weekly',
      label: 'Weekly Master',
      icon: Trophy,
      count: (s: TrophyCabinetStats) => s.weeklyWins,
      gradient: 'from-blue-500/20 to-sky-500/5',
      border: 'border-blue-500/30',
      glow: 'shadow-blue-500/20',
      iconColor: 'text-blue-400',
   },
   {
      key: 'monthly',
      label: 'Monthly Dominator',
      icon: Trophy,
      count: (s: TrophyCabinetStats) => s.monthlyWins,
      gradient: 'from-purple-500/20 to-violet-500/5',
      border: 'border-purple-500/30',
      glow: 'shadow-purple-500/20',
      iconColor: 'text-purple-400',
   },
]

const completedAwards = (awards: UserAward[]) =>
   awards.filter(a => !isCurrentPeriod(a.award_type, a.period_key))

export const TrophyCabinet = ({ stats, awards, onExplore }: TrophyCabinetProps) => {
   const displayAwards = completedAwards(awards)
   const hasAnyAwards = stats.dailyWins > 0 || stats.weeklyWins > 0 || stats.monthlyWins > 0 || displayAwards.length > 0

   return (
      <div className="space-y-4">
         <div className="flex items-center justify-between">
            <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
               <Sparkles size={14} className="text-amber-400" />
               Trophy Cabinet
               {displayAwards.length > 0 && (
                  <span className="text-[9px] text-amber-400/60 font-bold">({displayAwards.length})</span>
               )}
            </h3>
            {hasAnyAwards && (
               <button
                  onClick={onExplore}
                  className="text-[9px] font-black uppercase tracking-widest text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 rounded-xl border border-amber-500/20 transition-all cursor-pointer"
               >
                  Explore Cabinet
               </button>
            )}
         </div>

         <div className="relative" style={{ perspective: '800px' }}>
            <div
               className="space-y-3"
               style={{ transform: 'rotateX(4deg)', transformStyle: 'preserve-3d' }}
            >
               {/* Shelf 1: Counter Trophies */}
               <div className="grid grid-cols-3 gap-2 sm:gap-3" style={{ transform: 'translateZ(20px)' }}>
                  {counterTrophies.map(t => {
                     const count = t.count(stats)
                     const Icon = t.icon
                     return (
                        <div
                           key={t.key}
                           className={`relative rounded-2xl p-3 sm:p-4 border text-center flex flex-col items-center justify-center overflow-hidden transition-all duration-300 bg-linear-to-b ${t.gradient} ${t.border} ${t.glow} ${count === 0 ? 'opacity-40' : 'shadow-lg'}`}
                        >
                           <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 blur-3xl -mr-8 -mt-8 pointer-events-none rounded-full" />
                           <div
                              className={`${count > 0 ? t.iconColor : 'text-gray-600'} transition-transform duration-500`}
                              style={{ animation: count > 0 ? 'trophy-float 3s ease-in-out infinite' : undefined }}
                           >
                              <Icon size={28} className="sm:w-8 sm:h-8" />
                           </div>
                           <div className="text-lg sm:text-xl font-black text-white mt-1.5">{count}</div>
                           <div className="text-[7px] sm:text-[8px] font-black uppercase text-gray-400 tracking-wider text-ellipsis overflow-hidden whitespace-nowrap w-full mt-0.5">
                              {t.label}
                           </div>
                           {count > 0 && (
                              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-current to-transparent opacity-20" />
                           )}
                        </div>
                     )
                  })}
               </div>

               {/* Shelf 2: Weekly Champion Awards */}
               {displayAwards.filter(a => a.award_type === 'weekly_champion').length > 0 && (
                  <div className="bg-white/[0.02] rounded-2xl border border-white/5 p-3 space-y-2" style={{ transform: 'translateZ(10px)' }}>
                     <h4 className="text-[9px] font-black uppercase tracking-widest text-blue-400/60 flex items-center gap-1.5">
                        <Crown size={12} className="text-amber-400" />
                        Weekly Champion
                     </h4>
                     <div className="flex flex-wrap gap-2">
                        {displayAwards.filter(a => a.award_type === 'weekly_champion').map(a => (
                           <div
                              key={a.id}
                              className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2 text-[11px]"
                           >
                              <Crown size={14} className="text-amber-400 shrink-0" />
                              <span className="text-blue-200 font-semibold">{formatAwardPeriod(a.award_type, a.period_key)}</span>
                              <span className="text-[10px] text-blue-300/60 font-bold ml-auto">{a.score} pts</span>
                           </div>
                        ))}
                     </div>
                  </div>
               )}

               {/* Shelf 3: Bot Marathon Awards */}
               {displayAwards.filter(a => a.award_type === 'bot_marathon_weekly').length > 0 && (
                  <div className="bg-white/[0.02] rounded-2xl border border-white/5 p-3 space-y-2" style={{ transform: 'translateZ(5px)' }}>
                     <h4 className="text-[9px] font-black uppercase tracking-widest text-emerald-400/60 flex items-center gap-1.5">
                        <Zap size={12} className="text-emerald-400" />
                        Bot Marathon Champion
                     </h4>
                     <div className="flex flex-wrap gap-2">
                        {displayAwards.filter(a => a.award_type === 'bot_marathon_weekly').map(a => (
                           <div
                              key={a.id}
                              className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2 text-[11px]"
                           >
                              <Zap size={14} className="text-emerald-400 shrink-0" />
                              <span className="text-emerald-200 font-semibold">{formatAwardPeriod(a.award_type, a.period_key)}</span>
                              <span className="text-[10px] text-emerald-300/60 font-bold ml-auto">{a.score} pts</span>
                           </div>
                        ))}
                     </div>
                  </div>
               )}

               {/* Empty state */}
               {!hasAnyAwards && (
                  <div className="text-center py-8 text-gray-500 text-xs font-bold uppercase tracking-wider bg-white/[0.02] rounded-2xl border border-white/5 border-dashed">
                     No awards yet. Keep playing to earn trophies!
                  </div>
               )}
            </div>
         </div>

         <style>{`
            @keyframes trophy-float {
               0%, 100% { transform: translateY(0px); }
               50% { transform: translateY(-4px); }
            }
         `}</style>
      </div>
   )
}
