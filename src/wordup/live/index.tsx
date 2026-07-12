/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback, useEffect, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { useAuth } from "../../hooks/useAuth";
import { useApp } from "../../context/AppContext";
import { useServerTime } from "../shared/useServerTime";
import { useWordUpProfile } from "../shared/useWordUpProfile";
import { useWordUpMatchmaking } from "./hooks/useMatchmaking";
import { useGameEngine } from "./hooks/useGameEngine.new";
import { useSignalStrength } from "./hooks/useSignalStrength";
import { wordupAudio } from "../../utils/wordupAudio";
import { supabase } from "../../lib/supabaseClient";
import { Swords, Volume2, VolumeX } from "lucide-react";

import { decryptMatchQuestions } from "../../utils/wordupQuestionGenerator";

import { LobbyView } from "./components/LobbyView";
import { MatchmakingView } from "../shared/MatchmakingView";
import { CountdownView } from "./components/CountdownView";
import { BattleView } from "./components/BattleView";
import { GameOverView } from "./components/GameOverView";
import { LoadingView } from "../shared/LoadingView";
import { ConnectionOverlay } from "../shared/ConnectionOverlay";
import { ConnectingView } from "./components/ConnectingView";
import { safeLocalStorage } from "../../utils/storage";

import { RATING, XP, WORDUP_TIMEOUT, WORDUP_LIMITS, BOT_PROFILES_RATINGS } from "../../constants/wordup";
import { useLiveStore } from "./store/useLiveStore";

interface LiveViewProps {
   onBack?: () => void;
   onSwitchMode?: (mode: "live" | "async") => void;
   onTutorial?: () => void;
   onBackToClassic?: () => void;
}

export const LiveView = ({ onBack, onSwitchMode, onTutorial, onBackToClassic }: LiveViewProps) => {
   const { user: authUser, loading: authLoading } = useAuth();
   const { triggerToast, realtimeStatus, profile, onlineUsers } = useApp();

   const [guestUser, setGuestUser] = useState<any>(() => {
      const id = localStorage.getItem('wordle_anon_id');
      const username = localStorage.getItem('wordle_anon_username');
      if (id && username) return { id, username, user_metadata: { full_name: username } };
      return null;
   });

   const effectiveUser = authUser || guestUser;
   const [showGuestInput, setShowGuestInput] = useState(false);
   const [nicknameInput, setNicknameInput] = useState("");

   const view = useLiveStore((s) => s.view);
   const setView = useLiveStore((s) => s.setView);
   const setIsBattlePlaying = useLiveStore((s) => s.setIsBattlePlaying);
   const category = useLiveStore((s) => s.category);
   const setCategory = useLiveStore((s) => s.setCategory);
   const matchId = useLiveStore((s) => s.matchId);
   const setMatchId = useLiveStore((s) => s.setMatchId);
   const role = useLiveStore((s) => s.role);
   const setRole = useLiveStore((s) => s.setRole);
   const resetGame = useLiveStore((s) => s.resetGame);
   const setMatchData = useLiveStore((s) => s.setMatchData);
   const setQuestions = useLiveStore((s) => s.setQuestions);

   const { getSyncedNow } = useServerTime();
   const { userStats, getRankColor, updateStats } = useWordUpProfile(effectiveUser);

   const [soundEnabled, setSoundEnabled] = useState(wordupAudio.isEnabled());

   const handleToggleSound = useCallback(() => {
      const newVal = !soundEnabled;
      setSoundEnabled(newVal);
      wordupAudio.setEnabled(newVal);
   }, [soundEnabled]);

   useEffect(() => {
      if (view === "menu") {
         onBack?.();
      }
   }, [view, onBack]);

   const matchDataFromStore = useLiveStore((s) => s.matchData);
   const gameType = !matchDataFromStore ? null
      : matchDataFromStore.game_type
         ? matchDataFromStore.game_type
         : matchDataFromStore.is_bot_match
            ? "live-bot"
            : "live";

   const onGameOver = useCallback(async (match: any) => {
      if (useLiveStore.getState().view === "gameover") return;
      setView("gameover");
      setMatchId(null);
      setRole(null);

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
         const storeOppStats = useLiveStore.getState().opponentStats;
         if (storeOppStats?.rating) oppRating = storeOppStats.rating;
      }

      const expected = 1 / (1 + Math.pow(10, (oppRating - myRating) / RATING.DIVISOR));
      const actual = won ? 1 : tied ? 0.5 : 0;
      const baseEloChange = Math.round(RATING.K_FACTOR * (actual - expected));
      const accuracyBonus = won ? correctCount : 0;

      let eloGain = baseEloChange + accuracyBonus;
      if (won && eloGain < RATING.MIN_GAIN_ON_WIN) eloGain = RATING.MIN_GAIN_ON_WIN;
      if (!won && !tied && eloGain < RATING.MAX_LOSS_ON_LOSS) eloGain = RATING.MAX_LOSS_ON_LOSS;

      try { await updateStats(eloGain, xpReward, won, tied, match.category); }
      catch { triggerToast("Rating update delayed. Syncing in background...", WORDUP_TIMEOUT.TOAST_DURATION); }

      // Fire-and-forget: record handcrafted question answers for difficulty tracking
      try {
         const questions = useLiveStore.getState().questions;
         const userAnswers = isP1 ? match.p1_answers : match.p2_answers;
         if (questions?.length > 0 && userAnswers?.length > 0) {
            const hcIds: string[] = [];
            const corrects: boolean[] = [];
            const timesTaken: number[] = [];
            for (const a of userAnswers) {
               const q = questions[a.question_idx];
               const hcId = q && (q as any).id;
               if (hcId) {
                  hcIds.push(hcId);
                  corrects.push(!!a.correct);
                  timesTaken.push(a.time_taken ?? 0);
               }
            }
            if (hcIds.length > 0) {
               await supabase.rpc("record_match_answers", {
                  p_user_id: effectiveUser.id,
                  p_topic_slug: match.category || "general_knowledge",
                  p_question_ids: hcIds,
                  p_corrects: corrects,
                  p_times_taken: timesTaken,
               });
            }
         }
      } catch { /* best-effort difficulty tracking */ }

      // Save bot match record to DB with retry queue
      if (match.is_bot_match) {
          const record = {
             id: match.id,
             category: match.category,
             player1_id: effectiveUser.id,
             player2_id: "00000000-0000-0000-0000-000000000b0b",
             is_bot_match: true,
             bot_profile: match.bot_profile,
             status: "completed",
             game_type: "live-bot",
             p1_score: match.p1_score,
             p2_score: match.p2_score,
             p1_answers: match.p1_answers || [],
             p2_answers: match.p2_answers || [],
             questions: match.questions || null,
             encryption_key: match.encryption_key || null,
             p1_answered: true,
             p2_answered: true,
            completed_at: match.completed_at || new Date().toISOString(),
         };
         const PENDING_KEY = "wordup_pending_bot_matches";
         const getPending = () => { try { return JSON.parse(safeLocalStorage.getItem(PENDING_KEY) || "[]"); } catch { return []; } };
         const setPending = (list: any[]) => safeLocalStorage.setItem(PENDING_KEY, JSON.stringify(list));
          const pending = getPending();
          pending.push(record);
          setPending(pending);
          try {
            await supabase.from("wordup_matches").insert(record);
            setPending(getPending().filter((m: any) => m.id !== record.id));
         } catch (e) {
            console.warn("[LiveView] Bot match DB save failed, queued for retry:", e);
         }
      }
   }, [effectiveUser, updateStats, triggerToast, role, userStats, setView, setMatchId, setRole]);

   const onRematchAccepted = useCallback((newMId: string, newRole: "player1" | "player2") => {
      launchedMatchRef.current = newMId;
      setMatchId(newMId);
      setRole(newRole);
      startMatchRef.current?.(newMId, newRole);
   }, [setMatchId, setRole]);

    const engine = useGameEngine({
       gameType: gameType as any || "live-bot",
       matchId,
       role,
       getSyncedNow,
       triggerToast,
       onGameOver,
       onRematchAccepted,
       userId: effectiveUser?.id,
    });

   const launchedMatchRef = useRef<string | null>(null);
   const startMatchRef = useRef<((mId: string, role: "player1" | "player2") => void) | null>(null);
   const engineCleanupRef = useRef<(() => void) | null>(null);
   // eslint-disable-next-line react-hooks/immutability, react-hooks/refs
   startMatchRef.current = engine.startMatch;
   // eslint-disable-next-line react-hooks/refs
   engineCleanupRef.current = engine.cleanup;

   const onMatchFound = useCallback((mId: string, mRole: "player1" | "player2") => {
      // eslint-disable-next-line react-hooks/immutability
      launchedMatchRef.current = mId;
      setMatchId(mId);
      setRole(mRole);
      startMatchRef.current?.(mId, mRole);
   }, [setMatchId, setRole]);

   useEffect(() => {
      if (matchId && role && matchId !== launchedMatchRef.current && (view === "menu" || view === "matchmaking" || view === "gameover" || view === "loading" || view === "connecting")) {
         // eslint-disable-next-line react-hooks/immutability
         launchedMatchRef.current = matchId;
         startMatchRef.current?.(matchId, role);
      }
   }, [matchId, role, view]);

   useEffect(() => {
      setIsBattlePlaying(view === "battle");
   }, [view, setIsBattlePlaying]);

   const otherOnlineCount = onlineUsers.filter(u => u.id !== effectiveUser?.id).length;

   const {
      countdownSecs,
      startMatchmaking,
      cancelMatchmaking
   } = useWordUpMatchmaking(effectiveUser, category, getSyncedNow, triggerToast, onMatchFound, () => { engine.cleanup(); }, otherOnlineCount);

   const handleCancelMatchmaking = useCallback(async () => {
      await cancelMatchmaking();
      resetGame();
      onBack?.();
   }, [cancelMatchmaking, resetGame, onBack]);

   const { handleAnswerSelect, sendRematch, acceptRematch, abortMatch, purgeAndReset: enginePurgeAndReset } = engine;
   const lastRoundPopup = engine.state.lastRoundPopup;
   const phase = engine.state.phase;

   const questions = useLiveStore((s) => s.questions);
   const currentIdx = useLiveStore((s) => s.currentIdx);
   const matchData = useLiveStore((s) => s.matchData);
   const opponentStats = useLiveStore((s) => s.opponentStats);
   const maxTime = useLiveStore((s) => s.maxTime);
   const selectedAnswer = useLiveStore((s) => s.selectedAnswer);
   const revealAnswers = useLiveStore((s) => s.revealAnswers);
   const { rematchState, rematchCountdown, showRematchButton } = engine.state;

   const waitingForOpponent = view === "battle" && gameType === "live" && selectedAnswer !== null && !revealAnswers && phase === "playing" && currentIdx === 6;

   const playerSignalLevel = useSignalStrength();
   const prevSignalRef = useRef(0);
   useEffect(() => {
      if (view !== "battle") return;
      const level = playerSignalLevel;
      if (level !== prevSignalRef.current) {
         prevSignalRef.current = level;
         engine.sendSignalUpdate(level);
      }
      const interval = setInterval(() => {
         engine.sendSignalUpdate(playerSignalLevel);
      }, 15000);
      return () => clearInterval(interval);
   }, [view, playerSignalLevel, engine.sendSignalUpdate]);

   const handlePurgeAndReset = useCallback(async () => {
      await enginePurgeAndReset();
      cancelMatchmaking();
   }, [enginePurgeAndReset, cancelMatchmaking]);

   const cancelMatchmakingRef = useRef(cancelMatchmaking);
   useEffect(() => { cancelMatchmakingRef.current = cancelMatchmaking; }, [cancelMatchmaking]);

   useEffect(() => { engineCleanupRef.current = engine.cleanup; }, [engine.cleanup]);
   // eslint-disable-next-line react-hooks/immutability
   useEffect(() => { startMatchRef.current = engine.startMatch; }, [engine.startMatch]);

    useEffect(() => {
       return () => {
          const state = useLiveStore.getState();
          if (state.view === "connecting" || state.view === "matchmaking") return;
          cancelMatchmakingRef.current();
          engineCleanupRef.current?.();
          if (!(state.view === "battle" || state.view === "countdown" || state.view === "gameover" || state.view === "loading") || !state.matchId) resetGame();
       };
    }, [resetGame]);

     const autoStartMatchmaking = useLiveStore((s) => s.autoStartMatchmaking);
     const setAutoStartMatchmaking = useLiveStore((s) => s.setAutoStartMatchmaking);
     const vsBotOnly = useLiveStore((s) => s.vsBotOnly);
     const setVsBotOnly = useLiveStore((s) => s.setVsBotOnly);

     useEffect(() => {
        if (vsBotOnly && effectiveUser && (view === "menu" || view === "connecting")) {
           setVsBotOnly(false);
           if (view === "menu") {
              resetGame();
              setView("connecting");
           }
           startMatchmaking(true);
        } else if (autoStartMatchmaking && effectiveUser && (view === "menu" || view === "connecting")) {
           setAutoStartMatchmaking(false);
           if (view === "menu") {
              resetGame();
              setView("connecting");
           }
           startMatchmaking(false);
        }
     }, [autoStartMatchmaking, vsBotOnly, effectiveUser, view, resetGame, setView, startMatchmaking, setAutoStartMatchmaking, setVsBotOnly]);

   // Retry pending bot match saves on mount
   useEffect(() => {
      const PENDING_KEY = "wordup_pending_bot_matches";
      let cancelled = false;
      (async () => {
         const pending = JSON.parse(safeLocalStorage.getItem(PENDING_KEY) || "[]");
         for (const record of pending) {
            if (cancelled) break;
            try {
               await supabase.from("wordup_matches").insert(record);
               if (!cancelled) {
                  const remaining = JSON.parse(safeLocalStorage.getItem(PENDING_KEY) || "[]");
                  safeLocalStorage.setItem(PENDING_KEY, JSON.stringify(remaining.filter((m: any) => m.id !== record.id)));
               }
             } catch {
                // ignore
             }
         }
      })();
      return () => { cancelled = true; };
   }, []);

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

   if (authLoading) {
      return (
         <div className="w-full max-w-md mx-auto h-full flex flex-col justify-center items-center bg-linear-to-b from-correct/15 to-dark p-6 text-center">
            <div className="w-10 h-10 border-4 border-correct/30 border-t-correct rounded-full animate-spin" />
            <p className="text-xs text-gray-400 mt-4 font-bold uppercase tracking-widest">Loading Session...</p>
         </div>
      );
   }

   if (!effectiveUser) {
      return (
         <div className="w-full max-w-md mx-auto h-full flex flex-col justify-center items-center bg-linear-to-b from-correct/15 to-dark p-6 text-center space-y-6">
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
      <div className={`w-full ${view === "battle" ? "max-w-2xl" : "max-w-lg"} mx-auto h-full flex flex-col bg-linear-to-b from-correct/15 to-dark overflow-y-auto scrollbar-hide pt-4 px-4 pb-4 relative`} style={{ minHeight: "100%" }}>
         <AnimatePresence mode="wait">
            {view === "menu" && (
               <LobbyView
                  userStats={userStats} category={category} setCategory={setCategory}
                  startMatchmaking={() => { resetGame(); setView("connecting"); startMatchmaking(); }}
                  getRankColor={getRankColor}
                  currentUser={effectiveUser} onSelectHistoryMatch={handleSelectHistoryMatch}
                  soundEnabled={soundEnabled} onToggleSound={handleToggleSound}
                  onPurgeAndReset={handlePurgeAndReset}
                   onSwitchMode={() => onSwitchMode?.("async")}
                    onBack={() => onBack?.()}
                    onTutorial={onTutorial}
                    onBackToClassic={onBackToClassic}
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
                   role={role} playerProfile={profile}
                  onAbort={abortMatch} lastRoundPopup={lastRoundPopup}
                   waitingForOpponent={waitingForOpponent}
                   playerSignalLevel={playerSignalLevel}
                    opponentSignalLevel={matchDataFromStore?.is_bot_match ? playerSignalLevel : engine.opponentSignalLevel}
                 />
              )}
              {view === "gameover" && (
                <GameOverView
                   matchData={matchData}
                   setView={(newView) => {
                      if (newView === "menu") { resetGame(); onBack?.(); }
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
          {view !== "menu" && (
             <button
                onClick={handleToggleSound}
                className="absolute top-4 right-4 z-10 p-2 rounded-xl bg-black/20 hover:bg-black/40 border border-white/10 text-gray-400 hover:text-white transition-all cursor-pointer"
                title="Toggle Sound"
             >
                {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
             </button>
          )}
       </div>
   );
};

export default LiveView;
