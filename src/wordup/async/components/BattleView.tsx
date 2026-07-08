import { useState, useEffect, useRef, Fragment } from "react";
import { motion } from "framer-motion";
import type { TargetAndTransition, Transition } from "framer-motion";
import { BOT_PROFILES, type WordUpQuestion } from "../../../utils/wordupQuestionGenerator";
import { getCachedFlagUrl } from "../../../utils/wordupQuestionPostProcessor";
import { type ProfileStats } from "../../shared/types";
import { FormulaRenderer } from "../../shared/FormulaRenderer";
import { PreloadedImage } from "../../shared/PreloadedImage";
import { ProtectedAvatar } from "../../../components/chat/ProtectedAvatar";
import { ScoreBar } from "../../shared/ScoreBar";
import { CATEGORIES } from "../../shared/constants";
import { WORDUP_GAME, CONFETTI, PROMPT_FONT_SIZE, CHOICE_FONT_SIZE } from "../../../constants/wordup";

interface MatchData {
   p1_score?: number;
   p2_score?: number;
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
   maxTime: number;
   selectedAnswer: string | null;
   revealAnswers: boolean;
   handleAnswerSelect: (choice: string) => void;
   role: "player1" | "player2" | null;
   playerProfile: PlayerProfile | null;
   onAbort?: () => void;
   lastRoundPopup: boolean;
}

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

export const BattleView = ({
   questions,
   currentIdx,
   matchData,
   opponentStats,
   maxTime,
   selectedAnswer,
   revealAnswers,
   handleAnswerSelect,
   role,
   playerProfile,
   lastRoundPopup
}: BattleViewProps) => {
   const [particles, setParticles] = useState<Particle[]>([]);

   useEffect(() => {
      setParticles([]);
      setScorePopups([]);
   }, [currentIdx]);

   const [scorePopups, setScorePopups] = useState<Array<{ id: number; points: number; side: "my" | "opp" }>>([]);
   const prevMyScoreRef = useRef(0);
   const prevOppScoreRef = useRef(0);
   const popupIdRef = useRef(0);
   const timerBarRef = useRef<HTMLDivElement | null>(null);

   const activeQuestion = questions[currentIdx];

   const isP1 = role === "player1";
   const myScore = isP1 ? (matchData?.p1_score || 0) : (matchData?.p2_score || 0);
   const oppScore = isP1 ? (matchData?.p2_score || 0) : (matchData?.p1_score || 0);

   useEffect(() => {
      if (myScore > prevMyScoreRef.current) {
         const diff = myScore - prevMyScoreRef.current;
         popupIdRef.current += 1;
         const newPopup = { id: popupIdRef.current, points: diff, side: "my" as const };
         setScorePopups((p) => [...p, newPopup]);
         setTimeout(() => setScorePopups((p) => p.filter((x) => x.id !== newPopup.id)), 3000);
      }
      if (oppScore > prevOppScoreRef.current) {
         const diff = oppScore - prevOppScoreRef.current;
         popupIdRef.current += 1;
         const newPopup = { id: popupIdRef.current, points: diff, side: "opp" as const };
         setScorePopups((p) => [...p, newPopup]);
         setTimeout(() => setScorePopups((p) => p.filter((x) => x.id !== newPopup.id)), 3000);
      }
      prevMyScoreRef.current = myScore;
      prevOppScoreRef.current = oppScore;
   }, [myScore, oppScore]);

   const opponentName = opponentStats?.username || (matchData?.is_bot_match ? ((matchData.bot_profile && BOT_PROFILES[matchData.bot_profile]?.name) || "Word Bot") : "Opponent");

   const categoryName = CATEGORIES.find((c) => c.id === matchData?.category)?.name || matchData?.category?.replace(/_/g, " ") || "";

   const oppAnswers = isP1 ? matchData?.p2_answers : matchData?.p1_answers;
   const oppChoice = oppAnswers?.[currentIdx]?.choice;

   const qMaxTime = maxTime || 10.0;

   useEffect(() => {
      const bar = timerBarRef.current;
      if (!bar || revealAnswers || !activeQuestion) return;

      bar.style.transition = "none";
      bar.style.width = "100%";
      bar.style.backgroundColor = "#818cf8";
      bar.style.boxShadow = "0 0 8px #818cf8";

      void bar.offsetHeight;

      bar.style.transition = `width ${qMaxTime}s linear, background-color ${qMaxTime}s linear, box-shadow ${qMaxTime}s linear`;
      bar.style.width = "0%";
      bar.style.backgroundColor = "#ef4444";
      bar.style.boxShadow = "0 0 8px #ef4444";
   }, [currentIdx, revealAnswers, qMaxTime, activeQuestion]);

   useEffect(() => {
      const bar = timerBarRef.current;
      if (!bar) return;

      if (selectedAnswer !== null) {
         const computedStyle = window.getComputedStyle(bar);
         const currentWidth = computedStyle.width;
         const currentColor = computedStyle.backgroundColor;
         const currentBoxShadow = computedStyle.boxShadow;

         bar.style.transition = "none";
         bar.style.width = currentWidth;
         bar.style.backgroundColor = currentColor;
         bar.style.boxShadow = currentBoxShadow;
      }
   }, [selectedAnswer]);

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
            return { id: i, targetX, targetY, size, color, rotation, shape, duration };
         });
         setParticles(newParticles);
      }
   };

   if (!activeQuestion) return null;

   const promptLen = activeQuestion.prompt.length;
   const promptSizeClass = promptLen > PROMPT_FONT_SIZE.LONG_THRESHOLD ? "text-lg sm:text-xl" : promptLen > PROMPT_FONT_SIZE.MEDIUM_THRESHOLD ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl";

   const maxChoiceLen = Math.max(...activeQuestion.choices.map((c) => c.length), 0);
   const longChoice = maxChoiceLen > CHOICE_FONT_SIZE.LONG_THRESHOLD;
   const medChoice = maxChoiceLen > CHOICE_FONT_SIZE.MEDIUM_THRESHOLD;
   const choiceBase = longChoice ? "a" : medChoice ? "b" : "c";
   const choiceLUT: Record<string, Record<string, string>> = {
      a: { "2": "text-xs sm:text-sm", "4": "text-[10px] sm:text-xs" },
      b: { "2": "text-sm sm:text-base", "4": "text-xs sm:text-sm" },
      c: { "2": "text-base sm:text-lg", "4": "text-sm sm:text-base" },
   };
   const isFewChoices = activeQuestion.choices.length <= 2;
   const choiceSizeClass = choiceLUT[choiceBase][isFewChoices ? "2" : "4"];

   const choicesGapClass = activeQuestion.choices.length <= 2 ? "gap-4 sm:gap-6" : "gap-1 sm:gap-2 md:gap-3";

   return (
      <motion.div
         initial={{ opacity: 0 }}
         animate={{ opacity: 1 }}
           className="flex flex-col flex-1 justify-between h-full pt-3 pb-0 relative overflow-hidden"
      >
         {lastRoundPopup && (
            <motion.div
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               transition={{ duration: 0.4 }}
               className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-dark pointer-events-none select-none"
            >
               <motion.p
                  initial={{ scale: 2, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="text-3xl sm:text-4xl font-black text-white tracking-widest drop-shadow-[0_0_20px_rgba(255,255,255,0.6)]"
               >
                  ⚡ LAST ROUND ⚡
               </motion.p>
               <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.4 }}
                  className="text-sm sm:text-base font-black text-pink-500 mt-2 animate-pulse tracking-wider"
               >
                  DOUBLE POINTS
               </motion.p>
            </motion.div>
         )}

          {/* Top Bar: Player | Round/Category | Opponent */}
          <div className="flex items-center justify-between gap-1 sm:gap-2 px-1 shrink-0 z-40">
             <div className="flex items-center gap-2 min-w-0 relative">
                <ProtectedAvatar
                   userId={playerProfile?.id || undefined}
                   src={playerProfile?.avatar_url || undefined}
                   username={playerProfile?.username || "You"}
                   className="w-10 h-10 rounded-full border border-indigo-500/30 shrink-0"
                />
                <div className="truncate">
                   <p className="text-[9px] text-gray-400 font-bold uppercase truncate">{playerProfile?.username || "You"}</p>
                   <p className="text-base font-black text-white">{myScore} pts</p>
                </div>
                {scorePopups.filter((p) => p.side === "my").map((p) => (
                   <motion.span
                      key={p.id}
                      initial={{ opacity: 0, y: 0, scale: 0.5 }}
                      animate={{ opacity: [0, 1, 1, 0], y: [-10, -30, -50], scale: [0.5, 1.3, 1] }}
                      transition={{ duration: 2.5, ease: "easeOut" }}
                      className="absolute -top-1 right-0 text-indigo-400 font-black text-sm sm:text-base drop-shadow-[0_0_8px_rgba(99,102,241,0.8)] pointer-events-none"
                   >
                      +{p.points}
                   </motion.span>
                ))}
             </div>

             <div className="flex flex-col items-center">
                {categoryName && (
                   <span className="text-[9px] font-black text-cyan-400 uppercase tracking-wider mb-0.5">{categoryName}</span>
                )}
                <span className="text-xs font-black text-gray-400">Q{currentIdx + 1}/{WORDUP_GAME.TOTAL_ROUNDS}</span>
                {currentIdx === WORDUP_GAME.TOTAL_ROUNDS - 1 && (
                   <span className="text-[9px] font-black text-pink-500 animate-pulse tracking-wider">⚡ 2X</span>
                )}
             </div>

             <div className="flex items-center gap-2 min-w-0 justify-end text-right relative">
                <div className="truncate">
                   <p className="text-[9px] text-gray-400 font-bold uppercase truncate">{opponentName}</p>
                   <p className="text-base font-black text-white">{oppScore} pts</p>
                </div>
                {scorePopups.filter((p) => p.side === "opp").map((p) => (
                   <motion.span
                      key={p.id}
                      initial={{ opacity: 0, y: 0, scale: 0.5 }}
                      animate={{ opacity: [0, 1, 1, 0], y: [-10, -30, -50], scale: [0.5, 1.3, 1] }}
                      transition={{ duration: 2.5, ease: "easeOut" }}
                      className="absolute -top-1 left-0 text-pink-400 font-black text-sm sm:text-base drop-shadow-[0_0_8px_rgba(236,72,153,0.8)] pointer-events-none"
                   >
                      +{p.points}
                   </motion.span>
                ))}
                <ProtectedAvatar
                   userId={matchData?.is_bot_match ? undefined : ((isP1 ? matchData?.player2_id : matchData?.player1_id) || undefined)}
                   src={matchData?.is_bot_match ? `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(opponentName)}` : (opponentStats?.avatar_url || undefined)}
                   username={opponentName}
                   className="w-10 h-10 rounded-full border border-pink-500/30 shrink-0"
                />
             </div>
          </div>

          {/* Timer Bar */}
          <div className="w-full h-2 bg-indigo-500/20 rounded-full overflow-hidden shrink-0 shadow-inner">
             {!revealAnswers && (
                <div
                   ref={timerBarRef}
                   className="h-full rounded-full"
                />
             )}
           </div>

           {/* Question Container */}
           <div className={`relative flex-1 flex flex-col justify-center ${choicesGapClass} py-0 sm:py-2 md:py-4 overflow-y-auto scrollbar-hide min-h-0`}>
            <div className="text-center space-y-1 sm:space-y-2">
               <p className="text-[9px] sm:text-[10px] font-black uppercase text-indigo-400 tracking-widest flex items-center justify-center gap-1">
                  {currentIdx === WORDUP_GAME.TOTAL_ROUNDS - 1 && <span className="text-pink-500 animate-pulse font-black">⚡ DOUBLE POINTS -</span>}
                  {(activeQuestion.type || "definition").replace("_", " ")}
               </p>
                <h2 className={`${promptSizeClass} text-white whitespace-pre-line leading-relaxed`}>
                  <FormulaRenderer text={activeQuestion.prompt} />
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
                     className="w-full max-w-[200px] h-[90px] sm:max-w-[130px] sm:h-[72px] rounded-xl overflow-hidden border border-white/10 bg-slate-950/45 flex items-center justify-center p-1 shadow-inner"
                  >
                      <PreloadedImage
                         src={activeQuestion.imageUrl.length === 2 ? getCachedFlagUrl(activeQuestion.imageUrl) : activeQuestion.imageUrl}
                         alt="Question Clue"
                         className="max-h-full max-w-full object-contain rounded-lg select-none"
                         draggable={false}
                      />
                  </motion.div>
               </div>
            )}

            {activeQuestion.imageUrls && activeQuestion.imageUrls.length > 0 ? (
               <div className="relative grid grid-cols-2 gap-2 sm:gap-4 shrink-0 sm:max-w-[300px] sm:mx-auto px-5 min-h-[180px]">
                  <div className="absolute inset-y-0 left-0 flex items-center z-40 pointer-events-none">
                     <ScoreBar score={myScore} latestCorrect={revealAnswers ? selectedAnswer === activeQuestion.answer : undefined} side="left" themeColor="bg-indigo-500" />
                  </div>
                  <div className="absolute inset-y-0 right-0 flex items-center z-40 pointer-events-none">
                     <ScoreBar score={oppScore} latestCorrect={revealAnswers ? oppChoice === activeQuestion.answer : undefined} side="right" themeColor="bg-pink-500" />
                  </div>
                  {activeQuestion.choices.map((choice, index) => {
                     const isSelected = selectedAnswer === choice;
                     const isCorrect = choice === activeQuestion.answer;
                     const isOppSelected = revealAnswers && oppChoice === choice;
                     const flagCode = activeQuestion.imageUrls?.[index] || choice;
                     const imageUrl = getCachedFlagUrl(flagCode);
                     const optionLetter = String.fromCharCode(65 + index);

                     let cardClass = "relative w-full aspect-[2/1] xs:aspect-[1.8/1] sm:aspect-[1.5/1] rounded-xl sm:rounded-2xl border-2 overflow-hidden flex flex-col items-center justify-center p-2 transition-all shadow-md select-none shrink-0 ";
                     if (selectedAnswer === null) {
                        cardClass += " cursor-pointer bg-white border-gray-200 hover:border-cyan-400 hover:bg-gray-50";
                     } else {
                        cardClass += " cursor-default";
                        if (isCorrect) {
                           cardClass += " border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.6)] bg-indigo-500/10";
                        } else if (isSelected) {
                           cardClass += " border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.6)] bg-red-500/10";
                        } else {
                           cardClass += " border-gray-200 bg-gray-100 opacity-40";
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
                            <PreloadedImage
                               src={imageUrl}
                               alt={`Flag Option ${optionLetter}`}
                               className="w-full h-full object-cover rounded-lg"
                               draggable={false}
                            />
                           <div className="absolute top-1.5 left-1.5 bg-black/70 backdrop-blur-sm border border-white/10 text-white font-extrabold text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-md select-none">
                              {optionLetter}
                           </div>
                           <div className="absolute right-1.5 bottom-1.5 flex gap-1 items-center z-10">
                              {isSelected && (
                                 <span className="bg-indigo-500 text-black text-[8px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0 shadow">YOU</span>
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
               <div className="relative flex flex-col gap-2 sm:gap-3 w-full max-w-md mx-auto shrink-0 px-5 min-h-[180px]">
                  <div className="absolute inset-y-0 left-0 flex items-center z-40 pointer-events-none">
                     <ScoreBar score={myScore} latestCorrect={revealAnswers ? selectedAnswer === activeQuestion.answer : undefined} side="left" themeColor="bg-indigo-500" />
                  </div>
                  <div className="absolute inset-y-0 right-0 flex items-center z-40 pointer-events-none">
                     <ScoreBar score={oppScore} latestCorrect={revealAnswers ? oppChoice === activeQuestion.answer : undefined} side="right" themeColor="bg-pink-500" />
                  </div>
                  {activeQuestion.choices.map((choice) => {
                     const isSelected = selectedAnswer === choice;
                     const isCorrect = choice === activeQuestion.answer;
                     const isOppSelected = revealAnswers && oppChoice === choice;

                     let btnClass = `p-4 sm:p-6 rounded-xl sm:rounded-2xl border-2 text-center font-black uppercase tracking-wider ${choiceSizeClass} flex items-center justify-center text-center min-h-[48px] sm:min-h-[64px] relative overflow-hidden`;
                     if (selectedAnswer === null) {
                        btnClass += " cursor-pointer bg-white border-gray-200 text-gray-900 hover:bg-gray-100";
                     } else {
                        btnClass += " cursor-default";
                        if (isCorrect) {
                           btnClass += " bg-gradient-to-r from-indigo-500/40 to-indigo-500/60 border-indigo-500 text-white font-extrabold shadow-[0_0_25px_rgba(99,102,241,0.65)]";
                        } else if (isSelected) {
                           btnClass += " bg-gradient-to-r from-red-500/40 to-red-500/60 border-red-500 text-white font-extrabold shadow-[0_0_25px_rgba(239,68,68,0.65)]";
                        } else {
                           btnClass += " bg-gray-100 border-gray-200 text-gray-400 opacity-60";
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
                                 "0 0 0px rgba(99,102,241,0)",
                                 "0 0 45px rgba(99,102,241,0.95)",
                                 "0 0 20px rgba(99,102,241,0.5)",
                                 "0 0 0px rgba(99,102,241,0)"
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
                           <span className="text-center">
                              <FormulaRenderer text={choice} />
                           </span>

                           <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 items-center z-10">
                              {isSelected && (
                                 <span className="bg-indigo-500 text-black text-[8px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0 shadow">YOU</span>
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

          {/* Pre-render upcoming round images to keep decoded bitmaps ready */}
          <div aria-hidden="true" className="absolute inset-0 pointer-events-none opacity-0 -z-10">
             {questions.map((q, idx) => {
                if (idx <= currentIdx) return null;
                return (
                   <Fragment key={idx}>
                      {q.imageUrl && (
                         <img src={q.imageUrl.length === 2 ? getCachedFlagUrl(q.imageUrl) : q.imageUrl} alt="" />
                      )}
                      {q.imageUrls?.map((url, i) => (
                         <img key={`${idx}-${i}`} src={getCachedFlagUrl(url)} alt="" />
                      ))}
                   </Fragment>
                );
             })}
          </div>
       </motion.div>
   );
};
