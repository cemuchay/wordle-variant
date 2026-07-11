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
   const [soundEnabled, setSoundEnabled] = useState(true);

   const refreshPending = useCallback(async () => {
      if (effectiveUser) {
         const pending = await loadPendingMatches();
         setPendingMatches(pending);
      }
   }, [effectiveUser, loadPendingMatches]);

   useEffect(() => {
      refreshPending();
   }, [effectiveUser?.id, refreshPending]);

    // Navigate to Live lobby (classic live mode)
    const handleNavigateLive = useCallback(() => {
       useLiveStore.getState().setView("menu");
       useLiveStore.getState().setAutoStartMatchmaking(false);
       setWordupMode("live");
    }, [setWordupMode]);

    // Navigate to Async lobby (classic async mode)
    const handleNavigateAsync = useCallback(() => {
       useAsyncStore.getState().setView("menu");
       setWordupMode("async");
    }, [setWordupMode]);

    // Bridge: Play Live Match from Unified Lobby
    const handlePlayLiveCategory = useCallback((catId: string) => {
      useLiveStore.getState().setCategory(catId);
      useLiveStore.getState().resetGame();
      useLiveStore.getState().setView("connecting");
      useLiveStore.getState().setAutoStartMatchmaking(true);
      setWordupMode("live");
   }, [setWordupMode]);

   // Bridge: Play Async Challenge from Unified Lobby
   const handlePlayAsyncChallenge = useCallback((targetUser: any, catId: string) => {
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
      const myRole = match.player1_id === effectiveUser.id ? "player1" : "player2";
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
             onToggleSound={() => setSoundEnabled(!soundEnabled)}
             onPlayLiveCategory={handlePlayLiveCategory}
             onPlayAsyncChallenge={handlePlayAsyncChallenge}
             onPlayAsyncTurn={handlePlayAsyncTurn}
             pendingMatches={pendingMatches}
             onRefreshPending={refreshPending}
             onBackToClassic={onBackToClassic}
             onTutorial={onTutorial}
             onNavigateLive={handleNavigateLive}
             onNavigateAsync={handleNavigateAsync}
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
