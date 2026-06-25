import { useState, useCallback, useEffect, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { useAuth } from "../../../hooks/useAuth";
import { useApp } from "../../../context/AppContext";
import { useServerTime } from "./hooks/useServerTime";
import { useWordUpProfile } from "./hooks/useWordUpProfile";
import { useWordUpMatchmaking } from "./hooks/useMatchmaking";
import { useWordUpGameEngine } from "./hooks/useWordUpGameEngine";
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
import { safeLocalStorage } from "../../../utils/storage";

import { RATING, XP, WORDUP_TIMEOUT, WORDUP_LIMITS, BOT_PROFILES_RATINGS } from "../../../constants/wordup";
import { useWordUpStore } from "../../../store/useWordUpStore";
import { useAppStore } from "../../../store/useAppStore";

export const WordUpView = () => {
   const { user: authUser } = useAuth();
   const { triggerToast, realtimeStatus, onlineUsers, profile, allProfiles } = useApp();

   const [guestUser, setGuestUser] = useState<any>(() => {
      const id = localStorage.getItem('wordle_anon_id');
      const username = localStorage.getItem('wordle_anon_username');
      if (id && username) return { id, username, user_metadata: { full_name: username } };
      return null;
   });

   const effectiveUser = authUser || guestUser;
   const [showGuestInput, setShowGuestInput] = useState(false);
   const [nicknameInput, setNicknameInput] = useState("");

   const view = useWordUpStore((s) => s.view);
   const setView = useWordUpStore((s) => s.setView);
   const setIsBattlePlaying = useWordUpStore((s) => s.setIsBattlePlaying);
   const category = useWordUpStore((s) => s.category);
   const setCategory = useWordUpStore((s) => s.setCategory);
   const matchId = useWordUpStore((s) => s.matchId);
   const setMatchId = useWordUpStore((s) => s.setMatchId);
   const role = useWordUpStore((s) => s.role);
   const setRole = useWordUpStore((s) => s.setRole);
   const resetGame = useWordUpStore((s) => s.resetGame);
   const setMatchData = useWordUpStore((s) => s.setMatchData);
   const setQuestions = useWordUpStore((s) => s.setQuestions);

   const { getSyncedNow } = useServerTime();
   const { userStats, getRankColor, updateStats } = useWordUpProfile(effectiveUser);

   const [soundEnabled, setSoundEnabled] = useState(wordupAudio.isEnabled());

   const handleToggleSound = useCallback(() => {
      const newVal = !soundEnabled;
      setSoundEnabled(newVal);
      wordupAudio.setEnabled(newVal);
   }, [soundEnabled]);

   // Determine game type from matchData
   const matchDataFromStore = useWordUpStore((s) => s.matchData);
   const gameType = !matchDataFromStore ? null
      : matchDataFromStore.game_type
         ? matchDataFromStore.game_type
         : matchDataFromStore.is_bot_match
            ? "live-bot"
            : matchDataFromStore.status === "waiting"
               ? "async"
               : "live";

   const onGameOver = useCallback(async (match: any) => {
      if (useWordUpStore.getState().view === "gameover") return;
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

      const myRating = userStats?.rating || RATING.DEFAULT;
      let oppRating: number = RATING.DEFAULT_OPPONENT;
      if (match?.is_bot_match) {
         const prof = match.bot_profile || "average";
         oppRating = BOT_PROFILES_RATINGS[prof] || RATING.DEFAULT_OPPONENT;
      } else {
         const storeOppStats = useWordUpStore.getState().opponentStats;
         if (storeOppStats?.rating) oppRating = storeOppStats.rating;
      }

      const expected = 1 / (1 + Math.pow(10, (oppRating - myRating) / RATING.DIVISOR));
      const actual = won ? 1 : tied ? 0.5 : 0;
      const baseEloChange = Math.round(RATING.K_FACTOR * (actual - expected));
      const accuracyBonus = won ? correctCount : 0;

      let eloGain = baseEloChange + accuracyBonus;
      if (won && eloGain < RATING.MIN_GAIN_ON_WIN) eloGain = RATING.MIN_GAIN_ON_WIN;
      if (!won && !tied && eloGain < RATING.MAX_LOSS_ON_LOSS) eloGain = RATING.MAX_LOSS_ON_LOSS;

      try { await updateStats(eloGain, xpReward, won, tied); }
      catch { triggerToast("Rating update delayed. Syncing in background...", WORDUP_TIMEOUT.TOAST_DURATION); }
   }, [effectiveUser, updateStats, triggerToast, role, userStats, setView]);

   const onRematchAccepted = useCallback((newMId: string, newRole: "player1" | "player2") => {
      launchedMatchRef.current = newMId;
      setMatchId(newMId);
      setRole(newRole);
      startMatchRef.current?.(newMId, newRole);
   // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);

   const engine = useWordUpGameEngine({
      gameType: gameType as any || "live-bot",
      matchId,
      role,
      getSyncedNow,
      triggerToast,
      onGameOver,
      onRematchAccepted,
   });

   // ── Track launched match to prevent re-launch ────────────────────────
   const launchedMatchRef = useRef<string | null>(null);
   const startMatchRef = useRef<((mId: string, role: "player1" | "player2") => void) | null>(null);
   const engineCleanupRef = useRef<(() => void) | null>(null);
   startMatchRef.current = engine.startMatch;
   engineCleanupRef.current = engine.cleanup;

   const onMatchFound = useCallback((mId: string, mRole: "player1" | "player2") => {
      launchedMatchRef.current = mId;
      setMatchId(mId);
      setRole(mRole);
      startMatchRef.current?.(mId, mRole);
   }, [setMatchId, setRole]);

   // Reactive sync for direct invites, rematch transitions, and loading state
    useEffect(() => {
      if (matchId && role && matchId !== launchedMatchRef.current && (view === "menu" || view === "matchmaking" || view === "gameover" || view === "loading" || view === "connecting")) {
         launchedMatchRef.current = matchId;
         startMatchRef.current?.(matchId, role);
      }
   }, [matchId, role, view]);

   // Hide global headers during battle
   useEffect(() => {
      setIsBattlePlaying(view === "battle");
   }, [view, setIsBattlePlaying]);

   // ── Matchmaking ───────────────────────────────────────────────────────
   const {
      countdownSecs,
      startMatchmaking,
      cancelMatchmaking
   } = useWordUpMatchmaking(effectiveUser, category, getSyncedNow, triggerToast, onMatchFound, () => { engine.cleanup(); });

   const handleCancelMatchmaking = useCallback(async () => {
      await cancelMatchmaking();
      resetGame();
      setView("menu");
   }, [cancelMatchmaking, resetGame, setView]);

    const { handleAnswerSelect, sendRematch, acceptRematch, sendQuickChat, abortMatch, purgeAndReset: enginePurgeAndReset } = engine;
   const lastRoundPopup = engine.state.lastRoundPopup;

   // Read game state from store (synced by engine)
   const questions = useWordUpStore((s) => s.questions);
   const currentIdx = useWordUpStore((s) => s.currentIdx);
   const matchData = useWordUpStore((s) => s.matchData);
   const opponentStats = useWordUpStore((s) => s.opponentStats);
   const maxTime = useWordUpStore((s) => s.maxTime);
   const selectedAnswer = useWordUpStore((s) => s.selectedAnswer);
   const revealAnswers = useWordUpStore((s) => s.revealAnswers);
   const { rematchState, rematchCountdown, showRematchButton } = engine.state;

   // ── Recovery from refresh ─────────────────────────────────────────────
   useEffect(() => {
      const activeGameStr = safeLocalStorage.getItem("wordup_active_game");
      if (!activeGameStr) return;
      let mounted = true;
      let recoveryTimer: number | null = null;
      try {
         const activeGame = JSON.parse(activeGameStr);
         if (!activeGame || !activeGame.matchId || activeGame.matchData?.status === "completed") return;
         if (activeGame.role && !["player1", "player2"].includes(activeGame.role)) {
            safeLocalStorage.removeItem("wordup_active_game");
            return;
         }
         console.log("[WordUp Logs] Restoring active game from localStorage:", activeGame.matchId);

         const store = useWordUpStore.getState();
         store.setMatchId(activeGame.matchId);
         store.setRole(activeGame.role);
         store.setCategory(activeGame.category || "mixed");
         store.setQuestions(activeGame.questions || []);
         store.setCurrentIdx(activeGame.currentRound ?? activeGame.currentIdx ?? 0);
         store.setMatchData(activeGame.matchData);
         store.setOpponentStats(activeGame.opponentStats);
         store.setRevealAnswers(activeGame.revealAnswers || false);
         store.setSelectedAnswer(activeGame.selectedAnswer || null);

         launchedMatchRef.current = activeGame.matchId;

          recoveryTimer = window.setTimeout(async () => {
             if (!mounted) return;
             await startMatchRef.current?.(activeGame.matchId, activeGame.role);
          }, 100);
      } catch (err) {
         console.error("[WordUp Logs] Failed to restore active game:", err);
      }
      return () => {
         mounted = false;
         if (recoveryTimer !== null) clearTimeout(recoveryTimer);
      };
   // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);

   // ── Purge and reset ──────────────────────────────────────────────────
   const handlePurgeAndReset = useCallback(async () => {
      await enginePurgeAndReset();
      cancelMatchmaking();
   }, [enginePurgeAndReset, cancelMatchmaking]);

   const cancelMatchmakingRef = useRef(cancelMatchmaking);
   useEffect(() => { cancelMatchmakingRef.current = cancelMatchmaking; }, [cancelMatchmaking]);

   useEffect(() => { engineCleanupRef.current = engine.cleanup; }, [engine.cleanup]);
   useEffect(() => { startMatchRef.current = engine.startMatch; }, [engine.startMatch]);

   useEffect(() => {
      return () => {
         cancelMatchmakingRef.current();
         engineCleanupRef.current?.();
        const state = useWordUpStore.getState();
        if (!(state.view === "battle" || state.view === "countdown" || state.view === "gameover" || state.view === "loading") || !state.matchId) resetGame();
      };
   // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [resetGame]);

   // ── History match viewer ──────────────────────────────────────────────
   const handleSelectHistoryMatch = useCallback(async (match: any) => {
      if (!effectiveUser) return;
      try {
         const seenStr = safeLocalStorage.getItem("wordup_seen_matches");
         const seen = seenStr ? JSON.parse(seenStr) : [];
         if (!seen.includes(match.id)) { seen.push(match.id); safeLocalStorage.setItem("wordup_seen_matches", JSON.stringify(seen)); }
      } catch (e) { console.error("Failed to mark history match as seen:", e); }

      const myRole = match.player1_id === effectiveUser.id ? "player1" : "player2";
      setRole(myRole as any);
      setMatchData(match);
      try { const dec = await decryptMatchQuestions(match); setQuestions(dec); }
      catch (e) { console.error("Failed to decrypt history match questions:", e); }
      setView("gameover");
   }, [effectiveUser, setRole, setMatchData, setQuestions, setView]);

   // ── Render ────────────────────────────────────────────────────────────
   if (!effectiveUser) {
      return (
         <div className="w-full max-w-md mx-auto h-full flex flex-col justify-center items-center bg-dark p-6 text-center space-y-6">
            <div className="inline-flex p-4 bg-correct/10 rounded-3xl border border-correct/20 text-correct shadow-[0_0_20px_rgba(46,204,113,0.15)] animate-pulse">
               <Swords size={32} />
            </div>
            <div className="space-y-2">
               <h2 className="text-2xl font-black uppercase tracking-wider text-white">WordUp Battles</h2>
               <p className="text-xs text-gray-400 max-w-xs mx-auto">Log in to save stats permanently, or enter a nickname to play as a guest!</p>
            </div>

            {!showGuestInput ? (
               <div className="grid grid-cols-1 gap-3 w-full max-w-xs">
                  <button onClick={() => window.dispatchEvent(new CustomEvent("open-auth-modal"))}
                     className="bg-correct text-black py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2">
                     Log In / Sign Up
                  </button>
                  <button onClick={() => setShowGuestInput(true)}
                     className="bg-white/10 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-white/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center border border-white/5">
                     Play as Guest
                  </button>
               </div>
            ) : (
               <div className="space-y-3 w-full max-w-xs">
                  <input type="text" maxLength={WORDUP_LIMITS.MAX_NICKNAME_LENGTH} placeholder="Enter nickname..." value={nicknameInput}
                     onChange={(e) => setNicknameInput(e.target.value.replace(/[^A-Za-z0-9_]/g, ""))}
                     className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:border-correct outline-none uppercase text-center font-black tracking-widest text-correct" />
                  <div className="grid grid-cols-2 gap-3">
                     <button onClick={() => setShowGuestInput(false)}
                        className="bg-white/5 text-white py-3.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all border border-white/5 cursor-pointer">Back</button>
                     <button onClick={async () => {
                        const name = nicknameInput.trim();
                        if (name.length < WORDUP_LIMITS.MIN_NICKNAME_LENGTH) { triggerToast("Nickname must be at least 3 characters.", WORDUP_TIMEOUT.TOAST_DURATION); return; }
                        const anonId = crypto.randomUUID();
                        localStorage.setItem('wordle_anon_id', anonId);
                        localStorage.setItem('wordle_anon_username', name);
                        await supabase.from('guest_profiles').upsert({ id: anonId, username: name, avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${anonId}` });
                        setGuestUser({ id: anonId, username: name, user_metadata: { full_name: name } });
                        triggerToast("Guest profile created! Welcome.", WORDUP_TIMEOUT.TOAST_DURATION);
                     }}
                        className="bg-correct text-black py-3.5 rounded-xl text-xs font-black uppercase tracking-widest hover:brightness-110 transition-all cursor-pointer">Play</button>
                  </div>
               </div>
            )}
         </div>
      );
   }

   return (
      <div className={`w-full ${view === "battle" ? "max-w-2xl" : "max-w-lg"} mx-auto h-full flex flex-col bg-dark overflow-y-auto scrollbar-hide pt-4 px-4 pb-4 relative`} style={{ minHeight: "100%" }}>
         <AnimatePresence mode="wait">
            {view === "menu" && (
               <LobbyView
                  userStats={userStats} category={category} setCategory={setCategory}
                  startMatchmaking={() => { setView("connecting"); startMatchmaking(); }}
                  getRankColor={getRankColor} onlineUsers={onlineUsers} allProfiles={allProfiles}
                  currentUser={effectiveUser} onSelectHistoryMatch={handleSelectHistoryMatch}
                  soundEnabled={soundEnabled} onToggleSound={handleToggleSound}
                  onPurgeAndReset={handlePurgeAndReset}
                  onBack={() => useAppStore.getState().setWordUpOpen(false)}
               />
            )}
            {view === "matchmaking" && (
               <MatchmakingView category={category} cancelMatchmaking={handleCancelMatchmaking} countdownSecs={countdownSecs} />
            )}
            {view === "connecting" && <ConnectingView message={matchId ? "Connecting to opponent..." : undefined} />}
            {view === "countdown" && (
               <CountdownView countdownText={String(engine.state.countdownText || "3")} />
            )}
            {view === "loading" && <LoadingView onCancel={abortMatch} />}
             {view === "battle" && (
                <BattleView
                   questions={questions} currentIdx={currentIdx} matchData={matchData}
                   opponentStats={opponentStats} maxTime={maxTime} selectedAnswer={selectedAnswer}
                   revealAnswers={revealAnswers} handleAnswerSelect={handleAnswerSelect}
                   role={role} playerProfile={profile} sendQuickChat={sendQuickChat}
                   onAbort={abortMatch} lastRoundPopup={lastRoundPopup}
                />
             )}
            {view === "gameover" && (
               <GameOverView
                  matchData={matchData}
                  setView={(newView) => {
                     if (newView === "menu") { resetGame(); }
                      else if (newView === "matchmaking") {
                         engineCleanupRef.current?.();
                         resetGame();
                        setView("connecting");
                        startMatchmaking();
                     }
                  }}
                  role={role} rematchState={rematchState} rematchCountdown={rematchCountdown}
                  showRematchButton={showRematchButton} sendRematch={sendRematch}
                  acceptRematch={() => acceptRematch(onMatchFound)}
               />
            )}
         </AnimatePresence>
         <ConnectionOverlay realtimeStatus={realtimeStatus} view={view} />
      </div>
   );
};

export default WordUpView;
