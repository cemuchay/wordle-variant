/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback, useEffect, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { Swords, Volume2, VolumeX } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useApp } from "../../context/AppContext";
import { useServerTime } from "../shared/useServerTime";
import { useWordUpProfile } from "../shared/useWordUpProfile";
import { useAsyncMatchmaking } from "./hooks/useMatchmaking";
import { useGameEngine as useAsyncGameEngine } from "./hooks/useGameEngine";
import { decryptMatchQuestions } from "../../utils/wordupQuestionGenerator";
import { wordupAudio } from "../../utils/wordupAudio";
import { supabase } from "../../lib/supabaseClient";
import { useAppStore } from "../../store/useAppStore";
import { useAsyncStore } from "./store/useAsyncStore";
import { LobbyView } from "./components/LobbyView";
import { PlayNowLaterPopup } from "./components/PlayNowLaterPopup";
import { BattleView } from "./components/BattleView";
import { GameOverView } from "./components/GameOverView";
import { LoadingView } from "../../components/wordup/WordUpView/components/LoadingView";
import { CountdownView } from "./components/CountdownView";
import { WORDUP_LIMITS, WORDUP_TIMEOUT } from "../../constants/wordup";
import { RATING, XP } from "../../constants/wordup";
import { safeLocalStorage } from "../../utils/storage";
import formatUsername from '../../utils/formatUsername';

interface AsyncViewProps {
   onBack?: () => void;
   onSwitchMode?: (mode: "live" | "async") => void;
}

export const AsyncView = ({ onBack, onSwitchMode }: AsyncViewProps) => {
   const { user: authUser, loading: authLoading } = useAuth();
   const { triggerToast, onlineUsers, profile, allProfiles } = useApp();

   const [guestUser, setGuestUser] = useState<any>(() => {
      const id = localStorage.getItem('wordle_anon_id');
      const username = localStorage.getItem('wordle_anon_username');
      if (id && username) return { id, username, user_metadata: { full_name: username } };
      return null;
   });

   const effectiveUser = authUser || guestUser;
   const [showGuestInput, setShowGuestInput] = useState(false);
   const [nicknameInput, setNicknameInput] = useState("");

   const view = useAsyncStore((s) => s.view);
   const setView = useAsyncStore((s) => s.setView);
   const setIsBattlePlaying = useAsyncStore((s) => s.setIsBattlePlaying);
   const category = useAsyncStore((s) => s.category);
   const setCategory = useAsyncStore((s) => s.setCategory);
   const matchId = useAsyncStore((s) => s.matchId);
   const setMatchId = useAsyncStore((s) => s.setMatchId);
   const role = useAsyncStore((s) => s.role);
   const setRole = useAsyncStore((s) => s.setRole);
   const resetGame = useAsyncStore((s) => s.resetGame);
   const setMatchData = useAsyncStore((s) => s.setMatchData);
   const questions = useAsyncStore((s) => s.questions);
   const setQuestions = useAsyncStore((s) => s.setQuestions);
   const currentIdx = useAsyncStore((s) => s.currentIdx);
   const matchData = useAsyncStore((s) => s.matchData);
   const opponentStats = useAsyncStore((s) => s.opponentStats);
   const maxTime = useAsyncStore((s) => s.maxTime);
   const selectedAnswer = useAsyncStore((s) => s.selectedAnswer);
   const revealAnswers = useAsyncStore((s) => s.revealAnswers);

   const [pendingMatches, setPendingMatches] = useState<any[]>([]);
   const [historyMatches, setHistoryMatches] = useState<any[]>([]);
   const [isLoadingData, setIsLoadingData] = useState(false);
   const [soundEnabled, setSoundEnabled] = useState(wordupAudio.isEnabled());
   const [pendingChallenge, setPendingChallenge] = useState<{ matchId: string; targetUser: any } | null>(null);
   const [connectingMsg, setConnectingMsg] = useState("Loading...");
   const challengeResolvedRef = useRef(false);
   const challengeChannelsRef = useRef<any[]>([]);
   const challengeTimersRef = useRef<number[]>([]);

   const { getSyncedNow } = useServerTime();
   const { userStats, getRankColor, updateStats } = useWordUpProfile(effectiveUser);

   const handleToggleSound = useCallback(() => {
      const newVal = !soundEnabled;
      setSoundEnabled(newVal);
      wordupAudio.setEnabled(newVal);
   }, [soundEnabled]);

   const engine = useAsyncGameEngine({
      gameType: "async",
      matchId,
      role,
      getSyncedNow,
      triggerToast,
      onGameOver: useCallback(async (match: any) => {
         if (useAsyncStore.getState().view === "gameover") return;
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
         const storeOppStats = useAsyncStore.getState().opponentStats;
         const oppRating = storeOppStats?.rating || RATING.DEFAULT_OPPONENT;
         const expected = 1 / (1 + Math.pow(10, (oppRating - myRating) / RATING.DIVISOR));
         const actual = won ? 1 : tied ? 0.5 : 0;
         const baseEloChange = Math.round(RATING.K_FACTOR * (actual - expected));
         const accuracyBonus = won ? correctCount : 0;
         let eloGain = baseEloChange + accuracyBonus;
         if (won && eloGain < RATING.MIN_GAIN_ON_WIN) eloGain = RATING.MIN_GAIN_ON_WIN;
         if (!won && !tied && eloGain < RATING.MAX_LOSS_ON_LOSS) eloGain = RATING.MAX_LOSS_ON_LOSS;
         try { await updateStats(eloGain, xpReward, won, tied); }
         catch { triggerToast("Rating update delayed. Syncing...", WORDUP_TIMEOUT.TOAST_DURATION); }
      }, [effectiveUser, updateStats, triggerToast, role, userStats, setView]),
   });

   const { handleAnswerSelect, startMatch } = engine;
   const lastRoundPopup = engine.state.lastRoundPopup;
   const countdownText = engine.state.countdownText;

   const { loadPendingMatches, loadHistoryMatches, createMatch } = useAsyncMatchmaking(effectiveUser, category, triggerToast);

   const clearChallengeResources = useCallback(() => {
      challengeResolvedRef.current = true;
      challengeChannelsRef.current.forEach((ch) => supabase.removeChannel(ch));
      challengeChannelsRef.current = [];
      challengeTimersRef.current.forEach((t) => clearTimeout(t));
      challengeTimersRef.current = [];
   }, []);

   const handleCancelChallenge = useCallback(() => {
      clearChallengeResources();
      challengeResolvedRef.current = true;
      setView("menu");
      triggerToast("Challenge cancelled.", WORDUP_TIMEOUT.TOAST_DURATION);
   }, [clearChallengeResources, setView, triggerToast]);

   const handleChallengePlayer = useCallback(async (targetUser: any) => {
      if (!effectiveUser) return;
      clearChallengeResources();
      challengeResolvedRef.current = false;

      setConnectingMsg("Creating challenge...");
      setView("loading");

      const mId = await createMatch(targetUser);
      if (!mId) {
         setView("menu");
         triggerToast("Failed to create challenge.", 4000);
         return;
      }

      const isOnline = onlineUsers.some((u: any) => u.id === targetUser.id);

      if (!isOnline) {
         setPendingChallenge({ matchId: mId, targetUser });
         setView("menu");
         return;
      }

      setConnectingMsg("Sending challenge...");

      const myName = formatUsername(effectiveUser.user_metadata?.username) || effectiveUser.email?.split("@")[0] || "Someone";

      const targetChannel = supabase.channel(`user_signals_${targetUser.id}`);
      challengeChannelsRef.current.push(targetChannel);
      targetChannel.subscribe((status) => {
         if (status === "SUBSCRIBED") {
            targetChannel.send({
               type: "broadcast",
               event: "wordup_async_invite",
               payload: {
                  senderId: effectiveUser.id,
                  senderName: myName,
                  category,
                  matchId: mId,
               },
            });
            setTimeout(() => supabase.removeChannel(targetChannel), 1000);
         }
      });

      const responseChannel = supabase.channel(`wordup_async_match_signals_${mId}`);
      challengeChannelsRef.current.push(responseChannel);
      responseChannel
         .on("broadcast", { event: "wordup_async_invite_accepted" }, async ({ payload }: any) => {
            if (challengeResolvedRef.current) return;
            challengeResolvedRef.current = true;
            clearChallengeResources();
            const acceptedMId = payload?.matchId || mId;
            if (effectiveUser) {
               setMatchId(acceptedMId);
               setRole("player1");
               setView("loading");
               startMatch?.(acceptedMId, "player1");
            } else {
               setView("menu");
               triggerToast("Failed to start match.", 4000);
            }
         })
         .on("broadcast", { event: "wordup_async_invite_later" }, () => {
            if (challengeResolvedRef.current) return;
            challengeResolvedRef.current = true;
            clearChallengeResources();
            setPendingChallenge({ matchId: mId, targetUser });
            setView("menu");
         })
         .on("broadcast", { event: "wordup_async_invite_declined" }, async ({ payload }: any) => {
            if (challengeResolvedRef.current) return;
            challengeResolvedRef.current = true;
            clearChallengeResources();
            setView("menu");
            triggerToast(`${payload?.senderName || "They"} declined your challenge.`, 3000);
            try {
               await supabase.from("wordup_async_matches").update({ status: "declined" }).eq("id", mId);
            } catch (err) {
               console.warn("Failed to set match status to declined:", err);
            }
         })
         .subscribe();

      setConnectingMsg("Waiting for response...");

      challengeTimersRef.current.push(window.setTimeout(() => {
         if (challengeResolvedRef.current) return;
         challengeResolvedRef.current = true;
         clearChallengeResources();
         setPendingChallenge({ matchId: mId, targetUser });
         setView("menu");
      }, 15000));
   }, [effectiveUser, onlineUsers, category, createMatch, setView, setMatchId, setRole, startMatch, triggerToast, clearChallengeResources]);

   // Hide global headers during battle
   useEffect(() => {
      setIsBattlePlaying(view === "battle");
   }, [view, setIsBattlePlaying]);

   // Auto-trigger startMatch when store is set externally (e.g., invite accept)
   useEffect(() => {
      if (view === "loading" && matchId && role && engine.state.phase === "idle") {
         startMatch?.(matchId, role);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [view, matchId, role, startMatch]);

   // Load pending and history matches
   const refreshPending = useCallback(async () => {
      setIsLoadingData(true);
      const pending = await loadPendingMatches();
      setPendingMatches(pending);
      setIsLoadingData(false);
   }, [loadPendingMatches]);

   const refreshHistory = useCallback(async () => {
      setIsLoadingData(true);
      const history = await loadHistoryMatches();
      setHistoryMatches(history);
      setIsLoadingData(false);
   }, [loadHistoryMatches]);

   useEffect(() => {
      // eslint-disable-next-line react-hooks/set-state-in-effect
       if (effectiveUser) refreshPending();
       // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [effectiveUser?.id, refreshPending]);

    // Recovery from refresh
    useEffect(() => {
       const activeGameStr = safeLocalStorage.getItem("wordup_async_active_game");
       if (!activeGameStr) return;
       let mounted = true;
       let recoveryTimer: number | null = null;
       try {
          const activeGame = JSON.parse(activeGameStr);
          if (!activeGame || !activeGame.matchId || activeGame.matchData?.status === "completed") return;
          if (activeGame.role && !["player1", "player2"].includes(activeGame.role)) {
             safeLocalStorage.removeItem("wordup_async_active_game");
             return;
          }
          console.log("[WordUp Logs] Restoring active async game from localStorage:", activeGame.matchId);

          const store = useAsyncStore.getState();
          store.setMatchId(activeGame.matchId);
          store.setRole(activeGame.role);
          store.setCategory(activeGame.matchData?.category || "mixed");
          store.setQuestions(activeGame.questions || []);
          store.setCurrentIdx(activeGame.currentRound ?? activeGame.currentIdx ?? 0);
          store.setMatchData(activeGame.matchData);
          store.setOpponentStats(activeGame.opponentStats);
          store.setRevealAnswers(activeGame.revealAnswers || false);
          store.setSelectedAnswer(activeGame.selectedAnswer || null);

          recoveryTimer = window.setTimeout(async () => {
             if (!mounted) return;
             await startMatch?.(activeGame.matchId, activeGame.role);
          }, 100);
       } catch (err) {
          console.error("[WordUp Logs] Failed to restore active async game:", err);
       }
       return () => {
          mounted = false;
          if (recoveryTimer !== null) clearTimeout(recoveryTimer);
       };
    }, [startMatch]);

   // Realtime listener for async match updates
   useEffect(() => {
      if (!effectiveUser?.id) return;
      const channel = supabase
         .channel(`wordup_async_lobby_${effectiveUser.id}`)
         .on("postgres_changes", { event: "*", schema: "public", table: "wordup_async_matches", filter: `player1_id=eq.${effectiveUser.id}` }, refreshPending)
         .on("postgres_changes", { event: "*", schema: "public", table: "wordup_async_matches", filter: `player2_id=eq.${effectiveUser.id}` }, refreshPending)
         .subscribe();
      return () => { supabase.removeChannel(channel); };
   }, [effectiveUser?.id, refreshPending]);



   const handlePlayTurn = useCallback((match: any) => {
      const mRole = match.player1_id === effectiveUser?.id ? "player1" : "player2";
      setMatchId(match.id);
      setRole(mRole);
      setCategory(match.category);
      setView("loading");
      startMatch?.(match.id, mRole);
   }, [effectiveUser, setMatchId, setRole, setCategory, setView, startMatch]);

   // Auto-load match from notification click (pendingAsyncMatchId)
   const pendingAsyncMatchId = useAppStore((s) => s.pendingAsyncMatchId);
   const setPendingAsyncMatchId = useAppStore((s) => s.setPendingAsyncMatchId);
   useEffect(() => {
      if (!effectiveUser?.id || view !== "menu" || !pendingAsyncMatchId) return;
      const mId = pendingAsyncMatchId;
      setPendingAsyncMatchId(null);
      supabase.from("wordup_async_matches").select("*").eq("id", mId).single().then(({ data }) => {
         if (data) handlePlayTurn(data);
      });
   }, [pendingAsyncMatchId, effectiveUser?.id, view, handlePlayTurn, setPendingAsyncMatchId]);

   const handleSelectHistoryMatch = useCallback(async (match: any) => {
      if (!effectiveUser) return;
      const myRole = match.player1_id === effectiveUser.id ? "player1" : "player2";
      setRole(myRole);
      setCategory(match.category);
      setMatchData(match);
      try {
         const decrypted = await decryptMatchQuestions(match);
         setQuestions(decrypted);
      } catch (e) {
         console.warn("Failed to decrypt history match questions:", e);
      }
      setView("gameover");
   }, [effectiveUser, setRole, setCategory, setMatchData, setQuestions, setView]);

   const handlePurgeAndReset = useCallback(() => {
      resetGame();
   }, [resetGame]);

   if (authLoading) {
      return (
         <div className="w-full max-w-md mx-auto h-full flex flex-col justify-center items-center bg-linear-to-b from-indigo-950/40 to-dark p-6 text-center">
            <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-xs text-gray-400 mt-4 font-bold uppercase tracking-widest">Loading Session...</p>
         </div>
      );
   }

   if (!effectiveUser) {
      return (
         <div className="w-full max-w-md mx-auto h-full flex flex-col justify-center items-center bg-linear-to-b from-indigo-950/40 to-dark p-6 text-center space-y-6">
            <div className="inline-flex p-4 bg-indigo-500/10 rounded-3xl border border-indigo-500/20 text-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.15)] animate-pulse">
               <Swords size={32} />
            </div>
            <div className="space-y-2">
               <h2 className="text-2xl font-black uppercase tracking-wider text-white">WordUp Challenges</h2>
               <p className="text-xs text-gray-400 max-w-xs mx-auto">Log in to save stats permanently, or enter a nickname to play as a guest!</p>
            </div>
            {!showGuestInput ? (
               <div className="grid grid-cols-1 gap-3 w-full max-w-xs">
                  <button onClick={() => window.dispatchEvent(new CustomEvent("open-auth-modal"))}
                     className="bg-indigo-500 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2">
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
                     className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:border-indigo-500 outline-none uppercase text-center font-black tracking-widest text-indigo-400" />
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
                        className="bg-indigo-500 text-white py-3.5 rounded-xl text-xs font-black uppercase tracking-widest hover:brightness-110 transition-all cursor-pointer">Play</button>
                  </div>
               </div>
          )}
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
   }

   return (
      <div className="w-full max-w-lg mx-auto h-full flex flex-col bg-linear-to-b from-indigo-950/40 to-dark overflow-y-auto scrollbar-hide pt-4 px-4 pb-4 relative" style={{ minHeight: "100%" }}>
         <AnimatePresence mode="wait">
            {view === "menu" && (
               <LobbyView
                  userStats={userStats} category={category} setCategory={setCategory}
                  getRankColor={getRankColor} allProfiles={allProfiles}
                  currentUser={effectiveUser} onSelectHistoryMatch={handleSelectHistoryMatch}
                  soundEnabled={soundEnabled} onToggleSound={handleToggleSound}
                  onPurgeAndReset={handlePurgeAndReset}
                  startChallenge={() => { }}
                  pendingMatches={pendingMatches} historyMatches={historyMatches}
                  isLoadingData={isLoadingData}
                  onPlayTurn={handlePlayTurn}
                  onChallengePlayer={handleChallengePlayer}
                  onRefreshPending={refreshPending}
                  onRefreshHistory={refreshHistory}
                  onSwitchMode={() => onSwitchMode?.("live")}
                  onBack={() => onBack?.()}
               />
            )}
            {view === "loading" && <LoadingView message={connectingMsg} onCancel={handleCancelChallenge} />}
            {view === "countdown" && <CountdownView countdownText={String(countdownText || "3")} />}
            {view === "battle" && (
               <BattleView
                  questions={questions} currentIdx={currentIdx} matchData={matchData}
                  opponentStats={opponentStats} maxTime={maxTime} selectedAnswer={selectedAnswer}
                  revealAnswers={revealAnswers} handleAnswerSelect={handleAnswerSelect}
                  role={role} playerProfile={profile} lastRoundPopup={lastRoundPopup}
               />
            )}
            {view === "turn_submitted" && (
               <GameOverView
                  matchData={matchData}
                  setView={(newView) => {
                     if (newView === "menu") resetGame();
                  }}
                  role={role}
               />
            )}
            {view === "gameover" && (
               <GameOverView
                  matchData={matchData}
                  setView={(newView) => {
                     if (newView === "menu") resetGame();
                  }}
                  role={role}
               />
            )}
         </AnimatePresence>

         {pendingChallenge && (
            <PlayNowLaterPopup
               opponentName={formatUsername(pendingChallenge.targetUser?.username || pendingChallenge.targetUser?.user_metadata?.full_name) || "Opponent"}
               category={category}
               onPlayNow={() => {
                  const pc = pendingChallenge;
                  setPendingChallenge(null);
                  setView("loading");
                  setMatchId(pc.matchId);
                  setRole("player1");
                  startMatch?.(pc.matchId, "player1");
               }}
               onLater={() => {
                  setPendingChallenge(null);
                  setView("menu");
                  triggerToast("Challenge saved. Play when you're ready!", 3000);
                  refreshPending();
               }}
            />
         )}
      </div>
   );
};

export default AsyncView;
