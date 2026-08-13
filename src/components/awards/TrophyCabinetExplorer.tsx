import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Trophy, Award, Crown, Zap, ChevronLeft, ChevronRight, Flame } from 'lucide-react'
import type { UserAward } from '../../types/awards'
import { isCurrentPeriod, formatAwardPeriod } from '../../utils/isoWeek'

interface TrophyCabinetStats {
   dailyWins: number
   weeklyWins: number
   monthlyWins: number
   currentStreak?: number
   maxStreak?: number
}

interface TrophyCabinetExplorerProps {
   stats: TrophyCabinetStats
   awards: UserAward[]
   username: string
   onClose: () => void
}

interface ExhibitItem {
   id: string
   type: 'counter' | 'award'
   awardType?: string
   icon: typeof Trophy
   label: string
   subtitle: string
   score?: number
   color: string
   gradient: string
}

const counterExhibits = [
   {
      key: 'daily',
      label: 'Daily Champion',
      icon: Award,
      subtitle: 'Best daily score wins',
      color: 'text-amber-400',
      gradient: 'from-amber-500/20 via-yellow-500/10 to-transparent',
   },
   {
      key: 'weekly',
      label: 'Weekly Master',
      icon: Trophy,
      subtitle: 'Top weekly performer',
      color: 'text-blue-400',
      gradient: 'from-blue-500/20 via-sky-500/10 to-transparent',
   },
   {
      key: 'monthly',
      label: 'Monthly Dominator',
      icon: Trophy,
      subtitle: 'Monthly leaderboard topper',
      color: 'text-purple-400',
      gradient: 'from-purple-500/20 via-violet-500/10 to-transparent',
   },
]

export const TrophyCabinetExplorer = ({ stats, awards, username, onClose }: TrophyCabinetExplorerProps) => {
   const completed = useMemo(
      () => awards.filter(a => !isCurrentPeriod(a.award_type, a.period_key)),
      [awards],
   )

   const exhibits: ExhibitItem[] = useMemo(() => {
      const items: ExhibitItem[] = []

      counterExhibits.forEach(c => {
         const count = stats[c.key as keyof TrophyCabinetStats] as number
         if (count > 0) {
            items.push({
               id: `counter-${c.key}`,
               type: 'counter',
               icon: c.icon,
               label: c.label,
               subtitle: `${count} ${count === 1 ? 'win' : 'wins'} • ${c.subtitle}`,
               color: c.color,
               gradient: c.gradient,
            })
         }
      })

      completed.forEach(a => {
         const isWeekly = a.award_type === 'weekly_champion';
         const isBot = a.award_type === 'bot_marathon_weekly';
         const isStreak = a.award_type.startsWith('streak_');

         let icon = Trophy;
         let label = 'Monthly Dominator';
         let color = 'text-purple-400';
         let gradient = 'from-purple-500/20 via-violet-500/10 to-transparent';
         let subtitle = formatAwardPeriod(a.award_type, a.period_key);

         if (isWeekly) {
            icon = Crown;
            label = 'Weekly Champion';
            color = 'text-amber-400';
            gradient = 'from-amber-500/20 via-yellow-500/10 to-transparent';
         } else if (isBot) {
            icon = Zap;
            label = 'Bot Marathon Champion';
            color = 'text-emerald-400';
            gradient = 'from-emerald-500/20 via-green-500/10 to-transparent';
         } else if (isStreak) {
            icon = Flame;
            label = a.score === 365 ? '365-Day Streak (1 Year)' : `${a.score}-Day Streak Milestone`;
            color = 'text-amber-400';
            gradient = 'from-amber-500/25 via-orange-500/15 to-transparent';
            const dateStr = a.awarded_at ? new Date(a.awarded_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';
            subtitle = dateStr ? `Achieved ${dateStr}` : 'Streak Milestone Unlocked';
         }

         items.push({
            id: a.id,
            type: 'award',
            awardType: a.award_type,
            icon,
            label,
            subtitle,
            score: a.score,
            color,
            gradient,
         });
      });

      return items
   }, [stats, completed])

   const [currentIndex, setCurrentIndex] = useState(0)
   const current = exhibits[currentIndex]

   if (exhibits.length === 0) {
      return (
         <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex items-center justify-center p-6">
            <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-white/5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-all cursor-pointer z-10">
               <X size={20} />
            </button>
            <div className="text-center space-y-4">
               <Trophy size={48} className="text-gray-600 mx-auto" />
               <h2 className="text-xl font-black uppercase tracking-wider text-white">Empty Cabinet</h2>
               <p className="text-xs text-gray-500 max-w-xs">No trophies yet. Play daily puzzles and climb the leaderboard to earn awards!</p>
            </div>
         </div>
      )
   }

   return (
      <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'radial-gradient(ellipse at center, #0f0f1a 0%, #000000 100%)' }}>
         {/* Header */}
         <div className="flex items-center justify-between p-4 sm:p-6 z-10">
            <div className="flex items-center gap-3">
               <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                  <Trophy size={16} className="text-amber-400" />
               </div>
               <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-white">Trophy Cabinet</h2>
                  <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">@{username} · {exhibits.length} {exhibits.length === 1 ? 'award' : 'awards'}</p>
               </div>
            </div>
            <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full border border-white/5 text-gray-400 hover:text-white transition-all cursor-pointer">
               <X size={18} />
            </button>
         </div>

         {/* Carousel */}
         <div className="flex-1 flex items-center justify-center px-4 sm:px-8 overflow-hidden">
            <AnimatePresence mode="wait">
               <motion.div
                  key={current.id}
                  initial={{ opacity: 0, scale: 0.85, rotateY: 10 }}
                  animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                  exit={{ opacity: 0, scale: 0.85, rotateY: -10 }}
                  transition={{ duration: 0.35 }}
                  className="w-full max-w-sm"
               >
                  <div
                     className="relative rounded-3xl border border-white/10 overflow-hidden shadow-2xl"
                     style={{
                        background: `linear-gradient(180deg, ${current.gradient.split(' ')[0].replace('from-', '').replace('/20', '')}22, #0a0a0f 100%)`,
                        boxShadow: `0 25px 50px -12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)`,
                     }}
                  >
                     {/* Glow orb */}
                     <div
                        className="absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl pointer-events-none opacity-30"
                        style={{
                           background: current.color.includes('amber')
                              ? 'radial-gradient(circle, #f59e0b, transparent)'
                              : current.color.includes('emerald')
                                 ? 'radial-gradient(circle, #10b981, transparent)'
                                 : current.color.includes('blue')
                                    ? 'radial-gradient(circle, #3b82f6, transparent)'
                                    : 'radial-gradient(circle, #a855f7, transparent)',
                        }}
                     />

                     <div className="p-8 sm:p-10 text-center space-y-6">
                        {/* Icon */}
                        <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full border border-white/10 bg-white/5 ${current.color}`}>
                           <current.icon size={40} className="sm:w-12 sm:h-12" />
                        </div>

                        {/* Label */}
                        <div className="space-y-2">
                           <h3 className={`text-xl sm:text-2xl font-black uppercase tracking-wider ${current.color}`}>
                              {current.label}
                           </h3>
                           <p className="text-sm text-gray-400 font-semibold">{current.subtitle}</p>
                        </div>

                        {/* Score for awards */}
                        {current.type === 'award' && current.score !== undefined && (
                           <div className="inline-block px-5 py-2 bg-white/5 border border-white/10 rounded-2xl">
                              <span className="text-2xl font-black text-white">{current.score}</span>
                              <span className="text-[10px] text-gray-500 uppercase ml-2 font-bold">points</span>
                           </div>
                        )}

                        {/* shimmer line */}
                        <div className="w-16 h-[2px] mx-auto rounded-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                     </div>
                  </div>
               </motion.div>
            </AnimatePresence>
         </div>

         {/* Navigation */}
         <div className="flex items-center justify-between p-4 sm:p-6 z-10">
            <button
               onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
               disabled={currentIndex === 0}
               className="p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-full text-gray-400 hover:text-white disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer"
            >
               <ChevronLeft size={18} />
            </button>

            <div className="flex gap-1.5">
               {exhibits.map((_, i) => (
                  <button
                     key={i}
                     onClick={() => setCurrentIndex(i)}
                     className={`w-2 h-2 rounded-full transition-all duration-300 cursor-pointer ${i === currentIndex ? 'bg-amber-400 w-5' : 'bg-white/20 hover:bg-white/40'}`}
                  />
               ))}
            </div>

            <button
               onClick={() => setCurrentIndex(i => Math.min(exhibits.length - 1, i + 1))}
               disabled={currentIndex === exhibits.length - 1}
               className="p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-full text-gray-400 hover:text-white disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer"
            >
               <ChevronRight size={18} />
            </button>
         </div>
      </div>
   )
}
