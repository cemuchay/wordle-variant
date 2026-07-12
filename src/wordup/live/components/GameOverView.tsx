/* eslint-disable @typescript-eslint/no-explicit-any */
import { motion } from "framer-motion";
import { Award, Cpu } from "lucide-react";
import { useLiveStore } from "../store/useLiveStore";
import { BOT_PROFILES } from "../../../utils/wordupQuestionGenerator";
import { getCachedFlagUrl } from "../../../utils/wordupQuestionPostProcessor";
import { ProtectedAvatar } from "../../../components/chat/ProtectedAvatar";
import { useApp } from "../../../context/AppContext";

interface GameOverViewProps {
   matchData: any;
   setView: (view: "menu" | "matchmaking" | "playbot") => void;
   role: "player1" | "player2" | null;
   rematchState: "idle" | "sent" | "received" | "expired";
   rematchCountdown: number;
   showRematchButton: boolean;
   sendRematch: () => void;
   acceptRematch: () => void;
}

export const GameOverView = ({
   matchData,
   setView,
   role,
   rematchState,
   rematchCountdown,
   showRematchButton,
   sendRematch,
   acceptRematch
}: GameOverViewProps) => {
   const questions = useLiveStore((s) => s.questions);
   const { profile: myProfile } = useApp();
   const opponentStats = useLiveStore((s) => s.opponentStats);

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

   const isWinner = myScore > oppScore;
   const isDraw = myScore === oppScore;

   const opponentName = opponentStats?.username || (matchData.is_bot_match
      ? (BOT_PROFILES[matchData.bot_profile]?.name || "Word Bot")
      : "Opponent");

   const statusColor = isWinner 
      ? "text-correct border-correct/20 bg-correct/10 shadow-[0_0_15px_rgba(46,204,113,0.1)]"
      : isDraw 
         ? "text-yellow-500 border-yellow-500/20 bg-yellow-500/10 shadow-[0_0_15px_rgba(234,179,8,0.1)]"
         : "text-red-400 border-red-500/20 bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.1)]";

   const statusTextClass = isWinner ? "text-correct" : isDraw ? "text-yellow-500" : "text-red-400";

   return (
      <motion.div
         initial={{ opacity: 0, scale: 0.95 }}
         animate={{ opacity: 1, scale: 1 }}
         className="flex flex-col flex-1 justify-center gap-6 py-4"
      >
         <div className="text-center space-y-1">
            <Award size={48} className={`mx-auto animate-bounce ${statusTextClass}`} />
            <h2 className={`text-2xl font-black uppercase tracking-wider ${statusTextClass}`}>
               {isWinner ? "Victory!" : isDraw ? "Draw!" : "Defeat"}
            </h2>
            <p className="text-xs text-gray-400 uppercase tracking-widest font-black">Match Completed</p>
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
               <p className="text-[10px] text-gray-500 font-black uppercase">
                  {opponentName}
               </p>
               <p className="text-2xl font-black text-white">{oppScore} pts</p>
            </div>
         </div>

         {/* Rewards and Elo changes */}
         <div className={`border rounded-2xl p-4 text-center space-y-1 ${statusColor}`}>
            <p className="text-xs font-bold uppercase tracking-wider">
               Rating Change: {isWinner ? "+18 Elo Rating" : isDraw ? "+2 Elo" : "-12 Elo Rating"}
            </p>
            <p className="text-[10px] text-gray-400 uppercase font-black">
               Earned: +{50 + (isWinner ? 100 : 0) + ((myAnswers || []).filter((a: any) => a.correct).length * 10)} XP
            </p>
         </div>

         {/* Rematch Actions */}
         {!matchData.is_bot_match && showRematchButton && (
            <div className="space-y-3">
               {rematchState === "idle" && (
                  <button
                     onClick={sendRematch}
                     className="w-full bg-pink-500 hover:bg-pink-600 text-white font-black uppercase py-4 rounded-xl flex items-center justify-center gap-2 tracking-widest shadow-lg cursor-pointer hover:scale-102 active:scale-98 transition-all"
                  >
                     🤝 Request Rematch
                  </button>
               )}
               {rematchState === "sent" && (
                  <div className="w-full bg-white/5 border border-white/10 text-gray-400 font-black uppercase py-4 rounded-xl flex flex-col items-center justify-center gap-1 tracking-widest animate-pulse relative overflow-hidden">
                     <span className="flex items-center gap-2">⏳ Waiting for Opponent ({rematchCountdown}s)</span>
                     <div 
                        className="absolute bottom-0 left-0 h-1 bg-pink-500/40 transition-all duration-1000 ease-linear"
                        style={{ width: `${(rematchCountdown / 20) * 100}%` }}
                     />
                  </div>
               )}
               {rematchState === "received" && (
                  <button
                     onClick={acceptRematch}
                     className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-black uppercase py-4 rounded-xl flex flex-col items-center justify-center gap-1 tracking-widest shadow-lg cursor-pointer animate-bounce hover:scale-102 active:scale-98 transition-all relative overflow-hidden"
                  >
                     <span className="flex items-center gap-2">🔥 Accept Rematch! ({rematchCountdown}s)</span>
                     <div 
                        className="absolute bottom-0 left-0 h-1 bg-black/20 transition-all duration-1000 ease-linear"
                        style={{ width: `${(rematchCountdown / 20) * 100}%` }}
                     />
                  </button>
               )}
               {rematchState === "expired" && (
                  <div className="w-full bg-red-500/10 border border-red-500/20 text-red-500 font-black uppercase py-4 rounded-xl flex items-center justify-center gap-2 tracking-widest">
                     ❌ Rematch Expired
                  </div>
               )}
            </div>
         )}

          {/* Play Again / Lobby */}
          <div className="grid grid-cols-2 gap-3">
             <button
                onClick={() => setView("matchmaking")}
                className="bg-correct hover:bg-correct/90 text-black font-black uppercase py-4 rounded-xl tracking-widest shadow-lg cursor-pointer hover:scale-102 active:scale-98 transition-all animate-pulse"
             >
                Play Again
             </button>
             <button
                onClick={() => setView("playbot")}
                className="bg-blue-600 hover:bg-blue-700 text-white font-black uppercase py-4 rounded-xl flex items-center justify-center gap-2 tracking-widest shadow-lg cursor-pointer hover:scale-102 active:scale-98 transition-all"
             >
                <Cpu size={16} className="stroke-3" />
                <span>Practice vs Bot</span>
             </button>
          </div>
          <button
             onClick={() => setView("menu")}
             className="w-full bg-white/10 hover:bg-white/15 text-white font-black uppercase py-4 rounded-xl tracking-widest shadow-lg cursor-pointer hover:scale-102 active:scale-98 transition-all border border-white/10"
          >
             Return to Lobby
          </button>

         {/* Round Breakdown */}
         {questions && questions.length > 0 && (
            <div className="space-y-4 bg-white/5 border border-white/10 rounded-2xl p-4 mt-2">
               <h3 className="text-xs font-black uppercase text-gray-400 tracking-wider border-b border-white/10 pb-2 text-left">
                  Round Breakdown
               </h3>
               <div className="divide-y divide-white/5">
                  {questions.map((q, idx) => {
                     const p1Ans = matchData.p1_answers?.find((a: any) => a.question_idx === idx);
                     const p2Ans = matchData.p2_answers?.find((a: any) => a.question_idx === idx);
                     
                     const myAns = isP1 ? p1Ans : p2Ans;
                     const oppAns = isP1 ? p2Ans : p1Ans;

                     return (
                        <div key={idx} className="py-3 first:pt-0 last:pb-0 space-y-2 text-left">
                           <div className="flex justify-between items-baseline">
                              <span className="text-[10px] font-black text-correct uppercase">Round {idx + 1}</span>
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
                                  {q.imageUrls.map((code, i) => (
                                     <div
                                        key={i}
                                        className={`rounded-lg overflow-hidden border ${
                                           q.choices[i] === q.answer
                                              ? "border-correct ring-1 ring-correct"
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
                                Correct Answer: <span className="text-correct font-extrabold">{q.answer}</span>
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
                                    Played: <span className={myAns?.correct ? "text-correct" : "text-red-400"}>{myAns?.choice || "No Answer"}</span>
                                 </p>
                                 <p className="text-gray-400 font-black">+{myAns?.points || 0} pts ({myAns?.time_taken || 0}s)</p>
                              </div>
                              <div className="bg-white/5 p-2 rounded-lg space-y-0.5 border border-white/5">
                                 <p className="font-black text-gray-500 uppercase">{opponentName}</p>
                                 <p className="font-bold text-white truncate">
                                    Played: <span className={oppAns?.correct ? "text-correct" : "text-red-400"}>{oppAns?.choice || "No Answer"}</span>
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
