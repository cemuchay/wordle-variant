import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BOT_PROFILES, type WordUpQuestion } from "../../../../utils/wordupQuestionGenerator";
import { type ProfileStats } from "../types";
import { getQuestionDuration } from "../hooks/useWordUpGameLoop";

interface BattleViewProps {
   questions: WordUpQuestion[];
   currentIdx: number;
   matchData: any;
   opponentStats: ProfileStats | null;
   timeLeft: number;
   maxTime: number;
   selectedAnswer: string | null;
   revealAnswers: boolean;
   handleAnswerSelect: (choice: string) => void;
   role: "player1" | "player2" | null;
   playerProfile: any | null;
   sendQuickChat: (text: string) => void;
}

const PREFILLED_MESSAGES = [
   "Good job! 👏",
   "You go see! 👀",
   "Wow! 🤯",
   "Nice! 🔥",
   "Oops 😅",
   "Close one! ⚡"
];

export const BattleView = ({
   questions,
   currentIdx,
   matchData,
   opponentStats,
   timeLeft: _timeLeft,
   maxTime,
   selectedAnswer,
   revealAnswers,
   handleAnswerSelect,
   role,
   playerProfile,
   sendQuickChat
}: BattleViewProps) => {
   const [triggerConfetti, setTriggerConfetti] = useState(false);
   const [particles, setParticles] = useState<any[]>([]);
   const [activeBubbles, setActiveBubbles] = useState<any[]>([]);

   useEffect(() => {
      setTriggerConfetti(false);
   }, [currentIdx]);

   useEffect(() => {
      if (triggerConfetti) {
         const COLORS = ["#4ade80", "#2ec871", "#facc15", "#38bdf8", "#ec4899", "#a855f7"];
         const SHAPES = ["circle", "square", "triangle"];
         const newParticles = Array.from({ length: 30 }).map((_, i) => {
            const angle = (i / 30) * 360 + (Math.random() * 20 - 10);
            const distance = 90 + Math.random() * 140;
            const rad = (angle * Math.PI) / 180;
            const targetX = Math.cos(rad) * distance;
            const targetY = Math.sin(rad) * distance;
            const size = 6 + Math.random() * 12;
            const color = COLORS[Math.floor(Math.random() * COLORS.length)];
            const rotation = Math.random() * 360;
            const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];

            return {
               id: i,
               targetX,
               targetY,
               size,
               color,
               rotation,
               shape
            };
         });
         setParticles(newParticles);
      } else {
         setParticles([]);
      }
   }, [triggerConfetti]);

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
               x: detail.senderRole === "player1" ? 15 + Math.random() * 30 : 55 + Math.random() * 30,
               y: 70 + Math.random() * 15
            };
            setActiveBubbles((prev) => [...prev, newBubble]);
            setTimeout(() => {
               setActiveBubbles((prev) => prev.filter((b) => b.id !== id));
            }, 2500);
         }
      };
      window.addEventListener("wordup-quick-chat", handleChat);
      return () => window.removeEventListener("wordup-quick-chat", handleChat);
   }, []);

   const activeQuestion = questions[currentIdx];
   if (!activeQuestion) return null;

   // Log question data at start and when round changes
   console.log(`[WordUp BattleView] Round ${currentIdx + 1}/7 — total questions:`, questions.length, "current:", activeQuestion.prompt, "choices:", activeQuestion.choices, "answer:", activeQuestion.answer);

   const qMaxTime = activeQuestion ? getQuestionDuration(activeQuestion.type) : maxTime || 10.0;

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

   const opponentName = opponentStats?.username || (matchData?.is_bot_match ? (BOT_PROFILES[matchData.bot_profile]?.name || "Word Bot") : "Opponent");

   const getAvatarUrl = (avatarUrl: string | null | undefined, seed: string) => {
      return avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed)}`;
   };

   // Resolve opponent choice
   const oppAnswers = isP1 ? matchData?.p2_answers : matchData?.p1_answers;
   const oppChoice = oppAnswers?.[currentIdx]?.choice;

   const onChoiceSelect = (choice: string) => {
      handleAnswerSelect(choice);
      if (choice === activeQuestion.answer) {
         setTriggerConfetti(true);
      }
   };

   return (
      <motion.div
         initial={{ opacity: 0 }}
         animate={{ opacity: 1 }}
         className="flex flex-col flex-1 justify-between h-full py-2 relative overflow-hidden"
      >
         {/* Floating Chat Bubbles */}
         <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
            <AnimatePresence>
               {activeBubbles.map((bubble) => (
                  <motion.div
                     key={bubble.id}
                     initial={{ opacity: 0, y: `${bubble.y}%`, scale: 0.8 }}
                     animate={{ opacity: 1, y: `${bubble.y - 40}%`, scale: 1 }}
                     exit={{ opacity: 0, scale: 0.9 }}
                     transition={{ duration: 2.2, ease: "easeOut" }}
                     style={{ left: `${bubble.x}%` }}
                     className="absolute -translate-x-1/2 bg-slate-900/90 text-white border border-white/20 px-3 py-1.5 rounded-2xl shadow-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap"
                  >
                     <span>{bubble.text}</span>
                  </motion.div>
               ))}
            </AnimatePresence>
         </div>

         {/* Players Panel */}
         <div className="grid grid-cols-2 gap-4 bg-white/5 border border-white/10 p-3 rounded-2xl shrink-0">
            <div className="flex items-center gap-2 min-w-0">
               <img
                  src={getAvatarUrl(playerProfile?.avatar_url, playerProfile?.username || "You")}
                  alt="You"
                  className="w-8 h-8 rounded-full border border-correct/30 object-cover shrink-0"
               />
               <div className="truncate">
                  <p className="text-[9px] text-gray-400 font-bold uppercase truncate">{playerProfile?.username || "You"}</p>
                  <p className="text-sm font-black text-white">{myScore} pts</p>
               </div>
            </div>
            <div className="flex items-center gap-2 min-w-0 justify-end text-right">
               <div className="truncate">
                  <p className="text-[9px] text-gray-400 font-bold uppercase truncate">
                     {opponentName}
                  </p>
                  <p className="text-sm font-black text-white">{oppScore} pts</p>
               </div>
               <img
                  src={getAvatarUrl(opponentStats?.avatar_url, opponentName)}
                  alt={opponentName}
                  className="w-8 h-8 rounded-full border border-pink-500/30 object-cover shrink-0"
               />
            </div>
         </div>

         {/* Score Indicators / Answer Status */}
         <div className="flex justify-between items-center px-2 py-2 shrink-0">
            <div className="flex items-center gap-1">
               <span className={`w-2.5 h-2.5 rounded-full ${myColor}`} />
               <span className="text-[9px] text-gray-500 uppercase font-black">
                  {myStatus}
               </span>
            </div>
            <div className="flex flex-col items-center">
               <span className="text-xs font-black text-gray-400">Round {currentIdx + 1} of 7</span>
               {currentIdx === 6 && (
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
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden shrink-0 shadow-inner">
             {!revealAnswers && (
                <motion.div
                   key={currentIdx}
                   initial={{ width: "100%", backgroundColor: "#4ade80", boxShadow: "0 0 8px rgba(34,197,94,0.5)" }}
                   animate={{
                      width: "0%",
                      backgroundColor: ["#4ade80", "#4ade80", "#ef4444"],
                      boxShadow: [
                         "0 0 8px rgba(34,197,94,0.5)",
                         "0 0 8px rgba(34,197,94,0.5)",
                         "0 0 8px rgba(239,68,68,0.5)"
                      ]
                   }}
                   transition={{
                      width: { duration: qMaxTime, ease: "linear" },
                      backgroundColor: {
                         times: [0, Math.max(0, qMaxTime - 3) / qMaxTime, 1],
                         duration: qMaxTime,
                         ease: "linear"
                      },
                      boxShadow: {
                         times: [0, Math.max(0, qMaxTime - 3) / qMaxTime, 1],
                         duration: qMaxTime,
                         ease: "linear"
                      }
                   }}
                   className="h-full rounded-full"
                />
             )}
          </div>

         {/* Question Container */}
         <div className="flex-1 flex flex-col justify-center gap-6 py-6 min-h-0">
            <div className="text-center space-y-2">
               <p className="text-[10px] font-black uppercase text-correct tracking-widest flex items-center justify-center gap-1">
                  {currentIdx === 6 && <span className="text-pink-500 animate-pulse font-black">⚡ DOUBLE POINTS -</span>}
                  {activeQuestion.type.replace("_", " ")}
               </p>
               <h2 className="text-xl font-black tracking-tight leading-relaxed text-white">
                  {activeQuestion.prompt}
               </h2>
               {activeQuestion.subPrompt && (
                  <p className="text-xs text-gray-400 bg-white/5 px-3 py-1 rounded-lg inline-block">
                     {activeQuestion.subPrompt}
                  </p>
               )}
            </div>

            {/* Choices Grid */}
            <div className="grid grid-cols-2 gap-3 shrink-0">
               {activeQuestion.choices.map((choice) => {
                  const isSelected = selectedAnswer === choice;
                  const isCorrect = choice === activeQuestion.answer;
                  const isOppSelected = revealAnswers && oppChoice === choice;

                  let btnClass = "p-4 rounded-2xl border text-center font-black uppercase tracking-wider text-xs flex items-center justify-between min-h-[56px] relative overflow-hidden";
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

                  let buttonAnimate: any = {};
                  let buttonTransition: any = {};

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
         </div>

         {/* Prefilled Quick Chat Row */}
         <div className="flex gap-2 overflow-x-auto py-2.5 px-2.5 scrollbar-hide shrink-0 items-center justify-start border-t border-white/5 bg-black/20 rounded-2xl w-full">
            <span className="text-[9px] text-gray-500 font-black uppercase tracking-wider shrink-0 mr-1.5">Chat:</span>
            {PREFILLED_MESSAGES.map((msg) => (
               <button
                  key={msg}
                  onClick={() => sendQuickChat(msg)}
                  className="bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 text-white text-[10px] font-bold px-3 py-1.5 rounded-full shrink-0 transition-all cursor-pointer whitespace-nowrap"
               >
                  {msg}
               </button>
            ))}
         </div>

         {/* Celebratory Confetti Splash */}
         {triggerConfetti && (
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
                        duration: 0.8 + Math.random() * 0.4,
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
