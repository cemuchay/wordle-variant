/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from "react";
import { LiveView } from "./live";
import { AsyncView } from "./async";
import { UnifiedLobby } from "./unified/UnifiedLobby";
import { useAuth } from "../hooks/useAuth";
import { useApp } from "../context/AppContext";
import { useWordUpProfile } from "./shared/useWordUpProfile";
import { useAsyncMatchmaking } from "./async/hooks/useMatchmaking";
import { useLiveStore } from "./live/store/useLiveStore";
import { useAsyncStore } from "./async/store/useAsyncStore";
import { decryptMatchQuestions } from "../utils/wordupQuestionGenerator";
import { wordupAudio } from "../utils/wordupAudio";

interface WordUpContainerProps {
   wordupMode: "live" | "async" | null;
   setWordupMode: (mode: "live" | "async" | null) => void;
   onTutorial: () => void;
   onBackToClassic?: () => void;
}

export const WordUpContainer = ({
   wordupMode,
   setWordupMode,
   onTutorial,
   onBackToClassic,
}: WordUpContainerProps) => {
   const { user: authUser } = useAuth();
   const { triggerToast, allProfiles } = useApp();

   const [guestUser] = useState<any>(() => {
      const id = localStorage.getItem("wordle_anon_id");
      const username = localStorage.getItem("wordle_anon_username");
      if (id && username) return { id, username, user_metadata: { full_name: username } };
      return null;
   });

   const effectiveUser = authUser || guestUser;

   const { userStats, getRankColor } = useWordUpProfile(effectiveUser);
   const { loadPendingMatches } = useAsyncMatchmaking(effectiveUser, "mixed", triggerToast);

   const [pendingMatches, setPendingMatches] = useState<any[]>([]);
   const [soundEnabled, setSoundEnabled] = useState(() => wordupAudio.isEnabled());
   const [showSoundPrompt, setShowSoundPrompt] = useState(false);
   const [lastCategory, setLastCategory] = useState<string | null>(null);

   useEffect(() => {
      const todayStr = new Date().toISOString().split("T")[0];
      const lastPromptDate = localStorage.getItem("wordup_sound_prompt_date");
      const isSoundOff = !wordupAudio.isEnabled();
      if (lastPromptDate !== todayStr && isSoundOff) {
         localStorage.setItem("wordup_sound_prompt_date", todayStr);
         // eslint-disable-next-line react-hooks/set-state-in-effect
         setShowSoundPrompt(true);
      } else if (lastPromptDate !== todayStr) {
         localStorage.setItem("wordup_sound_prompt_date", todayStr);
      }
   }, []);

   const refreshPending = useCallback(async () => {
      if (effectiveUser) {
         const pending = await loadPendingMatches();
         setPendingMatches(pending);
      }
   }, [effectiveUser, loadPendingMatches]);

   useEffect(() => {
      Promise.resolve().then(() => {
         refreshPending();
      });
   }, [effectiveUser?.id, refreshPending]);

   // Bridge: Play Live Match from Unified Lobby
   const handlePlayLive = useCallback((catId: string, vsBot = false) => {
      setLastCategory(catId);
      useLiveStore.getState().setCategory(catId);
      useLiveStore.getState().resetGame();
      useLiveStore.getState().setView("connecting");
      useLiveStore.getState().setAutoStartMatchmaking(!vsBot);
      useLiveStore.getState().setVsBotOnly(vsBot);
      setWordupMode("live");
   }, [setWordupMode]);

   // Bridge: Play Async Challenge from Unified Lobby
   const handlePlayAsync = useCallback((targetUser: any, catId: string) => {
      setLastCategory(catId);
      useAsyncStore.getState().setCategory(catId);
      useAsyncStore.getState().resetGame();
      useAsyncStore.getState().setView("menu");
      useAsyncStore.getState().setPendingChallengePlayer(targetUser);
      setWordupMode("async");
   }, [setWordupMode]);

   // Bridge: Play Async Turn from Unified Lobby
   const handlePlayAsyncTurn = useCallback((match: any) => {
      useAsyncStore.getState().resetGame();
      const mRole = match.player1_id === effectiveUser?.id ? "player1" : "player2";
      useAsyncStore.getState().setMatchId(match.id);
      useAsyncStore.getState().setRole(mRole);
      useAsyncStore.getState().setCategory(match.category);
      useAsyncStore.getState().setView("loading");

      // Pre-populate opponent stats from match profile details if available
      const oppProfile = mRole === "player1" ? match.player2 : match.player1;
      const oppId = mRole === "player1" ? match.player2_id : match.player1_id;
      if (oppProfile && oppId) {
         useAsyncStore.getState().setOpponentStats({
            id: oppId,
            username: oppProfile.username || "Opponent",
            avatar_url: oppProfile.avatar_url || null,
            rating: oppProfile.rating || 600,
            rank_name: oppProfile.rank_name || "Bronze",
            xp: oppProfile.xp || 0,
            games_played: oppProfile.games_played || 0,
            games_won: oppProfile.games_won || 0,
            games_lost: oppProfile.games_lost || 0,
            games_tied: oppProfile.games_tied || 0,
         });
      }

      setWordupMode("async");
   }, [effectiveUser?.id, setWordupMode]);

   // Bridge: Review History Match from Unified Lobby
   const handleSelectHistoryMatch = useCallback(async (match: any) => {
      if (!effectiveUser) return;
      const isAsync = match.game_type === "async" || !!match.encrypted_questions;
      const myRole = match.player1_id === effectiveUser.id ? "player1" : "player2";

      if (isAsync) {
         useAsyncStore.getState().setMatchId(match.id);
         useAsyncStore.getState().setRole(myRole);
         useAsyncStore.getState().setCategory(match.category);
         useAsyncStore.getState().setMatchData(match);
         try {
            const decrypted = await decryptMatchQuestions(match);
            useAsyncStore.getState().setQuestions(decrypted);
            useAsyncStore.getState().setView("gameover");
            setWordupMode("async");
         } catch (e) {
            console.warn("Failed to decrypt history match questions:", e);
         }
      } else {
         useLiveStore.getState().setMatchId(match.id);
         useLiveStore.getState().setRole(myRole);
         useLiveStore.getState().setCategory(match.category);
         useLiveStore.getState().setMatchData(match);
         try {
            const decrypted = await decryptMatchQuestions(match);
            useLiveStore.getState().setQuestions(decrypted);
            useLiveStore.getState().setView("gameover");
            setWordupMode("live");
         } catch (e) {
            console.warn("Failed to decrypt history match questions:", e);
         }
      }
   }, [effectiveUser, setWordupMode]);

   return (
      <>
         {wordupMode === null && (
            <UnifiedLobby
               userStats={userStats}
               getRankColor={getRankColor}
               allProfiles={allProfiles}
               currentUser={effectiveUser}
               onSelectHistoryMatch={handleSelectHistoryMatch}
               soundEnabled={soundEnabled}
               onToggleSound={() => {
                  const val = !soundEnabled;
                  wordupAudio.setEnabled(val);
                  setSoundEnabled(val);
               }}
               onPlayLive={handlePlayLive}
               onPlayAsync={handlePlayAsync}
               onPlayAsyncTurn={handlePlayAsyncTurn}
               pendingMatches={pendingMatches}
               onRefreshPending={refreshPending}
               onBackToClassic={onBackToClassic}
               onTutorial={onTutorial}
               restoreCategory={lastCategory}
            />
         )}

         {wordupMode === "live" && (
            <LiveView
               onBack={() => setWordupMode(null)}
               onSwitchMode={setWordupMode}
               onTutorial={onTutorial}
               onBackToClassic={onBackToClassic}
            />
         )}

         {wordupMode === "async" && (
            <AsyncView
               onBack={() => setWordupMode(null)}
               onSwitchMode={setWordupMode}
               onTutorial={onTutorial}
               onBackToClassic={onBackToClassic}
            />
         )}

         {showSoundPrompt && (
            <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
               <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-5 max-w-xs w-full shadow-2xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
                  <div className="w-12 h-12 rounded-full bg-[#E85151]/10 border border-[#E85151]/20 flex items-center justify-center mx-auto text-xl">
                     🔊
                  </div>
                  <div className="space-y-1">
                     <h3 className="text-sm font-black uppercase tracking-wider text-white">Enable Game Sounds?</h3>
                     <p className="text-[11px] text-white/60 font-bold leading-normal">
                        Enhance your experience with in-game sound effects for correct answers, timers, and match results.
                     </p>
                  </div>
                  <div className="flex gap-2 pt-1">
                     <button
                        onClick={() => {
                           setShowSoundPrompt(false);
                        }}
                        className="flex-1 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-[9px] font-black uppercase tracking-wider text-white/60 hover:text-white transition-all cursor-pointer"
                     >
                        Keep Muted
                     </button>
                     <button
                        onClick={() => {
                           wordupAudio.setEnabled(true);
                           setSoundEnabled(true);
                           setShowSoundPrompt(false);
                        }}
                        className="flex-1 py-2.5 rounded-xl bg-[#E85151] hover:bg-[#d44343] text-[9px] font-black uppercase tracking-wider text-white shadow-md shadow-[#E85151]/20 transition-all cursor-pointer"
                     >
                        Enable
                     </button>
                  </div>
               </div>
            </div>
         )}
      </>
   );
};

export default WordUpContainer;