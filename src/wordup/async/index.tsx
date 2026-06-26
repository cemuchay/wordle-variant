import { useState, useCallback, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { Swords } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useApp } from "../../context/AppContext";
import { useServerTime } from "../shared/useServerTime";
import { useWordUpProfile } from "../shared/useWordUpProfile";
import { useAsyncMatchmaking } from "./hooks/useMatchmaking";
import { useGameEngine as useAsyncGameEngine } from "./hooks/useGameEngine";
import { wordupAudio } from "../../utils/wordupAudio";
import { supabase } from "../../lib/supabaseClient";
import { useAsyncStore } from "./store/useAsyncStore";
import { LobbyView } from "./components/LobbyView";
import { BattleView } from "./components/BattleView";
import { GameOverView } from "./components/GameOverView";
import { ConnectingView } from "./components/ConnectingView";
import { WORDUP_LIMITS, WORDUP_TIMEOUT } from "../../constants/wordup";
import { RATING, XP } from "../../constants/wordup";

interface AsyncViewProps {
   onBack?: () => void;
}

export const AsyncView = ({ onBack }: AsyncViewProps) => {
   const { user: authUser } = useAuth();
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

   const { handleAnswerSelect } = engine;
   const lastRoundPopup = engine.state.lastRoundPopup;

   const matchmaking = useAsyncMatchmaking(effectiveUser, category, triggerToast);

   // Hide global headers during battle
   useEffect(() => {
      setIsBattlePlaying(view === "battle");
   }, [view, setIsBattlePlaying]);

   // Load pending and history matches
   const refreshPending = useCallback(async () => {
      setIsLoadingData(true);
      const pending = await matchmaking.loadPendingMatches();
      setPendingMatches(pending);
      setIsLoadingData(false);
   }, [matchmaking]);

   const refreshHistory = useCallback(async () => {
      setIsLoadingData(true);
      const history = await matchmaking.loadHistoryMatches();
      setHistoryMatches(history);
      setIsLoadingData(false);
   }, [matchmaking]);

   useEffect(() => {
      if (effectiveUser) refreshPending();
   }, [effectiveUser?.id, refreshPending]);

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
      setView("loading");
      engine.startMatch?.(match.id, mRole);
   }, [effectiveUser, setMatchId, setRole, setView, engine]);

   const handleSelectHistoryMatch = useCallback(async (match: any) => {
      if (!effectiveUser) return;
      const myRole = match.player1_id === effectiveUser.id ? "player1" : "player2";
      setRole(myRole);
      setMatchData(match);
      setView("gameover");
   }, [effectiveUser, setRole, setMatchData, setView]);

   const handlePurgeAndReset = useCallback(() => {
      resetGame();
   }, [resetGame]);

   if (!effectiveUser) {
      return (
         <div className="w-full max-w-md mx-auto h-full flex flex-col justify-center items-center bg-dark p-6 text-center space-y-6">
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
         </div>
      );
   }

   return (
      <div className="w-full max-w-lg mx-auto h-full flex flex-col bg-dark overflow-y-auto scrollbar-hide pt-4 px-4 pb-4 relative" style={{ minHeight: "100%" }}>
         <AnimatePresence mode="wait">
            {view === "menu" && (
               <LobbyView
                  userStats={userStats} category={category} setCategory={setCategory}
                   getRankColor={getRankColor} onlineUsers={onlineUsers} allProfiles={allProfiles}
                  currentUser={effectiveUser} onSelectHistoryMatch={handleSelectHistoryMatch}
                  soundEnabled={soundEnabled} onToggleSound={handleToggleSound}
                  onPurgeAndReset={handlePurgeAndReset}
                  startChallenge={() => {}}
                  pendingMatches={pendingMatches} historyMatches={historyMatches}
                  isLoadingData={isLoadingData}
                  onPlayTurn={handlePlayTurn}
                  onSendInvite={async (targetUser) => {
                     const mId = await matchmaking.createMatch(targetUser);
                     if (mId) {
                        triggerToast("Challenge sent!", 3000);
                        refreshPending();
                     }
                  }}
                  onRefreshPending={refreshPending}
                  onRefreshHistory={refreshHistory}
                   onBack={() => onBack?.()}
               />
            )}
            {view === "loading" && <ConnectingView message="Loading your challenge..." />}
            {view === "battle" && (
               <BattleView
                  questions={questions} currentIdx={currentIdx} matchData={matchData}
                  opponentStats={opponentStats} maxTime={maxTime} selectedAnswer={selectedAnswer}
                  revealAnswers={revealAnswers} handleAnswerSelect={handleAnswerSelect}
                  role={role} playerProfile={profile} lastRoundPopup={lastRoundPopup}
               />
            )}
            {view === "turn_submitted" && (
               <div className="flex flex-col items-center justify-center flex-1 text-center px-6 py-12">
                  <div className="w-12 h-12 border-4 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin mb-6" />
                  <h2 className="text-xl font-black text-white tracking-wider">Turn Submitted!</h2>
                  <p className="text-sm text-gray-400 mt-3 leading-relaxed max-w-xs">
                     Your answers have been saved. Waiting for opponent to play their turn...
                  </p>
                  <button onClick={resetGame} className="mt-8 text-xs text-gray-500 hover:text-white font-bold uppercase tracking-wider underline transition-colors cursor-pointer">
                     Back to Lobby
                  </button>
               </div>
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
      </div>
   );
};

export default AsyncView;
