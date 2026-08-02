import { useState } from "react";
import { motion } from "framer-motion";
import { Award, ArrowLeft, Home, Loader2 } from "lucide-react";
import { useLiveStore } from "../store/useLiveStore";
import { BOT_PROFILES } from "../../../utils/wordupQuestionGenerator";
import { getCachedFlagUrl } from "../../../utils/wordupQuestionPostProcessor";
import { ProtectedAvatar } from "../../../components/chat/ProtectedAvatar";
import { useApp } from "../../../context/AppContext";
import { calculateMatchRewards } from "../../shared/xpCalculator";

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
   const [isNavigatingToTopic, setIsNavigatingToTopic] = useState(false);
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
         className="flex flex-col flex-1 justify-center gap-6 py-1 pt-2"
      >
         <div className="text-center space-y-1">
            <Award size={48} className={`mx-auto animate-bounce ${statusTextClass}`} />
            <h2 className={`text-2xl font-black uppercase tracking-wider ${statusTextClass}`}>
               {isWinner ? "Victory!" : isDraw ? "Draw!" : "Defeat"}
            </h2>
            <p className="text-xs text-white/60 uppercase tracking-widest font-black">Match Completed</p>
         </div>

         {/* Side-by-Side Scores */}
         <div className="grid grid-cols-2 gap-4 bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
            <div className="flex flex-col items-center justify-center gap-1.5">
               <ProtectedAvatar
                  src={myAvatarUrl}
                  username={myUsername}
                  className="w-10 h-10 rounded-full"
               />
               <p className="text-[10px] text-white/40 font-black uppercase">You</p>
               <p className="text-2xl font-black text-white">{myScore} pts</p>
            </div>
            <div className="border-l border-white/10 flex flex-col items-center justify-center gap-1.5">
               <ProtectedAvatar
                  src={opponentAvatarUrl}
                  username={opponentName}
                  className="w-10 h-10 rounded-full"
               />
               <p className="text-[10px] text-white/40 font-black uppercase">
                  {opponentName}
               </p>
               <p className="text-2xl font-black text-white">{oppScore} pts</p>
            </div>
         </div>

         {/* Rewards and Elo changes */}
         {(() => {
            const rewards = calculateMatchRewards(matchData, role, questions?.length);
            const formattedElo = rewards.totalEloChange >= 0 ? `+${rewards.totalEloChange}` : `${rewards.totalEloChange}`;
            return (
               <div className={`border rounded-2xl p-4 text-center space-y-2 ${statusColor}`}>
                  <p className="text-xs font-bold uppercase tracking-wider">
                     Rating Change: {formattedElo} Elo Rating
                  </p>
                  <p className="text-[10px] text-white/80 uppercase font-black">
                     Earned: +{rewards.totalXpEarned} XP
                  </p>
                  {rewards.subGameCount > 1 && (
                     <div className="pt-2 border-t border-white/10 space-y-1.5 text-left">
                        <p className="text-[10px] text-white/50 font-black uppercase tracking-wider text-center">
                           Marathon Split ({rewards.subGameCount} Single Games)
                        </p>
                        <div className="grid grid-cols-1 gap-1 text-[10px] font-bold">
                           {rewards.subGames.map((sg: any) => (
                              <div key={sg.gameIndex} className="flex justify-between items-center bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5">
                                 <span>Game {sg.gameIndex + 1} (Rounds {sg.roundRange[0]}-{sg.roundRange[1]}): <span className="text-white/60">{sg.myScore} vs {sg.oppScore} pts</span></span>
                                 <span className={sg.outcome === "win" ? "text-correct font-extrabold" : sg.outcome === "draw" ? "text-yellow-500 font-extrabold" : "text-red-400 font-extrabold"}>
                                    {sg.outcome === "win" ? `+${sg.eloChange} Elo` : sg.outcome === "draw" ? `+${sg.eloChange} Elo` : `${sg.eloChange} Elo`}
                                 </span>
                              </div>
                           ))}
                        </div>
                     </div>
                  )}
               </div>
            );
         })()}

         {/* Rematch Actions */}
         {!matchData.is_bot_match && showRematchButton && (
            <div className="space-y-3">
               {rematchState === "idle" && (
                  <button
                     onClick={sendRematch}
                     className="w-full bg-[#E85151] hover:bg-[#d44343] text-white font-black uppercase py-4 rounded-xl flex items-center justify-center gap-2 tracking-widest shadow-[0_4px_20px_rgba(232,81,81,0.3)] cursor-pointer hover:scale-102 active:scale-98 transition-all"
                  >
                     🤝 Request Rematch
                  </button>
               )}
               {rematchState === "sent" && (
                  <div className="w-full bg-white/5 border border-white/10 text-white/40 font-black uppercase py-4 rounded-xl flex flex-col items-center justify-center gap-1 tracking-widest animate-pulse relative overflow-hidden">
                     <span className="flex items-center gap-2">⏳ Waiting for Opponent ({rematchCountdown}s)</span>
                     <div
                        className="absolute bottom-0 left-0 h-1 bg-[#E85151]/40 transition-all duration-1000 ease-linear"
                        style={{ width: `${(rematchCountdown / 10) * 100}%` }}
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
                        style={{ width: `${(rematchCountdown / 10) * 100}%` }}
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
               className="bg-[#E85151] hover:bg-[#d44343] text-white font-black uppercase py-4 rounded-xl tracking-widest shadow-[0_4px_20px_rgba(232,81,81,0.3)] cursor-pointer hover:scale-102 active:scale-98 transition-all animate-pulse"
            >
               Play Again
            </button>
            <button
               onClick={() => setView("playbot")}
               className="bg-white/10 hover:bg-white/15 text-white font-black uppercase py-4 px-2 rounded-xl flex items-center justify-center gap-2 tracking-widest shadow-lg cursor-pointer hover:scale-102 active:scale-98 transition-all border border-white/10"
            >
               <span>Play vs Bot</span>
            </button>
         </div>
         <div className="grid grid-cols-2 gap-3">
            <button
               onClick={async () => {
                  setIsNavigatingToTopic(true);
                  await new Promise((r) => setTimeout(r, 150));
                  setView("menu");
               }}
               disabled={isNavigatingToTopic}
               className="bg-white/10 hover:bg-white/15 text-white font-black uppercase py-3.5 px-2 rounded-xl flex items-center justify-center gap-1.5 tracking-wider shadow-lg cursor-pointer hover:scale-102 active:scale-98 transition-all border border-white/10 text-xs disabled:opacity-50"
            >
               {isNavigatingToTopic ? (
                  <Loader2 size={16} className="animate-spin text-[#E85151]" />
               ) : (
                  <ArrowLeft size={16} />
               )}
               <span>{isNavigatingToTopic ? "Loading..." : "Topic Lobby"}</span>
            </button>
            <button
               onClick={() => setView("home" as any)}
               className="bg-[#E85151] hover:bg-[#d44343] text-white font-black uppercase py-3.5 px-2 rounded-xl flex items-center justify-center gap-1.5 tracking-wider shadow-lg cursor-pointer hover:scale-102 active:scale-98 transition-all border border-red-500/30 text-xs"
            >
               <Home size={16} />
               <span>Home</span>
            </button>
         </div>

         {/* Round Breakdown */}
         {questions && questions.length > 0 && (
            <div className="space-y-4 bg-white/5 border border-white/10 rounded-2xl p-4 mt-2">
               <h3 className="text-xs font-black uppercase text-white/60 tracking-wider border-b border-white/10 pb-2 text-left">
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
                              <span className="text-[9px] text-white/40 font-bold uppercase">{q.type.replace("_", " ")}</span>
                           </div>
                           <p className="text-xs font-bold text-white leading-relaxed">{q.prompt}</p>
                           {q.subPrompt && (
                              <p className="text-[10px] text-white/60 bg-white/5 px-2 py-0.5 rounded inline-block">
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
                                       className={`rounded-lg overflow-hidden border ${q.choices[i] === q.answer
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
                           <p className="text-[10px] text-white/40 mt-1">
                              Correct Answer: <span className="text-correct font-extrabold">{q.answer}</span>
                           </p>
                           {q.explanation && (
                              <p className="text-[10px] text-white/80 bg-white/5 px-2 py-1 rounded italic mt-1 leading-relaxed">
                                 💡 {q.explanation}
                              </p>
                           )}
                           <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
                              <div className="bg-white/5 p-2 rounded-lg space-y-0.5 border border-white/5">
                                 <p className="font-black text-white/40 uppercase">You</p>
                                 <p className="font-bold text-white truncate">
                                    Played: <span className={myAns?.correct ? "text-correct" : "text-red-400"}>{myAns?.choice || "No Answer"}</span>
                                 </p>
                                 <p className="text-white/60 font-black">+{myAns?.points || 0} pts ({myAns?.time_taken || 0}s)</p>
                              </div>
                              <div className="bg-white/5 p-2 rounded-lg space-y-0.5 border border-white/5">
                                 <p className="font-black text-white/40 uppercase">{opponentName}</p>
                                 <p className="font-bold text-white truncate">
                                    Played: <span className={oppAns?.correct ? "text-correct" : "text-red-400"}>{oppAns?.choice || "No Answer"}</span>
                                 </p>
                                 <p className="text-white/60 font-black">+{oppAns?.points || 0} pts ({oppAns?.time_taken || 0}s)</p>
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
