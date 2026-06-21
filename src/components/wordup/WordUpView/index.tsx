/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback, useEffect, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { useAuth } from "../../../hooks/useAuth";
import { useApp } from "../../../context/AppContext";
import { useServerTime } from "./hooks/useServerTime";
import { useWordUpProfile } from "./hooks/useWordUpProfile";
import { useWordUpMatchmaking } from "./hooks/useMatchmaking";
import { useWordUpGameLoop } from "./hooks/useWordUpGameLoop";
import { wordupAudio } from "../../../utils/wordupAudio";
import { supabase } from "../../../lib/supabaseClient";
import { Swords } from "lucide-react";

import { decryptMatchQuestions } from "../../../utils/wordupQuestionGenerator";

import { LobbyView } from "./components/LobbyView";
import { MatchmakingView } from "./components/MatchmakingView";
import { CountdownView } from "./components/CountdownView";
import { BattleView } from "./components/BattleView";
import { GameOverView } from "./components/GameOverView";
import { LoadingView } from "./components/LoadingView";
import { ConnectionOverlay } from "./components/ConnectionOverlay";
import { ConnectingView } from "./components/ConnectingView";
import { safeLocalStorage, safeSessionStorage } from "../../../utils/storage";

import { RATING, XP, WORDUP_TIMEOUT, WORDUP_LIMITS, BOT_PROFILES_RATINGS } from "../../../constants/wordup";
import { useWordUpStore } from "../../../store/useWordUpStore";

export const WordUpView = () => {
   const { user: authUser } = useAuth();
   const { triggerToast, realtimeStatus, onlineUsers, profile, allProfiles } = useApp();

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
   const setMatchData = useWordUpStore((s) => s.setMatchData);
   const setQuestions = useWordUpStore((s) => s.setQuestions);

   const [countdownText, setCountdownText] = useState(String(WORDUP_TIMEOUT.COUNTDOWN_START));

   const countdownIntervalRef = useRef<number | null>(null);
   const cleanUpCountdown = useCallback(() => {
      if (countdownIntervalRef.current) {
         clearInterval(countdownIntervalRef.current);
         countdownIntervalRef.current = null;
      }
   }, []);

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

      const xpReward = XP.BASE_REWARD + (won ? XP.WIN_BONUS : 0) + (correctCount * XP.PER_CORRECT);

      // Chess ELO expectancy calculation
      const myRating = userStats?.rating || RATING.DEFAULT;
      let oppRating: number = RATING.DEFAULT_OPPONENT;
      if (match?.is_bot_match) {
         const prof = match.bot_profile || "average";
         oppRating = BOT_PROFILES_RATINGS[prof] || RATING.DEFAULT_OPPONENT;
      } else {
         const storeOppStats = useWordUpStore.getState().opponentStats;
         if (storeOppStats?.rating) {
            oppRating = storeOppStats.rating;
         }
      }

      const expected = 1 / (1 + Math.pow(10, (oppRating - myRating) / RATING.DIVISOR));
      const actual = won ? 1 : tied ? 0.5 : 0;
      const baseEloChange = Math.round(RATING.K_FACTOR * (actual - expected));
      const accuracyBonus = won ? correctCount : 0;

      let eloGain = baseEloChange + accuracyBonus;
      // Safety bounds to prevent losing points on a win, or gaining on a loss
      if (won && eloGain < RATING.MIN_GAIN_ON_WIN) eloGain = RATING.MIN_GAIN_ON_WIN;
      if (!won && !tied && eloGain > RATING.MAX_LOSS_ON_LOSS) eloGain = RATING.MAX_LOSS_ON_LOSS;

      try {
         await updateStats(eloGain, xpReward, won, tied);
      } catch {
         triggerToast("Rating update delayed. Syncing in background...", WORDUP_TIMEOUT.TOAST_DURATION);
      }
   }, [effectiveUser, view, updateStats, triggerToast, role, userStats, setView]);

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

    // Accidental refresh recovery
    useEffect(() => {
       const activeGameStr = safeLocalStorage.getItem("wordup_active_game");
       if (activeGameStr) {
          try {
             const activeGame = JSON.parse(activeGameStr);
             if (activeGame && activeGame.matchId && activeGame.matchData?.status !== "completed") {
                console.log("[WordUp Logs] Restoring active game from localStorage:", activeGame.matchId);
                
                const store = useWordUpStore.getState();
                store.setMatchId(activeGame.matchId);
                store.setRole(activeGame.role);
                store.setCategory(activeGame.category || "mixed");
                store.setQuestions(activeGame.questions || []);
                store.setCurrentIdx(activeGame.currentIdx || 0);
                store.setMatchData(activeGame.matchData);
                store.setOpponentStats(activeGame.opponentStats);
                store.setRevealAnswers(activeGame.revealAnswers || false);
                store.setSelectedAnswer(activeGame.selectedAnswer || null);
                
                store.setView("battle");
                
                setTimeout(() => {
                   loadAndSubscribeMatch(activeGame.matchId, activeGame.role);
                   startQuestionRound(activeGame.matchData, activeGame.currentIdx || 0);
                }, 100); // brief yield for state settling
             }
          } catch (err) {
             console.error("[WordUp Logs] Failed to restore active game:", err);
          }
       }
       // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Reactive sync: If matchData status changes to active externally, jump to battle
    useEffect(() => {
       if (matchData?.status === "active" && view === "countdown") {
          console.log("[WordUp Logs] Match status became ACTIVE. Transitioning to battle...");
          cleanUpCountdown();
          setView("battle");
          startQuestionRound(matchData, matchData.current_question_index || 0);
       }
    }, [matchData?.status, view, setView, startQuestionRound, matchData, cleanUpCountdown]);

    const startCountdown = useCallback((match: any) => {
       cleanUpCountdown();
        let count = WORDUP_TIMEOUT.COUNTDOWN_START;
       setCountdownText(String(WORDUP_TIMEOUT.COUNTDOWN_START));
       countdownIntervalRef.current = window.setInterval(() => {
          count--;
          if (count === 0) {
             cleanUpCountdown();
             setView("battle");

             // Set match status to active in database (only for real-time matches)
             if ((role === "player2" || match.is_bot_match) && match.status !== "waiting" && !match.id?.startsWith("bot-match-")) {
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
        }, WORDUP_TIMEOUT.COUNTDOWN_INTERVAL);
    }, [startQuestionRound, role, cleanUpCountdown, setView]);

   const launchedMatchIdRef = useRef<string | null>(null);

   // eslint-disable-next-line react-hooks/preserve-manual-memoization
   const onMatchFound = useCallback(async (mId: string, mRole: "player1" | "player2") => {
      launchedMatchIdRef.current = mId;
      setMatchId(mId);
      setRole(mRole);
      setView("loading");
      const match = await loadAndSubscribeMatch(mId, mRole);
      if (match) {
         wordupAudio.playMatchStart();
         setView("countdown");
         startCountdown(match);
      } else {
         setView("menu");
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

   const handlePurgeAndReset = useCallback(async () => {
      if (!effectiveUser) return;
      try {
         await supabase.from("wordup_queue").delete().eq("user_id", effectiveUser.id);
         const { data: staleMatches } = await supabase
            .from("wordup_matches")
            .select("id, player1_id, player2_id, p1_answered, p2_answered, status")
            .or(`player1_id.eq.${effectiveUser.id},player2_id.eq.${effectiveUser.id}`)
            .in("status", ["waiting", "countdown"]);
         if (staleMatches && staleMatches.length > 0) {
            for (const m of staleMatches) {
               const isP1 = m.player1_id === effectiveUser.id;
               const hasPlayed = isP1 ? m.p1_answered : m.p2_answered;
               const opponentIsSelf = m.player1_id === m.player2_id;
               if (opponentIsSelf || hasPlayed) {
                  await supabase.from("wordup_matches").update({
                     status: "completed",
                     completed_at: new Date().toISOString()
                  }).eq("id", m.id);
               }
            }
         }
      } catch (e) {
         console.error("Purge error:", e);
      }
      for (const key of Object.keys(sessionStorage)) {
         if (key.startsWith("wordup_")) safeSessionStorage.removeItem(key);
      }
      for (const key of Object.keys(localStorage)) {
         if (key.startsWith("wordup_")) safeLocalStorage.removeItem(key);
      }
      resetGame();
      cancelMatchmaking();
      triggerToast("Local data purged and stale matches cleaned.", WORDUP_TIMEOUT.TOAST_DURATION);
   }, [effectiveUser, resetGame, cancelMatchmaking, triggerToast]);

    // Safety timeout: if stuck in loading or countdown for too long, abort to lobby
    const safetyTimerRef = useRef<number | null>(null);
    const clearSafetyTimer = useCallback(() => {
       if (safetyTimerRef.current) {
          clearTimeout(safetyTimerRef.current);
          safetyTimerRef.current = null;
       }
    }, []);
    const startSafetyTimer = useCallback(() => {
       clearSafetyTimer();
       safetyTimerRef.current = window.setTimeout(() => {
          console.warn("[WordUp Logs] Safety timeout triggered — game failed to start. Aborting to lobby.");
          triggerToast("Game creation timed out. Please try again.", WORDUP_TIMEOUT.TOAST_DURATION);
          cleanUpAll();
          cleanUpCountdown();
          safeLocalStorage.removeItem("wordup_active_game");
          resetGame();
          setView("menu");
          clearSafetyTimer();
       }, WORDUP_TIMEOUT.SAFETY);
    }, [triggerToast, cleanUpAll, cleanUpCountdown, resetGame, setView, clearSafetyTimer]);

    useEffect(() => {
       if (view === "loading" || view === "countdown") {
          startSafetyTimer();
       } else {
          clearSafetyTimer();
       }
    }, [view, startSafetyTimer, clearSafetyTimer]);

    const cancelMatchmakingRef = useRef(cancelMatchmaking);
    useEffect(() => {
       cancelMatchmakingRef.current = cancelMatchmaking;
    }, [cancelMatchmaking]);

    useEffect(() => {
       return () => {
          cancelMatchmakingRef.current();
          cleanUpCountdown();
          resetGame();
          clearSafetyTimer();
       };
       // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cleanUpCountdown]);

   const handleCancelMatchmaking = useCallback(async () => {
      await cancelMatchmaking();
      safeLocalStorage.removeItem("wordup_active_game");
      setView("menu");
   }, [cancelMatchmaking, setView]);

   const handleSelectHistoryMatch = useCallback(async (match: any) => {
      if (!effectiveUser) return;
      try {
         const seenStr = safeLocalStorage.getItem("wordup_seen_matches");
         const seen = seenStr ? JSON.parse(seenStr) : [];
         if (!seen.includes(match.id)) {
            seen.push(match.id);
            safeLocalStorage.setItem("wordup_seen_matches", JSON.stringify(seen));
         }
      } catch (e) {
         console.error("[WordUp Logs] Failed to mark history match as seen:", e);
      }

      const myRole = match.player1_id === effectiveUser.id ? "player1" : "player2";
      setRole(myRole);
      setMatchData(match);

      try {
         const dec = await decryptMatchQuestions(match);
         setQuestions(dec);
      } catch (e) {
         console.error("Failed to decrypt history match questions:", e);
      }
      setView("gameover");
   }, [effectiveUser, setRole, setMatchData, setQuestions, setView]);

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
                      maxLength={WORDUP_LIMITS.MAX_NICKNAME_LENGTH}
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
                            if (name.length < WORDUP_LIMITS.MIN_NICKNAME_LENGTH) {
                               triggerToast("Nickname must be at least 3 characters.", WORDUP_TIMEOUT.TOAST_DURATION);
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
                            triggerToast("Guest profile created! Welcome.", WORDUP_TIMEOUT.TOAST_DURATION);
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
      <div className="w-full max-w-lg mx-auto h-full flex flex-col bg-dark overflow-y-auto scrollbar-hide pt-4 px-4 pb-4 relative" style={{ minHeight: "100%" }}>
         <AnimatePresence mode="wait">
            {view === "menu" && (
               <LobbyView
                  userStats={userStats}
                  category={category}
                  setCategory={setCategory}
                  startMatchmaking={() => {
                     setView("connecting");
                     startMatchmaking();
                  }}
                  getRankColor={getRankColor}
                  onlineUsers={onlineUsers}
                  allProfiles={allProfiles}
                  currentUser={effectiveUser}
                  onSelectHistoryMatch={handleSelectHistoryMatch}
                  soundEnabled={soundEnabled}
                  onToggleSound={handleToggleSound}
                  onPurgeAndReset={handlePurgeAndReset}
               />
            )}

            {view === "matchmaking" && (
               <MatchmakingView
                  category={category}
                  cancelMatchmaking={handleCancelMatchmaking}
                  countdownSecs={countdownSecs}
               />
            )}

            {view === "connecting" && (
               <ConnectingView />
            )}

            {view === "countdown" && (
               <CountdownView countdownText={countdownText} />
            )}

            {view === "loading" && (
               <LoadingView />
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
