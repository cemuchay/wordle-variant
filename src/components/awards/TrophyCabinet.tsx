import { Trophy, Award, Crown, Zap, Sparkles, Flame, BookOpen, Layers } from 'lucide-react'
import type { UserAward } from '../../types/awards'
import { isCurrentPeriod, formatAwardPeriod } from '../../utils/isoWeek'

interface TrophyCabinetStats {
   dailyWins: number
   weeklyWins: number
   monthlyWins: number
   currentStreak?: number
   maxStreak?: number
}

interface TrophyCabinetProps {
   stats: TrophyCabinetStats
   awards: UserAward[]
   onExplore: () => void
}

const completedAwards = (awards: UserAward[]) =>
   awards.filter(a => !isCurrentPeriod(a.award_type, a.period_key))

export const TrophyCabinet = ({ stats, awards, onExplore }: TrophyCabinetProps) => {
   const displayAwards = completedAwards(awards)
   const weeklyAwards = displayAwards.filter(a => a.award_type === 'weekly_champion')
   const botAwards = displayAwards.filter(a => a.award_type === 'bot_marathon_weekly')
   const streakAwards = displayAwards.filter(a => a.award_type.startsWith('streak_'))

   const hasAnyAwards =
      stats.dailyWins > 0 ||
      stats.weeklyWins > 0 ||
      stats.monthlyWins > 0 ||
      displayAwards.length > 0

   return (
      <div className="space-y-3 sm:space-y-4">
         {/* Cabinet Header */}
         <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
               <div className="w-6 h-6 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <BookOpen size={13} />
               </div>
               <div>
                  <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-amber-300 flex items-center gap-1.5">
                     Grand Library Archives
                     {displayAwards.length > 0 && (
                        <span className="text-[9px] text-amber-400/60 font-bold">
                           ({displayAwards.length} volumes)
                        </span>
                     )}
                  </h3>
               </div>
            </div>

            {hasAnyAwards && (
               <button
                  onClick={onExplore}
                  className="group flex items-center gap-1.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-amber-400 hover:text-amber-200 bg-gradient-to-r from-amber-500/15 via-amber-500/20 to-yellow-500/15 hover:from-amber-500/25 hover:to-yellow-500/25 px-3 py-1.5 rounded-xl border border-amber-500/30 hover:border-amber-400/50 transition-all shadow-md shadow-amber-950/40 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
               >
                  <Layers size={13} className="text-amber-400 group-hover:rotate-12 transition-transform duration-300" />
                  <span>3D Library Rack</span>
               </button>
            )}
         </div>

         {/* 3D Isometric Bookcase / Library Rack Frame */}
         <div className="relative rounded-2xl bg-gradient-to-b from-[#1c140e] via-[#120d09] to-[#0a0705] p-3 sm:p-4 border border-[#3e2716]/60 shadow-[inset_0_2px_12px_rgba(0,0,0,0.8),0_10px_30px_rgba(0,0,0,0.6)] overflow-hidden">
            {/* Ambient Wood Lighting Glow */}
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-64 h-24 bg-amber-500/10 blur-3xl pointer-events-none rounded-full" />

            <div className="space-y-4 sm:space-y-5">
               {/* ---------------- SHELF ROW 1: MASTER TOMES ---------------- */}
               <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-[#b8956c]">
                     <span className="flex items-center gap-1.5">
                        <Sparkles size={11} className="text-amber-400" />
                        Championship Tomes
                     </span>
                     <span className="text-[7px] text-[#7d5f3e] uppercase font-bold">Shelf I</span>
                  </div>

                  {/* Books Array on Shelf */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-3 items-end pt-2 pb-1">
                     {/* Daily Champion Book */}
                     <div
                        onClick={onExplore}
                        className={`group relative flex flex-col items-center justify-between h-28 sm:h-32 rounded-lg p-2 transition-all duration-300 border cursor-pointer select-none ${
                           stats.dailyWins > 0
                              ? 'bg-gradient-to-r from-[#2c1b10] via-[#422917] to-[#2c1b10] border-[#8a5d3b]/60 shadow-[3px_6px_15px_rgba(0,0,0,0.6)] hover:-translate-y-1 hover:border-amber-400/80 hover:shadow-amber-500/20'
                              : 'bg-[#15100c]/60 border-white/5 opacity-40'
                        }`}
                     >
                        {/* Book Spine Texture Ribbon */}
                        <div className="absolute left-1 top-0 bottom-0 w-1 bg-black/40 rounded-l" />
                        <div className="absolute top-0 right-3 w-1.5 h-3 bg-amber-400/80 rounded-b shadow" />
                        
                        <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 mt-1 shadow-inner">
                           <Award size={15} />
                        </div>

                        <div className="text-center my-auto">
                           <span className="block text-base sm:text-lg font-black text-amber-200 leading-tight">
                              {stats.dailyWins}
                           </span>
                           <span className="block text-[7px] font-extrabold uppercase tracking-tight text-[#d4af82]">
                              Daily Wins
                           </span>
                        </div>

                        <span className="text-[6px] sm:text-[7px] font-black uppercase text-[#8f6d4d] tracking-widest truncate w-full text-center">
                           Vol. I Daily
                        </span>
                     </div>

                     {/* Weekly Master Book */}
                     <div
                        onClick={onExplore}
                        className={`group relative flex flex-col items-center justify-between h-30 sm:h-34 rounded-lg p-2 transition-all duration-300 border cursor-pointer select-none ${
                           stats.weeklyWins > 0
                              ? 'bg-gradient-to-r from-[#0d1f38] via-[#142f54] to-[#0d1f38] border-[#3b6ea8]/60 shadow-[3px_6px_15px_rgba(0,0,0,0.6)] hover:-translate-y-1 hover:border-blue-400/80 hover:shadow-blue-500/20'
                              : 'bg-[#0d131c]/60 border-white/5 opacity-40'
                        }`}
                     >
                        <div className="absolute left-1 top-0 bottom-0 w-1 bg-black/40 rounded-l" />
                        <div className="absolute top-0 right-3 w-1.5 h-3.5 bg-blue-400/80 rounded-b shadow" />

                        <div className="w-7 h-7 rounded-full bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-300 mt-1 shadow-inner">
                           <Crown size={15} />
                        </div>

                        <div className="text-center my-auto">
                           <span className="block text-base sm:text-lg font-black text-blue-200 leading-tight">
                              {stats.weeklyWins}
                           </span>
                           <span className="block text-[7px] font-extrabold uppercase tracking-tight text-[#9ec4f5]">
                              Weekly Wins
                           </span>
                        </div>

                        <span className="text-[6px] sm:text-[7px] font-black uppercase text-[#5a87be] tracking-widest truncate w-full text-center">
                           Vol. II Master
                        </span>
                     </div>

                     {/* Monthly Dominator Book */}
                     <div
                        onClick={onExplore}
                        className={`group relative flex flex-col items-center justify-between h-32 sm:h-36 rounded-lg p-2 transition-all duration-300 border cursor-pointer select-none ${
                           stats.monthlyWins > 0
                              ? 'bg-gradient-to-r from-[#241133] via-[#3a1a54] to-[#241133] border-[#7d3ba8]/60 shadow-[3px_6px_15px_rgba(0,0,0,0.6)] hover:-translate-y-1 hover:border-purple-400/80 hover:shadow-purple-500/20'
                              : 'bg-[#140c1c]/60 border-white/5 opacity-40'
                        }`}
                     >
                        <div className="absolute left-1 top-0 bottom-0 w-1 bg-black/40 rounded-l" />
                        <div className="absolute top-0 right-3 w-1.5 h-4 bg-purple-400/80 rounded-b shadow" />

                        <div className="w-7 h-7 rounded-full bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300 mt-1 shadow-inner">
                           <Trophy size={15} />
                        </div>

                        <div className="text-center my-auto">
                           <span className="block text-base sm:text-lg font-black text-purple-200 leading-tight">
                              {stats.monthlyWins}
                           </span>
                           <span className="block text-[7px] font-extrabold uppercase tracking-tight text-[#d39ef5]">
                              Monthly Wins
                           </span>
                        </div>

                        <span className="text-[6px] sm:text-[7px] font-black uppercase text-[#925bbe] tracking-widest truncate w-full text-center">
                           Vol. III Dominator
                        </span>
                     </div>
                  </div>

                  {/* Shelf Plank 1 */}
                  <div className="h-2.5 rounded-sm bg-gradient-to-r from-[#3e2515] via-[#5c371e] to-[#3e2515] border-t border-[#8c5630]/60 shadow-[0_4px_8px_rgba(0,0,0,0.8),inset_0_1px_2px_rgba(255,255,255,0.1)] relative">
                     <div className="absolute inset-x-0 bottom-0 h-[1px] bg-black/60" />
                  </div>
               </div>

               {/* ---------------- SHELF ROW 2: EARNED CHRONICLES ---------------- */}
               {(weeklyAwards.length > 0 || botAwards.length > 0 || streakAwards.length > 0) && (
                  <div className="space-y-1.5 pt-1">
                     <div className="flex items-center justify-between text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-[#b8956c]">
                        <span className="flex items-center gap-1.5">
                           <BookOpen size={11} className="text-amber-400" />
                           Award Chronicles & Milestones
                        </span>
                        <span className="text-[7px] text-[#7d5f3e] uppercase font-bold">Shelf II</span>
                     </div>

                     {/* Horizontal Scroll Rack of Award Spines */}
                     <div className="flex gap-2 overflow-x-auto pb-2 pt-1 scrollbar-thin scrollbar-thumb-amber-900/40">
                        {/* Weekly Champion Volumes */}
                        {weeklyAwards.map(a => (
                           <div
                              key={a.id}
                              onClick={onExplore}
                              className="group relative shrink-0 w-16 sm:w-20 h-24 sm:h-28 rounded-md bg-gradient-to-r from-[#112440] via-[#1a3863] to-[#112440] border border-blue-400/40 p-1.5 flex flex-col justify-between hover:-translate-y-1 transition-all duration-300 shadow-[2px_4px_10px_rgba(0,0,0,0.5)] cursor-pointer select-none"
                           >
                              <div className="absolute left-1 top-0 bottom-0 w-0.5 bg-black/40" />
                              <div className="flex justify-between items-start">
                                 <Crown size={11} className="text-amber-400" />
                                 <span className="text-[7px] font-black text-blue-300">{a.score}</span>
                              </div>
                              <div className="my-auto text-center px-0.5">
                                 <p className="text-[7px] font-black text-blue-100 line-clamp-2 leading-tight">
                                    {formatAwardPeriod(a.award_type, a.period_key)}
                                 </p>
                              </div>
                              <span className="text-[6px] font-bold text-blue-400/70 truncate text-center">
                                 Weekly
                              </span>
                           </div>
                        ))}

                        {/* Bot Marathon Volumes */}
                        {botAwards.map(a => (
                           <div
                              key={a.id}
                              onClick={onExplore}
                              className="group relative shrink-0 w-16 sm:w-20 h-24 sm:h-28 rounded-md bg-gradient-to-r from-[#0d2e20] via-[#154732] to-[#0d2e20] border border-emerald-400/40 p-1.5 flex flex-col justify-between hover:-translate-y-1 transition-all duration-300 shadow-[2px_4px_10px_rgba(0,0,0,0.5)] cursor-pointer select-none"
                           >
                              <div className="absolute left-1 top-0 bottom-0 w-0.5 bg-black/40" />
                              <div className="flex justify-between items-start">
                                 <Zap size={11} className="text-emerald-400" />
                                 <span className="text-[7px] font-black text-emerald-300">{a.score}</span>
                              </div>
                              <div className="my-auto text-center px-0.5">
                                 <p className="text-[7px] font-black text-emerald-100 line-clamp-2 leading-tight">
                                    {formatAwardPeriod(a.award_type, a.period_key)}
                                 </p>
                              </div>
                              <span className="text-[6px] font-bold text-emerald-400/70 truncate text-center">
                                 Marathon
                              </span>
                           </div>
                        ))}

                        {/* Streak Grimoires */}
                        {streakAwards.map(a => {
                           const label = a.score === 365 ? '1 Year' : `${a.score} Days`
                           return (
                              <div
                                 key={a.id}
                                 onClick={onExplore}
                                 className="group relative shrink-0 w-16 sm:w-20 h-24 sm:h-28 rounded-md bg-gradient-to-r from-[#3b1c09] via-[#5c2a0c] to-[#3b1c09] border border-amber-400/50 p-1.5 flex flex-col justify-between hover:-translate-y-1 transition-all duration-300 shadow-[2px_4px_10px_rgba(0,0,0,0.5)] cursor-pointer select-none"
                              >
                                 <div className="absolute left-1 top-0 bottom-0 w-0.5 bg-black/40" />
                                 <div className="flex justify-between items-start">
                                    <Flame size={11} className="text-amber-400 fill-amber-400/30" />
                                    <span className="text-[7px] font-black text-amber-300">🔥</span>
                                 </div>
                                 <div className="my-auto text-center px-0.5">
                                    <p className="text-[8px] font-black text-amber-100 leading-tight">{label}</p>
                                    <span className="text-[6px] text-amber-400/60 font-semibold">Streak</span>
                                 </div>
                                 <span className="text-[6px] font-bold text-amber-400/80 truncate text-center">
                                    Milestone
                                 </span>
                              </div>
                           )
                        })}
                     </div>

                     {/* Shelf Plank 2 */}
                     <div className="h-2.5 rounded-sm bg-gradient-to-r from-[#3e2515] via-[#5c371e] to-[#3e2515] border-t border-[#8c5630]/60 shadow-[0_4px_8px_rgba(0,0,0,0.8),inset_0_1px_2px_rgba(255,255,255,0.1)] relative">
                        <div className="absolute inset-x-0 bottom-0 h-[1px] bg-black/60" />
                     </div>
                  </div>
               )}

               {/* Empty Shelf State */}
               {!hasAnyAwards && (
                  <div className="text-center py-6 text-[#91714f] text-[10px] font-bold uppercase tracking-wider bg-black/20 rounded-xl border border-[#3e2716]/40 border-dashed">
                     Empty Archives · Complete daily word challenges and climb the ranks to fill your library!
                  </div>
               )}
            </div>
         </div>
      </div>
   )
}
