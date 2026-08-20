import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
   X,
   Trophy,
   Award,
   Crown,
   Zap,
   Flame,
   RotateCcw,
   BookOpen,
   ChevronLeft,
   ChevronRight,
   Move,
} from 'lucide-react'
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

export interface LibraryBook {
   id: string
   type: 'counter' | 'award'
   shelfRow: 'top' | 'middle' | 'bottom'
   awardType?: string
   icon: typeof Trophy
   title: string
   volumeName: string
   subtitle: string
   periodFormatted?: string
   score?: number
   count?: number
   theme: {
      spineGradient: string
      accentColor: string
      foilColor: string
      ribbonColor: string
      textColor: string
      borderColor: string
      glowColor: string
   }
}

export const TrophyCabinetExplorer = ({
   stats,
   awards,
   username,
   onClose,
}: TrophyCabinetExplorerProps) => {
   const completed = useMemo(
      () => awards.filter(a => !isCurrentPeriod(a.award_type, a.period_key)),
      [awards],
   )

   // 3D Orbit Camera State (pitch & yaw)
   const [rotation, setRotation] = useState<{ x: number; y: number }>({ x: 8, y: -10 })
   const [zoom, setZoom] = useState<number>(1)
   const [activeShelf, setActiveShelf] = useState<'all' | 'top' | 'middle' | 'bottom'>('all')
   const [selectedBook, setSelectedBook] = useState<LibraryBook | null>(null)
   const [isDragging, setIsDragging] = useState(false)
   const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
   const initialRotRef = useRef<{ x: number; y: number }>({ x: 8, y: -10 })

   // Compile all library books organized by shelf
   const libraryBooks: LibraryBook[] = useMemo(() => {
      const books: LibraryBook[] = []

      // Top Shelf: Grand Champions
      if (stats.dailyWins > 0) {
         books.push({
            id: 'book-daily-champ',
            type: 'counter',
            shelfRow: 'top',
            icon: Award,
            title: 'Daily Champion',
            volumeName: 'Vol. I · Daily Masteries',
            subtitle: `${stats.dailyWins} Daily Puzzles Won`,
            count: stats.dailyWins,
            theme: {
               spineGradient: 'from-[#3b2413] via-[#633e21] to-[#3b2413]',
               accentColor: '#f59e0b',
               foilColor: '#fbbf24',
               ribbonColor: '#f59e0b',
               textColor: 'text-amber-300',
               borderColor: 'border-amber-500/50',
               glowColor: 'rgba(245, 158, 11, 0.3)',
            },
         })
      }

      if (stats.weeklyWins > 0) {
         books.push({
            id: 'book-weekly-master',
            type: 'counter',
            shelfRow: 'top',
            icon: Crown,
            title: 'Weekly Master',
            volumeName: 'Vol. II · Weekly Supremacy',
            subtitle: `${stats.weeklyWins} Weekly Leaderboard Victories`,
            count: stats.weeklyWins,
            theme: {
               spineGradient: 'from-[#0f2442] via-[#1a3c6e] to-[#0f2442]',
               accentColor: '#38bdf8',
               foilColor: '#7dd3fc',
               ribbonColor: '#0284c7',
               textColor: 'text-sky-300',
               borderColor: 'border-sky-500/50',
               glowColor: 'rgba(56, 189, 248, 0.3)',
            },
         })
      }

      if (stats.monthlyWins > 0) {
         books.push({
            id: 'book-monthly-dom',
            type: 'counter',
            shelfRow: 'top',
            icon: Trophy,
            title: 'Monthly Dominator',
            volumeName: 'Vol. III · Hall of Legends',
            subtitle: `${stats.monthlyWins} Monthly Trophies`,
            count: stats.monthlyWins,
            theme: {
               spineGradient: 'from-[#28133b] via-[#48216b] to-[#28133b]',
               accentColor: '#c084fc',
               foilColor: '#e879f9',
               ribbonColor: '#a855f7',
               textColor: 'text-purple-300',
               borderColor: 'border-purple-500/50',
               glowColor: 'rgba(192, 132, 252, 0.3)',
            },
         })
      }

      // Middle Shelf: Weekly & Marathon Specific Period Chronicles
      completed
         .filter(a => a.award_type === 'weekly_champion' || a.award_type === 'bot_marathon_weekly')
         .forEach(a => {
            const isWeekly = a.award_type === 'weekly_champion'
            const periodStr = formatAwardPeriod(a.award_type, a.period_key)

            if (isWeekly) {
               books.push({
                  id: a.id,
                  type: 'award',
                  shelfRow: 'middle',
                  awardType: a.award_type,
                  icon: Crown,
                  title: 'Weekly Champion',
                  volumeName: `Ch. ${a.period_key}`,
                  subtitle: `Achieved 1st place with ${a.score} pts`,
                  periodFormatted: periodStr,
                  score: a.score,
                  theme: {
                     spineGradient: 'from-[#14233a] via-[#1e3b63] to-[#14233a]',
                     accentColor: '#60a5fa',
                     foilColor: '#93c5fd',
                     ribbonColor: '#3b82f6',
                     textColor: 'text-blue-200',
                     borderColor: 'border-blue-400/40',
                     glowColor: 'rgba(96, 165, 250, 0.25)',
                  },
               })
            } else {
               books.push({
                  id: a.id,
                  type: 'award',
                  shelfRow: 'middle',
                  awardType: a.award_type,
                  icon: Zap,
                  title: 'Bot Marathon Champion',
                  volumeName: `Marathon · ${a.period_key}`,
                  subtitle: `High Score of ${a.score} pts`,
                  periodFormatted: periodStr,
                  score: a.score,
                  theme: {
                     spineGradient: 'from-[#0e2b1e] via-[#184a34] to-[#0e2b1e]',
                     accentColor: '#34d399',
                     foilColor: '#6ee7b7',
                     ribbonColor: '#10b981',
                     textColor: 'text-emerald-200',
                     borderColor: 'border-emerald-400/40',
                     glowColor: 'rgba(52, 211, 153, 0.25)',
                  },
               })
            }
         })

      // Bottom Shelf: Streak Grimoires
      completed
         .filter(a => a.award_type.startsWith('streak_'))
         .forEach(a => {
            const label = a.score === 365 ? '1 Year Streak Tome' : `${a.score}-Day Streak Grimoire`
            const dateStr = a.awarded_at
               ? new Date(a.awarded_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                 })
               : ''

            books.push({
               id: a.id,
               type: 'award',
               shelfRow: 'bottom',
               awardType: a.award_type,
               icon: Flame,
               title: label,
               volumeName: `${a.score} Days Flame`,
               subtitle: dateStr ? `Achieved on ${dateStr}` : 'Perpetual Streak Milestone',
               score: a.score,
               theme: {
                  spineGradient: 'from-[#421d0a] via-[#692d0f] to-[#421d0a]',
                  accentColor: '#fb923c',
                  foilColor: '#fdba74',
                  ribbonColor: '#ea580c',
                  textColor: 'text-orange-200',
                  borderColor: 'border-orange-500/50',
                  glowColor: 'rgba(251, 146, 60, 0.3)',
               },
            })
         })

      return books
   }, [stats, completed])

   // Mouse / Touch 3D Drag Orbit Controls
   const handlePointerDown = (e: React.PointerEvent) => {
      setIsDragging(true)
      dragStartRef.current = { x: e.clientX, y: e.clientY }
      initialRotRef.current = { ...rotation }
   }

   const handlePointerMove = useCallback((e: PointerEvent) => {
      if (!isDragging) return
      const deltaX = e.clientX - dragStartRef.current.x
      const deltaY = e.clientY - dragStartRef.current.y

      setRotation({
         x: Math.max(-25, Math.min(30, initialRotRef.current.x - deltaY * 0.15)),
         y: Math.max(-50, Math.min(50, initialRotRef.current.y + deltaX * 0.2)),
      })
   }, [isDragging])

   const handlePointerUp = useCallback(() => {
      setIsDragging(false)
   }, [])

   useEffect(() => {
      if (isDragging) {
         window.addEventListener('pointermove', handlePointerMove)
         window.addEventListener('pointerup', handlePointerUp)
         return () => {
            window.removeEventListener('pointermove', handlePointerMove)
            window.removeEventListener('pointerup', handlePointerUp)
         }
      }
   }, [isDragging, handlePointerMove, handlePointerUp])

   const resetCamera = () => {
      setRotation({ x: 8, y: -10 })
      setZoom(1)
      setActiveShelf('all')
   }

   const filteredTop = libraryBooks.filter(b => b.shelfRow === 'top')
   const filteredMiddle = libraryBooks.filter(b => b.shelfRow === 'middle')
   const filteredBottom = libraryBooks.filter(b => b.shelfRow === 'bottom')

   return (
      <div className="fixed inset-0 z-50 flex flex-col select-none overflow-hidden bg-[#060403] text-white">
         {/* Atmospheric Library Ambient Background */}
         <div
            className="absolute inset-0 pointer-events-none"
            style={{
               background:
                  'radial-gradient(ellipse at 50% 30%, #1a100a 0%, #0c0704 55%, #030202 100%)',
            }}
         />

         {/* Floating Golden Dust Particles */}
         <div className="absolute inset-0 bg-[radial-gradient(#d4af37_1px,transparent_1px)] [background-size:32px_32px] opacity-15 pointer-events-none" />

         {/* TOP CONTROL BAR */}
         <header className="relative z-20 flex items-center justify-between p-3 sm:p-5 border-b border-[#3b2314]/60 bg-black/40 backdrop-blur-md">
            <div className="flex items-center gap-3">
               <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-700/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-950/40">
                  <BookOpen size={18} />
               </div>
               <div>
                  <h2 className="text-xs sm:text-sm font-black uppercase tracking-widest text-amber-200 flex items-center gap-2">
                     Library of Records
                     <span className="text-[9px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                        {libraryBooks.length} {libraryBooks.length === 1 ? 'Volume' : 'Volumes'}
                     </span>
                  </h2>
                  <p className="text-[9px] text-[#a8825c] font-bold uppercase tracking-wider">
                     Archivist @{username}
                  </p>
               </div>
            </div>

            {/* Quick Controls */}
            <div className="flex items-center gap-2">
               <button
                  onClick={resetCamera}
                  className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider bg-white/5 hover:bg-white/10 text-[#d4af82] border border-white/10 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer"
                  title="Reset 3D Camera"
               >
                  <RotateCcw size={12} />
                  <span className="hidden sm:inline">Reset View</span>
               </button>

               <button
                  onClick={onClose}
                  className="p-2 bg-white/5 hover:bg-white/15 rounded-xl border border-white/10 text-gray-300 hover:text-white transition-all cursor-pointer shadow-lg"
               >
                  <X size={18} />
               </button>
            </div>
         </header>

         {/* 3D INTERACTIVE LIBRARY RACK STAGE */}
         <div
            onPointerDown={handlePointerDown}
            className={`relative flex-1 flex items-center justify-center cursor-grab ${
               isDragging ? 'cursor-grabbing' : ''
            } perspective-[1200px] overflow-hidden`}
         >
            {/* Instruction Overlay */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-amber-500/20 text-[9px] text-amber-200/80 font-bold uppercase tracking-widest pointer-events-none shadow-xl">
               <Move size={12} className="text-amber-400 animate-pulse" />
               <span>Drag to rotate 3D Library Rack · Click book to inspect</span>
            </div>

            {/* 3D RACK CONTAINER WITH DYNAMIC PITCH & YAW */}
            <motion.div
               animate={{
                  scale: zoom,
                  rotateX: rotation.x,
                  rotateY: rotation.y,
                  y: activeShelf === 'top' ? 120 : activeShelf === 'bottom' ? -120 : 0,
               }}
               transition={{ type: 'spring', damping: 25, stiffness: 120 }}
               className="relative w-[340px] sm:w-[480px] md:w-[580px] p-4 sm:p-6 rounded-3xl"
               style={{
                  transformStyle: 'preserve-3d',
                  background:
                     'linear-gradient(180deg, rgba(38,22,13,0.95) 0%, rgba(18,11,7,0.98) 100%)',
                  boxShadow:
                     '0 30px 60px -15px rgba(0,0,0,0.9), inset 0 2px 20px rgba(212,175,55,0.15), 0 0 0 3px #422616',
               }}
            >
               {/* Mahogany Side Pillars (Left & Right 3D Panels) */}
               <div
                  className="absolute left-0 top-0 bottom-0 w-4 sm:w-6 bg-gradient-to-r from-[#211107] to-[#381e0e] border-r border-[#542d15] rounded-l-3xl shadow-inner"
                  style={{ transform: 'translateZ(20px)' }}
               />
               <div
                  className="absolute right-0 top-0 bottom-0 w-4 sm:w-6 bg-gradient-to-l from-[#211107] to-[#381e0e] border-l border-[#542d15] rounded-r-3xl shadow-inner"
                  style={{ transform: 'translateZ(20px)' }}
               />

               <div className="space-y-6 sm:space-y-8 py-2 px-3 sm:px-6">
                  {/* ================= SHELF ROW 1: CHAMPIONSHIP TOMES ================= */}
                  <div
                     className="relative space-y-1.5 transition-all duration-300"
                     style={{
                        transform: 'translateZ(30px)',
                        opacity: activeShelf === 'all' || activeShelf === 'top' ? 1 : 0.35,
                     }}
                  >
                     <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-[#e0b98a]">
                        <span className="flex items-center gap-1.5">
                           <Crown size={13} className="text-amber-400" />
                           Top Shelf · Championship Masteries
                        </span>
                        <span className="text-[8px] text-[#8c653f] font-bold">Shelf I</span>
                     </div>

                     {/* Books array */}
                     <div className="flex items-end justify-center gap-3 sm:gap-6 pt-3 pb-1 min-h-[140px] sm:min-h-[160px]">
                        {filteredTop.length > 0 ? (
                           filteredTop.map((book, idx) => (
                              <BookSpine3D
                                 key={book.id}
                                 book={book}
                                 index={idx}
                                 onSelect={() => setSelectedBook(book)}
                              />
                           ))
                        ) : (
                           <div className="text-[9px] text-[#7a5937] italic font-semibold my-auto">
                              No masteries unlocked yet
                           </div>
                        )}
                     </div>

                     {/* 3D Wooden Shelf Plank */}
                     <ShelfPlank3D />
                  </div>

                  {/* ================= SHELF ROW 2: AWARD CHRONICLES ================= */}
                  <div
                     className="relative space-y-1.5 transition-all duration-300"
                     style={{
                        transform: 'translateZ(20px)',
                        opacity: activeShelf === 'all' || activeShelf === 'middle' ? 1 : 0.35,
                     }}
                  >
                     <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-[#e0b98a]">
                        <span className="flex items-center gap-1.5">
                           <Trophy size={13} className="text-blue-400" />
                           Middle Shelf · League Chronicles
                        </span>
                        <span className="text-[8px] text-[#8c653f] font-bold">Shelf II</span>
                     </div>

                     <div className="flex items-end justify-center gap-2 sm:gap-4 pt-3 pb-1 min-h-[120px] sm:min-h-[140px] overflow-x-auto scrollbar-none">
                        {filteredMiddle.length > 0 ? (
                           filteredMiddle.map((book, idx) => (
                              <BookSpine3D
                                 key={book.id}
                                 book={book}
                                 index={idx}
                                 onSelect={() => setSelectedBook(book)}
                              />
                           ))
                        ) : (
                           <div className="text-[9px] text-[#7a5937] italic font-semibold my-auto">
                              No weekly/monthly records registered
                           </div>
                        )}
                     </div>

                     <ShelfPlank3D />
                  </div>

                  {/* ================= SHELF ROW 3: STREAK GRIMOIRES ================= */}
                  <div
                     className="relative space-y-1.5 transition-all duration-300"
                     style={{
                        transform: 'translateZ(10px)',
                        opacity: activeShelf === 'all' || activeShelf === 'bottom' ? 1 : 0.35,
                     }}
                  >
                     <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-[#e0b98a]">
                        <span className="flex items-center gap-1.5">
                           <Flame size={13} className="text-orange-400 fill-orange-400/20" />
                           Bottom Shelf · Streak Grimoires
                        </span>
                        <span className="text-[8px] text-[#8c653f] font-bold">Shelf III</span>
                     </div>

                     <div className="flex items-end justify-center gap-2 sm:gap-4 pt-3 pb-1 min-h-[120px] sm:min-h-[140px] overflow-x-auto scrollbar-none">
                        {filteredBottom.length > 0 ? (
                           filteredBottom.map((book, idx) => (
                              <BookSpine3D
                                 key={book.id}
                                 book={book}
                                 index={idx}
                                 onSelect={() => setSelectedBook(book)}
                              />
                           ))
                        ) : (
                           <div className="text-[9px] text-[#7a5937] italic font-semibold my-auto">
                              Maintain daily streaks to earn milestone tomes
                           </div>
                        )}
                     </div>

                     <ShelfPlank3D />
                  </div>
               </div>
            </motion.div>
         </div>

         {/* BOTTOM SHELF SELECTOR & ZOOM TOOLBAR */}
         <footer className="relative z-20 flex items-center justify-between p-3 sm:p-4 border-t border-[#3b2314]/60 bg-black/60 backdrop-blur-md">
            {/* Shelf Switchers */}
            <div className="flex items-center gap-1.5">
               <span className="text-[9px] text-[#9c7955] font-black uppercase tracking-wider hidden sm:inline mr-1">
                  Focus:
               </span>
               {(['all', 'top', 'middle', 'bottom'] as const).map(shelf => (
                  <button
                     key={shelf}
                     onClick={() => setActiveShelf(shelf)}
                     className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                        activeShelf === shelf
                           ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                           : 'bg-white/5 text-gray-400 hover:text-white border border-transparent'
                     }`}
                  >
                     {shelf === 'all'
                        ? 'Full Rack'
                        : shelf === 'top'
                          ? 'Shelf I'
                          : shelf === 'middle'
                            ? 'Shelf II'
                            : 'Shelf III'}
                  </button>
               ))}
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-2">
               <button
                  onClick={() => setZoom(z => Math.max(0.7, z - 0.15))}
                  className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 flex items-center justify-center font-bold text-xs border border-white/10 cursor-pointer"
                  title="Zoom Out"
               >
                  -
               </button>
               <span className="text-[9px] font-mono text-gray-400 w-10 text-center">
                  {Math.round(zoom * 100)}%
               </span>
               <button
                  onClick={() => setZoom(z => Math.min(1.4, z + 0.15))}
                  className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 flex items-center justify-center font-bold text-xs border border-white/10 cursor-pointer"
                  title="Zoom In"
               >
                  +
               </button>
            </div>
         </footer>

         {/* 3D BOOK INSPECTION FOLIO MODAL */}
         <AnimatePresence>
            {selectedBook && (
               <BookInspectionModal
                  book={selectedBook}
                  onClose={() => setSelectedBook(null)}
                  onNext={() => {
                     const idx = libraryBooks.findIndex(b => b.id === selectedBook.id)
                     if (idx < libraryBooks.length - 1) setSelectedBook(libraryBooks[idx + 1])
                  }}
                  onPrev={() => {
                     const idx = libraryBooks.findIndex(b => b.id === selectedBook.id)
                     if (idx > 0) setSelectedBook(libraryBooks[idx - 1])
                  }}
                  hasPrev={libraryBooks.findIndex(b => b.id === selectedBook.id) > 0}
                  hasNext={
                     libraryBooks.findIndex(b => b.id === selectedBook.id) <
                     libraryBooks.length - 1
                  }
               />
            )}
         </AnimatePresence>
      </div>
   )
}

/**
 * 3D Book Spine Component sitting upright on the shelf
 */
const BookSpine3D: React.FC<{
   book: LibraryBook
   index: number
   onSelect: () => void
}> = ({ book, index, onSelect }) => {
   const Icon = book.icon
   const isTop = book.shelfRow === 'top'
   const heightClass = isTop ? 'h-32 sm:h-36 w-12 sm:w-14' : 'h-26 sm:h-30 w-10 sm:w-12'

   return (
      <motion.div
         whileHover={{
            y: -14,
            rotateZ: index % 2 === 0 ? 2 : -2,
            scale: 1.05,
            transition: { duration: 0.2 },
         }}
         onClick={e => {
            e.stopPropagation()
            onSelect()
         }}
         className={`relative group cursor-pointer shrink-0 rounded-md border p-1.5 flex flex-col justify-between items-center transition-shadow select-none ${heightClass} ${book.theme.borderColor}`}
         style={{
            background: `linear-gradient(180deg, #120b07 0%, rgba(20,10,5,0.9) 100%)`,
            boxShadow: `0 10px 20px rgba(0,0,0,0.8), inset 0 0 15px ${book.theme.glowColor}`,
            transformStyle: 'preserve-3d',
         }}
      >
         {/* Gold foil ribbon bookmark sticking out */}
         <div
            className="absolute -top-1.5 right-2 w-2 h-4 rounded-b shadow-md"
            style={{ backgroundColor: book.theme.ribbonColor }}
         />

         {/* Spine Embossed Top Crest */}
         <div
            className="w-7 h-7 rounded-full flex items-center justify-center border border-white/20 shadow-inner mt-1"
            style={{
               background: `radial-gradient(circle, ${book.theme.accentColor}33 0%, rgba(0,0,0,0.6) 100%)`,
               color: book.theme.accentColor,
            }}
         >
            <Icon size={14} />
         </div>

         {/* Vertical Gold Foil Title on Spine */}
         <div className="my-auto py-1 flex items-center justify-center overflow-hidden">
            <span
               className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider truncate max-h-[70px] write-vertical-lr text-center"
               style={{ color: book.theme.foilColor, textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}
            >
               {book.title}
            </span>
         </div>

         {/* Bottom Volume Indicator */}
         <div className="w-full text-center border-t border-white/10 pt-1">
            <span className="text-[7px] font-black uppercase text-gray-400 block truncate">
               {book.count !== undefined ? `${book.count} W` : book.score ? `${book.score} PTS` : 'TOME'}
            </span>
         </div>

         <style>{`
            .write-vertical-lr {
               writing-mode: vertical-lr;
               transform: rotate(180deg);
            }
         `}</style>
      </motion.div>
   )
}

/**
 * 3D Wooden Shelf Plank
 */
const ShelfPlank3D: React.FC = () => {
   return (
      <div className="relative h-4 rounded-sm bg-gradient-to-r from-[#2c180b] via-[#4a2b15] to-[#2c180b] border-t-2 border-[#804f27]/80 shadow-[0_8px_16px_rgba(0,0,0,0.9),inset_0_1px_2px_rgba(255,255,255,0.15)]">
         {/* Brass Trim Inlay */}
         <div className="absolute inset-x-4 top-1.5 h-[1px] bg-gradient-to-r from-transparent via-[#d4af37]/60 to-transparent" />
         {/* Bottom Shadow Cast */}
         <div className="absolute -bottom-3 inset-x-0 h-3 bg-black/80 blur-xs pointer-events-none" />
      </div>
   )
}

/**
 * Open Folio Book Inspection View
 */
const BookInspectionModal: React.FC<{
   book: LibraryBook
   onClose: () => void
   onNext: () => void
   onPrev: () => void
   hasNext: boolean
   hasPrev: boolean
}> = ({ book, onClose, onNext, onPrev, hasNext, hasPrev }) => {
   const Icon = book.icon

   return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl">
         <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 30, rotateY: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0, rotateY: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 30, rotateY: -15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="relative w-full max-w-md bg-gradient-to-b from-[#1c120a] via-[#120a06] to-[#080503] border-2 rounded-3xl p-6 sm:p-8 shadow-[0_25px_60px_rgba(0,0,0,0.95)] overflow-hidden"
            style={{ borderColor: book.theme.accentColor }}
         >
            {/* Ambient Crest Glow */}
            <div
               className="absolute -top-24 -right-24 w-56 h-56 rounded-full blur-3xl opacity-30 pointer-events-none"
               style={{ backgroundColor: book.theme.accentColor }}
            />

            {/* Header / Close */}
            <div className="flex items-center justify-between mb-6">
               <span
                  className="text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border"
                  style={{
                     color: book.theme.foilColor,
                     borderColor: `${book.theme.accentColor}44`,
                     backgroundColor: `${book.theme.accentColor}15`,
                  }}
               >
                  {book.volumeName}
               </span>
               <button
                  onClick={onClose}
                  className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 text-gray-400 hover:text-white transition-all cursor-pointer"
               >
                  <X size={18} />
               </button>
            </div>

            {/* Book Folio Emblem */}
            <div className="text-center space-y-4">
               <div
                  className="inline-flex items-center justify-center w-20 h-20 rounded-2xl border-2 shadow-2xl"
                  style={{
                     borderColor: book.theme.accentColor,
                     background: `radial-gradient(circle, ${book.theme.accentColor}25 0%, rgba(0,0,0,0.8) 100%)`,
                     color: book.theme.accentColor,
                  }}
               >
                  <Icon size={40} />
               </div>

               <div className="space-y-1.5">
                  <h3 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-white">
                     {book.title}
                  </h3>
                  <p className="text-xs text-[#c29e78] font-bold">{book.subtitle}</p>
               </div>

               {/* Period or Record Details */}
               {book.periodFormatted && (
                  <div className="inline-block bg-white/5 border border-white/10 px-4 py-1.5 rounded-xl text-[11px] text-[#e0cfb8] font-semibold">
                     {book.periodFormatted}
                  </div>
               )}

               {/* Score / Counter Display */}
               <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="bg-black/40 border border-white/10 rounded-2xl p-3 text-center">
                     <span className="text-[8px] font-black uppercase tracking-wider text-[#91714f] block">
                        Record Category
                     </span>
                     <span className="text-sm font-bold text-white uppercase mt-0.5 block">
                        {book.type === 'counter' ? 'Career Total' : 'Awarded Title'}
                     </span>
                  </div>

                  <div className="bg-black/40 border border-white/10 rounded-2xl p-3 text-center">
                     <span className="text-[8px] font-black uppercase tracking-wider text-[#91714f] block">
                        {book.score !== undefined ? 'Victory Score' : 'Victories'}
                     </span>
                     <span
                        className="text-base font-black uppercase mt-0.5 block"
                        style={{ color: book.theme.foilColor }}
                     >
                        {book.score !== undefined
                           ? `${book.score} PTS`
                           : `${book.count || 0} Wins`}
                     </span>
                  </div>
               </div>

               {/* Ornamental Parchment Footer */}
               <div className="pt-4 flex items-center justify-between border-t border-white/10">
                  <button
                     onClick={onPrev}
                     disabled={!hasPrev}
                     className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-[#b8936a] hover:text-white disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer"
                  >
                     <ChevronLeft size={14} /> Previous Volume
                  </button>

                  <button
                     onClick={onNext}
                     disabled={!hasNext}
                     className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-[#b8936a] hover:text-white disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer"
                  >
                     Next Volume <ChevronRight size={14} />
                  </button>
               </div>
            </div>
         </motion.div>
      </div>
   )
}
