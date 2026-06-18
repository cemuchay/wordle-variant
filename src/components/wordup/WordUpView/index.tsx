/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback, useEffect, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { useAuth } from "../../../hooks/useAuth";
import { useApp } from "../../../context/AppContext";
import { useServerTime } from "./hooks/useServerTime";
import { useWordUpProfile } from "./hooks/useWordUpProfile";
import { useWordUpMatchmaking } from "./hooks/useWordUpMatchmaking";
import { useWordUpGameLoop } from "./hooks/useWordUpGameLoop";
import { wordupAudio } from "../../../utils/wordupAudio";
import { supabase } from "../../../lib/supabaseClient";
import { Swords } from "lucide-react";

import { LobbyView } from "./components/LobbyView";
import { MatchmakingView } from "./components/MatchmakingView";
import { CountdownView } from "./components/CountdownView";
import { BattleView } from "./components/BattleView";
import { GameOverView } from "./components/GameOverView";
import { ConnectionOverlay } from "./components/ConnectionOverlay";

import { useWordUpStore } from "../../../store/useWordUpStore";

export const WordUpView = () => {
   const { user: authUser } = useAuth();
   const { triggerToast, realtimeStatus, onlineUsers, profile } = useApp();

   const [guestUser, setGuestUser] = useState<any>(() => {
      const id = localStorage.getItem('wordle_anon_id');
      const username = localStorage.getItem('wordle_anon_username');
      if (id && username) {
         return { id, username, user_metadata: { full_name: username } };
      }
      return null;
   });

   const effectiveUser = authUser || guestUser;
   const [showGuestInput, setShowGuestInput] = useState(false);
   const [nicknameInput, setNicknameInput] = useState("");

   const view = useWordUpStore((s) => s.view);
   const setView = useWordUpStore((s) => s.setView);
   const category = useWordUpStore((s) => s.category);
   const setCategory = useWordUpStore((s) => s.setCategory);
   const matchId = useWordUpStore((s) => s.matchId);
   const setMatchId = useWordUpStore((s) => s.setMatchId);
   const role = useWordUpStore((s) => s.role);
   const setRole = useWordUpStore((s) => s.setRole);
   const resetGame = useWordUpStore((s) => s.resetGame);

   const [countdownText, setCountdownText] = useState("3");

   const { getSyncedNow } = useServerTime();
   const { userStats, getRankColor, updateStats } = useWordUpProfile(effectiveUser);

   const [soundEnabled, setSoundEnabled] = useState(wordupAudio.isEnabled());

   const handleToggleSound = useCallback(() => {
      const newVal = !soundEnabled;
      setSoundEnabled(newVal);
      wordupAudio.setEnabled(newVal);
   }, [soundEnabled]);

   useEffect(() => {
      if (view === "matchmaking" || view === "countdown" || view === "battle") {
         wordupAudio.startAmbient();
      } else {
         wordupAudio.stopAmbient();
      }
      return () => {
         wordupAudio.stopAmbient();
      };
   }, [view]);

   const onGameOver = useCallback(async (match: any) => {
      if (view === "gameover") return;
      setView("gameover");

      if (!effectiveUser) return;
      const isP1 = role === "player1";
      const myScore = isP1 ? match.p1_score : match.p2_score;
      const oppScore = isP1 ? match.p2_score : match.p1_score;

      const won = myScore > oppScore;
      const tied = myScore === oppScore;

      const myAnswers = isP1 ? match.p1_answers : match.p2_answers;
      const correctCount = myAnswers?.filter((a: any) => a.correct).length || 0;

      const xpReward = 50 + (won ? 100 : 0) + (correctCount * 10);
      const eloGain = won ? 18 + Math.max(0, correctCount) : tied ? 2 : -12;

      try {
         await updateStats(eloGain, xpReward, won, tied);
      } catch (err) {
         triggerToast("Rating update delayed. Syncing in background...", 4000);
      }
   }, [effectiveUser, view, updateStats, triggerToast, role]);

   const {
      questions,
      currentIdx,
      matchData,
      opponentStats,
      timeLeft,
      maxTime,
      selectedAnswer,
      revealAnswers,
      handleAnswerSelect,
      loadAndSubscribeMatch,
      startQuestionRound,
      cleanUpIntervals: cleanUpGameLoop,
      rematchState,
      rematchCountdown,
      showRematchButton,
      sendRematch,
      acceptRematch,
      sendQuickChat
   } = useWordUpGameLoop(matchId, role, getSyncedNow, triggerToast, onGameOver, (newMId, newRole) => {
      // eslint-disable-next-line react-hooks/immutability
      onMatchFound(newMId, newRole);
   });

   // Reactive sync: If matchData status changes to active externally, jump to battle
   useEffect(() => {
      if (matchData?.status === "active" && view === "countdown") {
         console.log("[WordUp Logs] Match status became ACTIVE. Transitioning to battle...");
         setView("battle");
         startQuestionRound(matchData, matchData.current_question_index || 0);
      }
   }, [matchData?.status, view, setView, startQuestionRound, matchData]);

    const startCountdown = useCallback((match: any) => {
       let count = 3;
       setCountdownText("3");
       const interval = setInterval(() => {
          count--;
          if (count === 0) {
             clearInterval(interval);
             setView("battle");

             // Set match status to active in database
             if (role === "player2" || match.is_bot_match) {
                supabase
                   .from("wordup_matches")
                   .update({ status: "active" })
                   .eq("id", match.id)
                   .then(({ error }: any) => {
                      if (error) console.error("Failed to set match status to active:", error);
                   });
             }

             startQuestionRound(match, 0);
          } else {
             setCountdownText(String(count));
          }
       }, 1000);
    }, [startQuestionRound, role]);

    const launchedMatchIdRef = useRef<string | null>(null);

    // eslint-disable-next-line react-hooks/preserve-manual-memoization
    const onMatchFound = useCallback(async (mId: string, mRole: "player1" | "player2") => {
       launchedMatchIdRef.current = mId;
       setMatchId(mId);
       setRole(mRole);
       const match = await loadAndSubscribeMatch(mId, mRole);
       if (match) {
          wordupAudio.playMatchStart();
          setView("countdown");
          startCountdown(match);
       }
    }, [loadAndSubscribeMatch, startCountdown, setMatchId, setRole, setView]);

    // Reactive sync for direct invites and rematch transitions
    useEffect(() => {
       if (matchId && role && matchId !== launchedMatchIdRef.current && (view === "menu" || view === "matchmaking" || view === "gameover")) {
          console.log("[WordUp Logs] Direct matchId set in store. Launching match...", matchId, role);
          onMatchFound(matchId, role);
       }
    }, [matchId, role, view, onMatchFound]);

   const cleanUpAll = useCallback(() => {
      cleanUpGameLoop();
   }, [cleanUpGameLoop]);

   const {
      countdownSecs,
      startMatchmaking,
      cancelMatchmaking
   } = useWordUpMatchmaking(effectiveUser, category, getSyncedNow, triggerToast, onMatchFound, cleanUpAll);

   useEffect(() => {
      return () => {
         cancelMatchmaking();
      };
   }, [cancelMatchmaking]);

   const handleCancelMatchmaking = useCallback(async () => {
      await cancelMatchmaking();
      setView("menu");
   }, [cancelMatchmaking]);

   if (!effectiveUser) {
      return (
         <div className="w-full max-w-md mx-auto h-full flex flex-col justify-center items-center bg-dark p-6 text-center space-y-6">
            <div className="inline-flex p-4 bg-correct/10 rounded-3xl border border-correct/20 text-correct shadow-[0_0_20px_rgba(46,204,113,0.15)] animate-pulse">
               <Swords size={32} />
            </div>
            <div className="space-y-2">
               <h2 className="text-2xl font-black uppercase tracking-wider text-white">WordUp Battles</h2>
               <p className="text-xs text-gray-400 max-w-xs mx-auto">
                  Log in to save stats permanently, or enter a nickname to play as a guest!
               </p>
            </div>

            {!showGuestInput ? (
               <div className="grid grid-cols-1 gap-3 w-full max-w-xs">
                  <button
                     onClick={() => {
                        window.dispatchEvent(new CustomEvent("open-auth-modal"));
                     }}
                     className="bg-correct text-black py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                     Log In / Sign Up
                  </button>
                  <button
                     onClick={() => setShowGuestInput(true)}
                     className="bg-white/10 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-white/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center border border-white/5"
                  >
                     Play as Guest
                  </button>
               </div>
            ) : (
               <div className="space-y-3 w-full max-w-xs">
                  <input
                     type="text"
                     maxLength={15}
                     placeholder="Enter nickname..."
                     value={nicknameInput}
                     onChange={(e) =>
                        setNicknameInput(
                           e.target.value.replace(/[^A-Za-z0-9_]/g, ""),
                        )
                     }
                     className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:border-correct outline-none uppercase text-center font-black tracking-widest text-correct"
                  />
                  <div className="grid grid-cols-2 gap-3">
                     <button
                        onClick={() => setShowGuestInput(false)}
                        className="bg-white/5 text-white py-3.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all border border-white/5 cursor-pointer"
                     >
                        Back
                     </button>
                     <button
                        onClick={async () => {
                           const name = nicknameInput.trim();
                           if (name.length < 3) {
                              triggerToast("Nickname must be at least 3 characters.", 3000);
                              return;
                           }
                           const anonId = crypto.randomUUID();
                           localStorage.setItem('wordle_anon_id', anonId);
                           localStorage.setItem('wordle_anon_username', name);

                           // Upsert guest profile in DB
                           await supabase.from('guest_profiles').upsert({
                              id: anonId,
                              username: name,
                              avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${anonId}`
                           });

                           setGuestUser({ id: anonId, username: name, user_metadata: { full_name: name } });
                           triggerToast("Guest profile created! Welcome.", 3000);
                        }}
                        className="bg-correct text-black py-3.5 rounded-xl text-xs font-black uppercase tracking-widest hover:brightness-110 transition-all cursor-pointer"
                     >
                        Play
                     </button>
                  </div>
               </div>
            )}
         </div>
      );
   }

   return (
      <div className="w-full max-w-lg mx-auto h-full flex flex-col bg-dark overflow-y-auto scrollbar-hide p-4 relative" style={{ minHeight: "100%" }}>
         <AnimatePresence mode="wait">
            {view === "menu" && (
               <LobbyView
                  userStats={userStats}
                  category={category}
                  setCategory={setCategory}
                  startMatchmaking={() => {
                     setView("matchmaking");
                     startMatchmaking();
                  }}
                  getRankColor={getRankColor}
                  soundEnabled={soundEnabled}
                  onToggleSound={handleToggleSound}
                  onlineUsers={onlineUsers}
                  currentUser={effectiveUser}
               />
            )}

            {view === "matchmaking" && (
               <MatchmakingView
                  category={category}
                  cancelMatchmaking={handleCancelMatchmaking}
                  countdownSecs={countdownSecs}
               />
            )}

            {view === "countdown" && (
               <CountdownView countdownText={countdownText} />
            )}

            {view === "battle" && (
               <BattleView
                  questions={questions}
                  currentIdx={currentIdx}
                  matchData={matchData}
                  opponentStats={opponentStats}
                  timeLeft={timeLeft}
                  maxTime={maxTime}
                  selectedAnswer={selectedAnswer}
                  revealAnswers={revealAnswers}
                  handleAnswerSelect={handleAnswerSelect}
                  role={role}
                  playerProfile={profile}
                  sendQuickChat={sendQuickChat}
               />
            )}

            {view === "gameover" && (
               <GameOverView
                  matchData={matchData}
                  setView={(newView) => {
                     if (newView === "menu") {
                        resetGame();
                     } else {
                        setView(newView);
                     }
                  }}
                  role={role}
                  rematchState={rematchState}
                  rematchCountdown={rematchCountdown}
                  showRematchButton={showRematchButton}
                  sendRematch={sendRematch}
                  acceptRematch={() => acceptRematch(onMatchFound)}
               />
            )}
         </AnimatePresence>

         <ConnectionOverlay realtimeStatus={realtimeStatus} view={view} />
      </div>
   );
};

export default WordUpView;
