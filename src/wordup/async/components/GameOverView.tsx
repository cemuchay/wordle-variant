/* eslint-disable @typescript-eslint/no-explicit-any */
import { motion } from "framer-motion";
import { Award } from "lucide-react";
import { useAsyncStore } from "../store/useAsyncStore";
import { BOT_PROFILES } from "../../../utils/wordupQuestionGenerator";
import { getCachedFlagUrl } from "../../../utils/wordupQuestionPostProcessor";
import { ProtectedAvatar } from "../../../components/chat/ProtectedAvatar";
import { useApp } from "../../../context/AppContext";

interface GameOverViewProps {
   matchData: any;
   setView: (view: "menu") => void;
   role: "player1" | "player2" | null;
}

export const GameOverView = ({
   matchData,
   setView,
   role,
}: GameOverViewProps) => {
   const questions = useAsyncStore((s) => s.questions);
   const { profile: myProfile } = useApp();
   const opponentStats = useAsyncStore((s) => s.opponentStats);

   if (!matchData) return null;

   const guestId = localStorage.getItem("wordle_anon_id");
   const myAvatarUrl = myProfile?.avatar_url || (guestId ? `https://api.dicebear.com/7.x/bottts/svg?seed=${guestId}` : undefined);
   const myUsername = myProfile?.username || localStorage.getItem("wordle_anon_username") || "You";

   const opponentAvatarUrl = (matchData.is_bot_match
      ? `https://api.dicebear.com/7.x/bottts/svg?seed=${matchData.bot_profile || "average"}`
      : opponentStats?.avatar_url) ?? undefined;

   const isP1 = role === "player1";
   const myScore = isP1 ? matchData.p1_score : matchData.p2_score;
   const oppScore = isP1 ? matchData.p2_score : matchData.p1_score;
   const myAnswers = isP1 ? matchData.p1_answers : matchData.p2_answers;

   const isCompleted = matchData.status === "completed";
   const isWinner = myScore > oppScore;
   const isDraw = myScore === oppScore;

   const opponentName = opponentStats?.username || (matchData.is_bot_match
      ? (BOT_PROFILES[matchData.bot_profile]?.name || "Word Bot")
      : "Opponent");

   const statusColor = !isCompleted
      ? "text-yellow-500 border-yellow-500/20 bg-yellow-500/10 shadow-[0_0_15px_rgba(234,179,8,0.1)]"
      : isWinner
         ? "text-indigo-400 border-indigo-500/20 bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.1)]"
         : isDraw
            ? "text-yellow-500 border-yellow-500/20 bg-yellow-500/10 shadow-[0_0_15px_rgba(234,179,8,0.1)]"
            : "text-red-400 border-red-500/20 bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.1)]";

   const statusTextClass = !isCompleted ? "text-yellow-500" : isWinner ? "text-indigo-400" : isDraw ? "text-yellow-500" : "text-red-400";

   return (
      <motion.div
         initial={{ opacity: 0, scale: 0.95 }}
         animate={{ opacity: 1, scale: 1 }}
         className="flex flex-col flex-1 justify-center gap-6 py-4"
      >
         <div className="text-center space-y-1">
            <Award size={48} className={`mx-auto animate-bounce ${statusTextClass}`} />
            <h2 className={`text-2xl font-black uppercase tracking-wider ${statusTextClass}`}>
               {!isCompleted ? "Challenge Pending" : isWinner ? "Victory!" : isDraw ? "Draw!" : "Defeat"}
            </h2>
            <p className="text-xs text-gray-400 uppercase tracking-widest font-black">
               {!isCompleted ? "Waiting for Opponent" : "Match Completed"}
            </p>
         </div>

         {/* Side-by-Side Scores */}
         <div className="grid grid-cols-2 gap-4 bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
            <div className="flex flex-col items-center justify-center gap-1.5">
               <ProtectedAvatar
                  src={myAvatarUrl}
                  username={myUsername}
                  className="w-10 h-10 rounded-full"
               />
               <p className="text-[10px] text-gray-500 font-black uppercase">You</p>
               <p className="text-2xl font-black text-white">{myScore} pts</p>
            </div>
            <div className="border-l border-white/10 flex flex-col items-center justify-center gap-1.5">
               <ProtectedAvatar
                  src={opponentAvatarUrl}
                  username={opponentName}
                  className="w-10 h-10 rounded-full"
               />
               <p className="text-[10px] text-gray-500 font-black uppercase">{opponentName}</p>
               <p className="text-2xl font-black text-white">{oppScore} pts</p>
            </div>
         </div>

         {/* Rewards and Elo changes */}
         <div className={`border rounded-2xl p-4 text-center space-y-1 ${statusColor}`}>
            <p className="text-xs font-bold uppercase tracking-wider">
               {!isCompleted ? "Rating & XP will calculate upon completion" : `Rating Change: ${isWinner ? "+18 Elo Rating" : isDraw ? "+2 Elo" : "-12 Elo Rating"}`}
            </p>
            {isCompleted && (
               <p className="text-[10px] text-gray-400 uppercase font-black">
                  Earned: +{50 + (isWinner ? 100 : 0) + ((myAnswers || []).filter((a: any) => a.correct).length * 10)} XP
               </p>
            )}
         </div>

         {/* Play Again / Lobby */}
         <div className="grid grid-cols-2 gap-3">
            <button
               onClick={() => setView("menu")}
               className="bg-indigo-500 hover:bg-indigo-500/90 text-black font-black uppercase py-4 rounded-xl tracking-widest shadow-lg cursor-pointer hover:scale-102 active:scale-98 transition-all animate-pulse"
            >
               Play Again
            </button>
            <button
               onClick={() => setView("menu")}
               className="bg-white/10 hover:bg-white/15 text-white font-black uppercase py-4 rounded-xl tracking-widest shadow-lg cursor-pointer hover:scale-102 active:scale-98 transition-all border border-white/10"
            >
               Return to Lobby
            </button>
         </div>

         {/* Round Breakdown */}
         {questions && questions.length > 0 && (
            <div className="space-y-4 bg-white/5 border border-white/10 rounded-2xl p-4 mt-2">
               <h3 className="text-xs font-black uppercase text-gray-400 tracking-wider border-b border-white/10 pb-2 text-left">
                  Round Breakdown
               </h3>
               <div className="divide-y divide-white/5">
                  {questions.map((q: any, idx: number) => {
                     const p1Ans = matchData.p1_answers?.find((a: any) => a.question_idx === idx);
                     const p2Ans = matchData.p2_answers?.find((a: any) => a.question_idx === idx);

                     const myAns = isP1 ? p1Ans : p2Ans;
                     const oppAns = isP1 ? p2Ans : p1Ans;

                     return (
                        <div key={idx} className="py-3 first:pt-0 last:pb-0 space-y-2 text-left">
                           <div className="flex justify-between items-baseline">
                              <span className="text-[10px] font-black text-indigo-400 uppercase">Round {idx + 1}</span>
                              <span className="text-[9px] text-gray-500 font-bold uppercase">{q.type.replace("_", " ")}</span>
                           </div>
                           <p className="text-xs font-bold text-white leading-relaxed">{q.prompt}</p>
                           {q.subPrompt && (
                              <p className="text-[10px] text-gray-400 bg-white/5 px-2 py-0.5 rounded inline-block">
                                 {q.subPrompt}
                              </p>
                           )}
                           {q.imageUrl && (
                              <div className="flex justify-center py-1">
                                 <div className="w-full max-w-[120px] h-[70px] rounded-lg overflow-hidden border border-white/10 bg-slate-950/60 flex items-center justify-center">
                                    <img
                                       src={q.imageUrl.length === 2 ? getCachedFlagUrl(q.imageUrl) : q.imageUrl}
                                       alt="Question Clue"
                                       className="max-h-full max-w-full object-contain rounded"
                                       draggable={false}
                                    />
                                 </div>
                              </div>
                           )}
                           {q.imageUrls && q.imageUrls.length > 0 && (
                              <div className="grid grid-cols-2 gap-1.5 py-1">
                                 {q.imageUrls.map((code: string, i: number) => (
                                    <div
                                       key={i}
                                       className={`rounded-lg overflow-hidden border ${q.choices[i] === q.answer
                                             ? "border-indigo-500 ring-1 ring-indigo-500"
                                             : "border-white/10"
                                          } bg-slate-950/60 flex items-center justify-center aspect-2/1`}
                                    >
                                       <img
                                          src={getCachedFlagUrl(code)}
                                          alt={`Choice ${String.fromCharCode(65 + i)}`}
                                          className="w-full h-full object-cover"
                                          draggable={false}
                                       />
                                    </div>
                                 ))}
                              </div>
                           )}
                           <p className="text-[10px] text-gray-400 mt-1">
                              Correct Answer: <span className="text-indigo-400 font-extrabold">{q.answer}</span>
                           </p>
                           {q.explanation && (
                              <p className="text-[10px] text-gray-300 bg-white/5 px-2 py-1 rounded italic mt-1 leading-relaxed">
                                 💡 {q.explanation}
                              </p>
                           )}
                           <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
                              <div className="bg-white/5 p-2 rounded-lg space-y-0.5 border border-white/5">
                                 <p className="font-black text-gray-500 uppercase">You</p>
                                 <p className="font-bold text-white truncate">
                                    Played: <span className={myAns?.correct ? "text-indigo-400" : "text-red-400"}>{myAns?.choice || "No Answer"}</span>
                                 </p>
                                 <p className="text-gray-400 font-black">+{myAns?.points || 0} pts ({myAns?.time_taken || 0}s)</p>
                              </div>
                              <div className="bg-white/5 p-2 rounded-lg space-y-0.5 border border-white/5">
                                 <p className="font-black text-gray-500 uppercase">{opponentName}</p>
                                 <p className="font-bold text-white truncate">
                                    Played: <span className={oppAns?.correct ? "text-indigo-400" : "text-red-400"}>{oppAns?.choice || "No Answer"}</span>
                                 </p>
                                 <p className="text-gray-400 font-black">+{oppAns?.points || 0} pts ({oppAns?.time_taken || 0}s)</p>
                              </div>
                           </div>
                        </div>
                     );
                  })}
               </div>
            </div>
         )}
      </motion.div>
   );
};
