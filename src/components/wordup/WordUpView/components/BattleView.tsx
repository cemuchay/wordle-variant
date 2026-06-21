import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { TargetAndTransition, Transition } from "framer-motion";
import { AlertTriangle, Eye, EyeOff } from "lucide-react";
import { BOT_PROFILES, type WordUpQuestion } from "../../../../utils/wordupQuestionGenerator";
import { getCachedFlagUrl } from "../../../../utils/wordupQuestionPostProcessor";
import { useConfirmation } from "../../../../hooks/useConfirmation";
import { type ProfileStats } from "../types";


import { getQuestionDuration } from "../hooks/useWordUpGameLoop";
import { ProtectedAvatar } from "../../../../components/chat/ProtectedAvatar";
import { CATEGORIES } from "../constants";
import { WORDUP_GAME, CONFETTI, CHAT_BUBBLE, PROMPT_FONT_SIZE, CHOICE_FONT_SIZE } from "../../../../constants/wordup";
import { useWordUpStore } from "../../../../store/useWordUpStore";

interface MatchData {
   p1_score?: number;
   p2_score?: number;
   p1_answered?: boolean;
   p2_answered?: boolean;
   p1_answers?: { choice: string }[];
   p2_answers?: { choice: string }[];
   is_bot_match?: boolean;
   bot_profile?: string;
   player1_id?: string;
   player2_id?: string;
   category?: string;
}

interface PlayerProfile {
   id?: string;
   username?: string;
   avatar_url?: string;
}

interface BattleViewProps {
   questions: WordUpQuestion[];
   currentIdx: number;
   matchData: MatchData | null;
   opponentStats: ProfileStats | null;
   timeLeft: number;
   maxTime: number;
   selectedAnswer: string | null;
   revealAnswers: boolean;
   handleAnswerSelect: (choice: string) => void;
   role: "player1" | "player2" | null;
   playerProfile: PlayerProfile | null;
   sendQuickChat: (text: string) => void;
   onAbort: () => void;
}

const PREFILLED_MESSAGES = [
   "Good job! 👏",
   "You go see! 👀",
   "Wow! 🤯",
   "Nice! 🔥",
   "Oops 😅",
   "Close one! ⚡"
];

interface Particle {
   id: number;
   targetX: number;
   targetY: number;
   size: number;
   color: string;
   rotation: number;
   shape: string;
   duration: number;
}

interface ActiveBubble {
   id: string;
   text: string;
   senderRole: string;
   x: number;
   y: number;
}

export const BattleView = ({
   questions,
   currentIdx,
   matchData,
   opponentStats,
   timeLeft,
   maxTime,
   selectedAnswer,
   revealAnswers,
   handleAnswerSelect,
   role,
   playerProfile,
   sendQuickChat,
   onAbort
}: BattleViewProps) => {
   const [particles, setParticles] = useState<Particle[]>([]);
   const [activeBubbles, setActiveBubbles] = useState<ActiveBubble[]>([]);
   const [frozenPercent, setFrozenPercent] = useState<number | null>(null);
   const { ask } = useConfirmation();

   const isBattlePlaying = useWordUpStore((s) => s.isBattlePlaying);
   const setIsBattlePlaying = useWordUpStore((s) => s.setIsBattlePlaying);

   const [prevIdx, setPrevIdx] = useState(currentIdx);
   if (currentIdx !== prevIdx) {
      setPrevIdx(currentIdx);
      setParticles([]);
   }

   // Listen to in-game chat events
   useEffect(() => {
      const handleChat = (e: Event) => {
         const detail = (e as CustomEvent)?.detail;
         if (detail) {
            const id = Math.random().toString();
            const newBubble = {
               id,
               text: detail.text,
               senderRole: detail.senderRole,
                x: detail.senderRole === "player1" ? CHAT_BUBBLE.POSITION_X_BASE + Math.random() * CHAT_BUBBLE.POSITION_X_VARIANCE : CHAT_BUBBLE.POSITION_X_OPP_BASE + Math.random() * CHAT_BUBBLE.POSITION_X_OPP_VARIANCE,
                y: CHAT_BUBBLE.POSITION_Y_BASE + Math.random() * CHAT_BUBBLE.POSITION_Y_VARIANCE
             };
             setActiveBubbles((prev) => [...prev, newBubble]);
             setTimeout(() => {
                setActiveBubbles((prev) => prev.filter((b) => b.id !== id));
             }, CHAT_BUBBLE.DURATION);
         }
      };
      window.addEventListener("wordup-quick-chat", handleChat);
      return () => window.removeEventListener("wordup-quick-chat", handleChat);
   }, []);

   const activeQuestion = questions[currentIdx];
   if (!activeQuestion) return null;

   const qMaxTime = activeQuestion ? getQuestionDuration(activeQuestion.type) : maxTime || 10.0;

   useEffect(() => {
      if (selectedAnswer !== null) {
         if (frozenPercent === null) {
            setFrozenPercent((timeLeft / qMaxTime) * 100);
         }
      } else {
         setFrozenPercent(null);
      }
   }, [selectedAnswer, timeLeft, qMaxTime, frozenPercent]);

   const displayPercent = frozenPercent !== null ? frozenPercent : (timeLeft / qMaxTime) * 100;
   const barColor = displayPercent > 30 ? "#4ade80" : "#ef4444";

   const isP1 = role === "player1";
   const myScore = isP1 ? (matchData?.p1_score || 0) : (matchData?.p2_score || 0);
   const oppScore = isP1 ? (matchData?.p2_score || 0) : (matchData?.p1_score || 0);

   let p1Status = "Thinking...";
   let p1Color = "bg-gray-700";
   if (matchData?.p1_answered) {
      p1Status = "Submitted";
      p1Color = "bg-correct animate-pulse";
   } else if (role === "player1" && selectedAnswer !== null) {
      p1Status = "Syncing...";
      p1Color = "bg-yellow-500 animate-pulse";
   }

   let p2Status = "Thinking...";
   let p2Color = "bg-gray-700";
   if (matchData?.p2_answered) {
      p2Status = "Submitted";
      p2Color = "bg-pink-500 animate-pulse";
   } else if (role === "player2" && selectedAnswer !== null) {
      p2Status = "Syncing...";
      p2Color = "bg-yellow-500 animate-pulse";
   }

   const myStatus = isP1 ? p1Status : p2Status;
   const myColor = isP1 ? p1Color : p2Color;
   const oppStatus = isP1 ? p2Status : p1Status;
   const oppColor = isP1 ? p2Color : p1Color;

   const opponentName = opponentStats?.username || (matchData?.is_bot_match ? ((matchData.bot_profile && BOT_PROFILES[matchData.bot_profile]?.name) || "Word Bot") : "Opponent");

   const categoryName = CATEGORIES.find((c) => c.id === matchData?.category)?.name || matchData?.category?.replace(/_/g, " ") || "";

   // Resolve opponent choice
   const oppAnswers = isP1 ? matchData?.p2_answers : matchData?.p1_answers;
   const oppChoice = oppAnswers?.[currentIdx]?.choice;

   const onChoiceSelect = (choice: string) => {
      handleAnswerSelect(choice);
      if (choice === activeQuestion.answer) {
         const newParticles = Array.from({ length: CONFETTI.PARTICLE_COUNT }).map((_, i) => {
            const angle = (i / CONFETTI.PARTICLE_COUNT) * 360 + (Math.random() * 20 - 10);
            const distance = CONFETTI.MIN_DISTANCE + Math.random() * CONFETTI.MAX_DISTANCE;
            const rad = (angle * Math.PI) / 180;
            const targetX = Math.cos(rad) * distance;
            const targetY = Math.sin(rad) * distance;
            const size = CONFETTI.MIN_SIZE + Math.random() * CONFETTI.MAX_SIZE;
            const color = CONFETTI.COLORS[Math.floor(Math.random() * CONFETTI.COLORS.length)];
            const rotation = Math.random() * 360;
            const shape = CONFETTI.SHAPES[Math.floor(Math.random() * CONFETTI.SHAPES.length)];
            const duration = CONFETTI.MIN_DURATION + Math.random() * CONFETTI.MAX_DURATION;

            return {
               id: i,
               targetX,
               targetY,
               size,
               color,
               rotation,
               shape,
               duration
            };
         });
         setParticles(newParticles);
      }
   };

   const promptLen = activeQuestion.prompt.length;
         const promptSizeClass = promptLen > PROMPT_FONT_SIZE.LONG_THRESHOLD ? "text-base sm:text-lg" : promptLen > PROMPT_FONT_SIZE.MEDIUM_THRESHOLD ? "text-lg sm:text-xl" : "text-xl sm:text-2xl";

   const maxChoiceLen = Math.max(...activeQuestion.choices.map((c) => c.length), 0);
   const choiceSizeClass = maxChoiceLen > CHOICE_FONT_SIZE.LONG_THRESHOLD ? "text-[8px] sm:text-[10px]" : maxChoiceLen > CHOICE_FONT_SIZE.MEDIUM_THRESHOLD ? "text-[10px] sm:text-xs" : "text-xs";

   return (
      <motion.div
         initial={{ opacity: 0 }}
         animate={{ opacity: 1 }}
         className="flex flex-col flex-1 justify-between h-full pt-4 pb-3 relative overflow-hidden"
      >
         {/* Top Control Bar */}
         <div className="flex justify-between items-center px-1 pb-2 shrink-0 z-40">
            <button
               onClick={async () => {
                  const confirmed = await ask({
                     title: "Forfeit Match",
                     message: "Are you sure you want to forfeit and abort this match? This will count as a loss.",
                     confirmLabel: "Forfeit",
                     type: "danger"
                  });
                  if (confirmed) {
                     onAbort();
                  }
               }}
               className="flex items-center gap-1 bg-red-950/40 border border-red-500/20 text-red-400 hover:bg-red-950/60 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow-sm"
            >
               <AlertTriangle size={12} />
               <span>Abort Game</span>
            </button>

            <button
               onClick={() => setIsBattlePlaying(!isBattlePlaying)}
               className="flex items-center gap-1.5 bg-slate-800/60 border border-white/10 text-gray-300 hover:text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow-sm"
               title="Toggle App Header and Navigation"
            >
               {isBattlePlaying ? <Eye size={12} className="text-cyan-400" /> : <EyeOff size={12} className="text-gray-400" />}
               <span>{isBattlePlaying ? "Show Navigation" : "Hide Navigation"}</span>
            </button>
         </div>
         {/* Floating Chat Bubbles */}
         <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
            <AnimatePresence>
               {activeBubbles.map((bubble) => (
                  <motion.div
                     key={bubble.id}
                     initial={{ opacity: 0, y: `${bubble.y}%`, scale: 0.8 }}
                     animate={{ opacity: 1, y: `${bubble.y - 40}%`, scale: 1 }}
                     exit={{ opacity: 0, scale: 0.9 }}
                     transition={{ duration: CHAT_BUBBLE.FADE_DURATION, ease: "easeOut" }}
                     style={{ left: `${bubble.x}%` }}
                     className="absolute -translate-x-1/2 bg-slate-900/90 text-white border border-white/20 px-3 py-1.5 rounded-2xl shadow-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap"
                  >
                     <span>{bubble.text}</span>
                  </motion.div>
               ))}
            </AnimatePresence>
         </div>

         {/* Players Panel */}
         <div className="grid grid-cols-2 gap-4 bg-white/5 border border-white/10 p-4 rounded-2xl shrink-0">
            <div className="flex items-center gap-2 min-w-0">
               <ProtectedAvatar
                  userId={playerProfile?.id || undefined}
                  src={playerProfile?.avatar_url || undefined}
                  username={playerProfile?.username || "You"}
                   className="w-10 h-10 rounded-full border border-correct/30 shrink-0"
               />
               <div className="truncate">
                  <p className="text-[9px] text-gray-400 font-bold uppercase truncate">{playerProfile?.username || "You"}</p>
                   <p className="text-base font-black text-white">{myScore} pts</p>
               </div>
            </div>
            <div className="flex items-center gap-2 min-w-0 justify-end text-right">
               <div className="truncate">
                  <p className="text-[9px] text-gray-400 font-bold uppercase truncate">
                     {opponentName}
                  </p>
                   <p className="text-base font-black text-white">{oppScore} pts</p>
               </div>
               <ProtectedAvatar
                  userId={matchData?.is_bot_match ? undefined : ((isP1 ? matchData?.player2_id : matchData?.player1_id) || undefined)}
                  src={matchData?.is_bot_match ? `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(opponentName)}` : (opponentStats?.avatar_url || undefined)}
                  username={opponentName}
                   className="w-10 h-10 rounded-full border border-pink-500/30 shrink-0"
               />
            </div>
         </div>

         {/* Score Indicators / Answer Status */}
         <div className="flex justify-between items-center px-1 py-3 shrink-0">
            <div className="flex items-center gap-1">
               <span className={`w-2.5 h-2.5 rounded-full ${myColor}`} />
               <span className="text-[9px] text-gray-500 uppercase font-black">
                  {myStatus}
               </span>
            </div>
            <div className="flex flex-col items-center">
               {categoryName && (
                  <span className="text-[9px] font-black text-cyan-400 uppercase tracking-wider mb-0.5">{categoryName}</span>
               )}
                <span className="text-xs font-black text-gray-400">Round {currentIdx + 1} of {WORDUP_GAME.TOTAL_ROUNDS}</span>
                {currentIdx === WORDUP_GAME.TOTAL_ROUNDS - 1 && (
                  <span className="text-[9px] font-black text-pink-500 animate-pulse tracking-wider">⚡ DOUBLE POINTS</span>
               )}
            </div>
            <div className="flex items-center gap-1 justify-end">
               <span className="text-[9px] text-gray-500 uppercase font-black">
                  {oppStatus}
               </span>
               <span className={`w-2.5 h-2.5 rounded-full ${oppColor}`} />
            </div>
         </div>

          {/* Timer Bar */}
          <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden shrink-0 shadow-inner">
             {!revealAnswers && (
                <div
                   className="h-full rounded-full transition-all duration-100 ease-out"
                   style={{
                      width: `${displayPercent}%`,
                      backgroundColor: barColor,
                      boxShadow: `0 0 8px ${barColor}`
                   }}
                />
             )}
          </div>

          {/* Question Container */}
          <div className="flex-1 flex flex-col justify-between sm:justify-center gap-2 sm:gap-4 md:gap-6 py-2 sm:py-6 md:py-8 overflow-y-auto scrollbar-hide min-h-0">
             <div className="text-center space-y-1 sm:space-y-2">
                 <p className="text-[9px] sm:text-[10px] font-black uppercase text-correct tracking-widest flex items-center justify-center gap-1">
                    {currentIdx === WORDUP_GAME.TOTAL_ROUNDS - 1 && <span className="text-pink-500 animate-pulse font-black">⚡ DOUBLE POINTS -</span>}
                   {activeQuestion.type.replace("_", " ")}
                </p>
                <h2 className={`${promptSizeClass} font-black tracking-tight leading-normal sm:leading-relaxed text-white whitespace-pre-line`}>
                   {activeQuestion.prompt}
                </h2>
                {activeQuestion.subPrompt && (
                   <p className="text-[10px] sm:text-xs text-gray-400 bg-white/5 px-2.5 py-0.5 sm:py-1 rounded-lg inline-block">
                      {activeQuestion.subPrompt}
                   </p>
                )}
             </div>

              {activeQuestion.imageUrl && (
                 <div className="w-full flex justify-center shrink-0 my-0.5 sm:my-1">
                    <motion.div
                       initial={{ opacity: 0, scale: 0.95 }}
                       animate={{ opacity: 1, scale: 1 }}
                       className="w-full max-w-[200px] sm:max-w-[280px] h-[90px] sm:h-[140px] rounded-xl overflow-hidden border border-white/10 bg-slate-950/45 flex items-center justify-center p-1 shadow-inner"
                    >
                       <img
                          src={activeQuestion.imageUrl.length === 2 ? getCachedFlagUrl(activeQuestion.imageUrl) : activeQuestion.imageUrl}
                          alt="Question Clue"
                          className="max-h-full max-w-full object-contain rounded-lg select-none"
                          loading="lazy"
                          draggable={false}
                       />
                    </motion.div>
                 </div>
              )}

              {/* Choices Grid */}
              {activeQuestion.imageUrls && activeQuestion.imageUrls.length > 0 ? (
                 <div className="grid grid-cols-2 gap-2 sm:gap-4 shrink-0">
                    {activeQuestion.choices.map((choice, index) => {
                       const isSelected = selectedAnswer === choice;
                       const isCorrect = choice === activeQuestion.answer;
                       const isOppSelected = revealAnswers && oppChoice === choice;
                       const flagCode = activeQuestion.imageUrls?.[index] || choice;
                       const imageUrl = getCachedFlagUrl(flagCode);
                       const optionLetter = String.fromCharCode(65 + index);

                       let cardClass = "relative w-full aspect-[2/1] xs:aspect-[1.8/1] sm:aspect-[1.5/1] rounded-xl sm:rounded-2xl border-2 overflow-hidden flex flex-col items-center justify-center p-1 transition-all shadow-md select-none shrink-0 ";
                       if (selectedAnswer === null) {
                          cardClass += " cursor-pointer bg-slate-950/40 border-white/10 hover:border-cyan-400 hover:bg-slate-950/60";
                       } else {
                          cardClass += " cursor-default";
                          if (isCorrect) {
                             cardClass += " border-correct shadow-[0_0_20px_rgba(106,170,100,0.6)] bg-correct/10";
                          } else if (isSelected) {
                             cardClass += " border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.6)] bg-red-500/10";
                          } else {
                             cardClass += " border-white/5 bg-slate-950/20 opacity-40";
                          }
                       }

                       if (isOppSelected) {
                          cardClass += " ring-2 ring-pink-500 ring-offset-2 ring-offset-dark animate-pulse";
                       }

                       let buttonAnimate: TargetAndTransition | undefined = undefined;
                       let buttonTransition: Transition | undefined = undefined;

                       if (selectedAnswer !== null) {
                          if (isSelected && isCorrect) {
                             buttonAnimate = {
                                scale: [1, 1.1, 0.98, 1.02, 1],
                                rotate: [0, -2, 2, -1, 1, 0]
                             };
                             buttonTransition = { duration: 0.5, ease: "easeInOut" };
                          } else if (isSelected && !isCorrect) {
                             buttonAnimate = {
                                x: [0, -6, 6, -6, 6, 0]
                             };
                             buttonTransition = { duration: 0.4, ease: "linear" };
                          }
                       }

                       return (
                          <motion.button
                             key={choice}
                             disabled={selectedAnswer !== null || revealAnswers}
                             onClick={() => onChoiceSelect(choice)}
                             animate={buttonAnimate}
                             transition={buttonTransition}
                             className={cardClass}
                          >
                             <img
                                src={imageUrl}
                                alt={`Flag Option ${optionLetter}`}
                                className="w-full h-full object-cover rounded-lg"
                                loading="lazy"
                                draggable={false}
                             />

                             <div className="absolute top-1.5 left-1.5 bg-black/70 backdrop-blur-sm border border-white/10 text-white font-extrabold text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-md select-none">
                                {optionLetter}
                             </div>

                             <div className="absolute right-1.5 bottom-1.5 flex gap-1 items-center z-10">
                                {isSelected && (
                                   <span className="bg-correct text-black text-[8px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0 shadow">YOU</span>
                                )}
                                {isOppSelected && (
                                   <span className="bg-pink-500 text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0 shadow animate-bounce">
                                      {opponentName.slice(0, 5)}
                                   </span>
                                )}
                             </div>
                          </motion.button>
                       );
                    })}
                 </div>
              ) : (
                 <div className="grid grid-cols-2 gap-2 sm:gap-4 shrink-0">
                    {activeQuestion.choices.map((choice) => {
                       const isSelected = selectedAnswer === choice;
                       const isCorrect = choice === activeQuestion.answer;
                       const isOppSelected = revealAnswers && oppChoice === choice;

                       let btnClass = `p-3 sm:p-5 rounded-xl sm:rounded-2xl border text-center font-black uppercase tracking-wider ${choiceSizeClass} flex items-center justify-between min-h-[48px] sm:min-h-[64px] relative overflow-hidden`;
                       if (selectedAnswer === null) {
                          btnClass += " cursor-pointer bg-white/5 border-white/10 text-white hover:bg-white/10";
                       } else {
                          btnClass += " cursor-default";
                          if (isCorrect) {
                             btnClass += " bg-gradient-to-r from-correct/40 to-correct/60 border-correct text-white font-extrabold shadow-[0_0_25px_rgba(106,170,100,0.65)]";
                          } else if (isSelected) {
                             btnClass += " bg-gradient-to-r from-red-500/40 to-red-500/60 border-red-500 text-white font-extrabold shadow-[0_0_25px_rgba(239,68,68,0.65)]";
                          } else {
                             btnClass += " bg-white/5 border-white/10 text-gray-500 opacity-60";
                          }
                       }

                      if (isOppSelected) {
                         btnClass += " ring-2 ring-pink-500 ring-offset-2 ring-offset-dark animate-pulse";
                      }

                      let buttonAnimate: TargetAndTransition | undefined = undefined;
                      let buttonTransition: Transition | undefined = undefined;

                      if (selectedAnswer !== null) {
                         if (isSelected && isCorrect) {
                            buttonAnimate = {
                               scale: [1, 1.15, 0.95, 1.05, 1],
                               rotate: [0, -3, 3, -2, 2, 0],
                               boxShadow: [
                                  "0 0 0px rgba(106,170,100,0)",
                                  "0 0 45px rgba(106,170,100,0.95)",
                                  "0 0 20px rgba(106,170,100,0.5)",
                                  "0 0 0px rgba(106,170,100,0)"
                               ]
                            };
                            buttonTransition = { duration: 0.65, ease: "easeInOut" };
                         } else if (isSelected && !isCorrect) {
                            buttonAnimate = {
                               x: [0, -10, 10, -10, 10, -8, 8, -4, 4, 0],
                               scale: [1, 0.95, 1.02, 1],
                               boxShadow: [
                                  "0 0 0px rgba(239,68,68,0)",
                                  "0 0 35px rgba(239,68,68,0.95)",
                                  "0 0 10px rgba(239,68,68,0.4)",
                                  "0 0 0px rgba(239,68,68,0)"
                               ]
                            };
                            buttonTransition = { duration: 0.5, ease: "linear" };
                         }
                      }

                      return (
                         <motion.button
                            key={choice}
                            disabled={selectedAnswer !== null || revealAnswers}
                            onClick={() => onChoiceSelect(choice)}
                            animate={buttonAnimate}
                            transition={buttonTransition}
                            className={btnClass}
                         >
                            <span className="flex-1 text-center pr-8">{choice}</span>

                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 items-center z-10">
                               {isSelected && (
                                  <span className="bg-correct text-black text-[8px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0 shadow">YOU</span>
                               )}
                               {isOppSelected && (
                                  <span className="bg-pink-500 text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0 shadow animate-bounce">
                                     {opponentName.slice(0, 5)}
                                  </span>
                               )}
                            </div>
                         </motion.button>
                      );
                   })}
                </div>
             )}

             {/* Prefilled Quick Chat Row */}
             <div className="flex gap-2 sm:gap-3 overflow-x-auto py-2 sm:py-3 px-2 sm:px-3 scrollbar-hide shrink-0 items-center justify-start border-t border-white/5 bg-black/20 rounded-xl sm:rounded-2xl w-full mt-2 sm:mt-4">
                <span className="text-[9px] text-gray-500 font-black uppercase tracking-wider shrink-0 mr-1 sm:mr-1.5">Chat:</span>
                {PREFILLED_MESSAGES.map((msg) => (
                   <button
                      key={msg}
                      onClick={() => sendQuickChat(msg)}
                      className="bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 text-white text-[10px] sm:text-xs font-bold px-3 sm:px-4 py-1.5 sm:py-2 rounded-full shrink-0 transition-all cursor-pointer whitespace-nowrap"
                   >
                      {msg}
                   </button>
                ))}
             </div>
            </div>

         {/* Celebratory Confetti Splash */}
         {particles.length > 0 && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-50">
               {particles.map((p) => (
                  <motion.div
                     key={p.id}
                     initial={{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 }}
                     animate={{
                        x: p.targetX,
                        y: p.targetY,
                        scale: [0, 1.2, 0.8, 0],
                        opacity: [1, 1, 0.8, 0],
                        rotate: p.rotation + 360
                     }}
                     transition={{
                        duration: p.duration,
                        ease: "easeOut"
                     }}
                     style={{
                        position: "absolute",
                        width: p.size,
                        height: p.size,
                        backgroundColor: p.color,
                        borderRadius: p.shape === "circle" ? "50%" : p.shape === "triangle" ? "0" : "2px",
                        clipPath: p.shape === "triangle" ? "polygon(50% 0%, 0% 100%, 100% 100%)" : undefined
                     }}
                  />
               ))}
            </div>
         )}
      </motion.div>
   );
};
