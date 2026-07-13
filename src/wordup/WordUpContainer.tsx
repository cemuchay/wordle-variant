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
   const [lastCategory, setLastCategory] = useState<string | null>(null);

   useEffect(() => {
      const todayStr = new Date().toISOString().split("T")[0];
      const lastPromptDate = localStorage.getItem("wordup_sound_prompt_date");
      const isSoundOff = !wordupAudio.isEnabled();
      if (lastPromptDate !== todayStr && isSoundOff) {
         localStorage.setItem("wordup_sound_prompt_date", todayStr);
         const enable = window.confirm("Would you like to enable in-game sound effects for WordUp?");
         if (enable) {
            wordupAudio.setEnabled(true);
            setSoundEnabled(true);
         }
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

   if (wordupMode === null) {
      return (
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
      );
   }

   if (wordupMode === "live") {
      return (
         <LiveView
            onBack={() => setWordupMode(null)}
            onSwitchMode={setWordupMode}
            onTutorial={onTutorial}
            onBackToClassic={onBackToClassic}
         />
      );
   }

   return (
      <AsyncView
         onBack={() => setWordupMode(null)}
         onSwitchMode={setWordupMode}
         onTutorial={onTutorial}
         onBackToClassic={onBackToClassic}
      />
   );
};

export default WordUpContainer;
