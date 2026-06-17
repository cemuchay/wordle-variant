import { motion } from "framer-motion";
import { BOT_PROFILES, type WordUpQuestion } from "../../../../utils/wordupQuestionGenerator";
import { type ProfileStats } from "../types";

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
   role
}: BattleViewProps) => {
   const activeQuestion = questions[currentIdx];
   if (!activeQuestion) return null;

   return (
      <motion.div
         initial={{ opacity: 0 }}
         animate={{ opacity: 1 }}
         className="flex flex-col flex-1 justify-between h-full py-2"
      >
         {/* Players Panel */}
         <div className="grid grid-cols-2 gap-4 bg-white/5 border border-white/10 p-3 rounded-2xl shrink-0">
            <div className="flex items-center gap-2 min-w-0">
               <div className="w-8 h-8 rounded-full bg-correct/20 border border-correct/30 flex items-center justify-center text-xs font-black shrink-0">
                  YOU
               </div>
               <div className="truncate">
                  <p className="text-[9px] text-gray-400 font-bold uppercase">You</p>
                  <p className="text-sm font-black text-white">{matchData?.p1_score || 0} pts</p>
               </div>
            </div>
            <div className="flex items-center gap-2 min-w-0 justify-end text-right">
               <div className="truncate">
                  <p className="text-[9px] text-gray-400 font-bold uppercase truncate">
                     {matchData?.is_bot_match
                        ? (BOT_PROFILES[matchData.bot_profile]?.name || "Word Bot")
                        : (opponentStats ? "Opponent" : "Matching Bot")}
                  </p>
                  <p className="text-sm font-black text-white">{matchData?.p2_score || 0} pts</p>
               </div>
               <div className="w-8 h-8 rounded-full bg-pink-500/20 border border-pink-500/30 flex items-center justify-center text-xs font-black shrink-0">
                  {matchData?.is_bot_match ? "🤖" : "VS"}
               </div>
            </div>
         </div>

         {/* Score Indicators / Answer Status */}
         {(() => {
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

            return (
               <div className="flex justify-between items-center px-2 py-2 shrink-0">
                  <div className="flex items-center gap-1">
                     <span className={`w-2.5 h-2.5 rounded-full ${p1Color}`} />
                     <span className="text-[9px] text-gray-500 uppercase font-black">
                        {p1Status}
                     </span>
                  </div>
                  <span className="text-xs font-black text-gray-400">Round {currentIdx + 1} of 7</span>
                  <div className="flex items-center gap-1 justify-end">
                     <span className="text-[9px] text-gray-500 uppercase font-black">
                        {p2Status}
                     </span>
                     <span className={`w-2.5 h-2.5 rounded-full ${p2Color}`} />
                  </div>
               </div>
            );
         })()}

         {/* Timer Bar */}
         <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden shrink-0 shadow-inner">
            <div
               className={`h-full transition-all duration-75 ease-linear ${timeLeft > 3 ? "bg-correct shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"}`}
               style={{ width: `${(timeLeft / maxTime) * 100}%` }}
            />
         </div>

         {/* Question Container */}
         <div className="flex-1 flex flex-col justify-center gap-6 py-6 min-h-0">
            <div className="text-center space-y-2">
               <p className="text-[10px] font-black uppercase text-correct tracking-widest">
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

                  let btnClass = "bg-white/5 border-white/10 text-white hover:bg-white/10";
                  if (selectedAnswer !== null) {
                     if (isCorrect) {
                        btnClass = "bg-correct/20 border-correct text-correct font-black";
                     } else if (isSelected) {
                        btnClass = "bg-red-500/20 border-red-500 text-red-500 font-bold";
                     } else {
                        btnClass = "bg-white/5 border-white/10 text-gray-500 opacity-60";
                     }
                  }

                  return (
                     <button
                        key={choice}
                        disabled={selectedAnswer !== null || revealAnswers}
                        onClick={() => handleAnswerSelect(choice)}
                        className={`p-4 rounded-2xl border text-center font-black uppercase tracking-wider transition-all active:scale-95 text-xs flex items-center justify-center min-h-[56px] ${selectedAnswer === null ? "cursor-pointer" : "cursor-default"
                           } ${btnClass}`}
                     >
                        {choice}
                     </button>
                  );
               })}
            </div>
         </div>
      </motion.div>
   );
};
