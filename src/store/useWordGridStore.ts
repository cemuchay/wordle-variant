/* eslint-disable @typescript-eslint/no-explicit-any */
// src/store/useWordGridStore.ts

import { supabase } from "../lib/supabaseClient";
import { useWordGridBotStore } from "./useWordGridBotStore";
import { useWordGridPvPStore } from "./useWordGridPvPStore";

export { useWordGridBotStore, useWordGridPvPStore };

export const useWordGridStore = ((selector?: any) => {
  const botState = useWordGridBotStore((s) => s);
  const pvpState = useWordGridPvPStore((s) => s);

  const isBot = botState.matchId !== null && (
    botState.view === "active" ||
    botState.view === "completed" ||
    botState.isBotMatch ||
    botState.matchId.startsWith("bot_")
  );
  const activeStore = isBot ? botState : pvpState;

  const unifiedState = {
    ...activeStore,
    isBotMatch: isBot,
    matchesList: [...(pvpState.pvpMatchesList || []), ...(botState.botMatchesList || [])],
    
    startBotMatch: botState.startBotMatch,
    startQueue: pvpState.startQueue,
    cancelQueue: pvpState.cancelQueue,
    startDirectChallenge: pvpState.startDirectChallenge,
    
    loadMatch: async (matchId: string, currentUserId: string) => {
      if (matchId.startsWith("bot_")) {
        await botState.loadBotMatch(matchId, currentUserId);
        return;
      }
      try {
        const { data } = await supabase
          .from("wordgrid_matches")
          .select("is_bot_match")
          .eq("id", matchId)
          .maybeSingle();

        if (data?.is_bot_match) {
          await botState.loadBotMatch(matchId, currentUserId);
        } else {
          await pvpState.loadMatch(matchId, currentUserId);
        }
      } catch (err) {
        console.warn("[useWordGridStore] loadMatch DB check error:", err);
        await pvpState.loadMatch(matchId, currentUserId);
      }
    },
    
    loadMatchesList: async (userId: string) => {
      await Promise.all([
        pvpState.loadMatchesList(userId),
        botState.loadBotMatchesList(userId),
      ]);
    },

    deleteMatch: async (matchId: string, userId: string) => {
      if (matchId.startsWith("bot_") || botState.matchId === matchId) {
        await botState.deleteBotMatch(matchId, userId);
      } else {
        pvpState.resetGame();
      }
    },
    
    resetGame: () => {
      botState.resetGame();
      pvpState.resetGame();
    },

    playBotTurn: async () => {
      await botState.triggerBotTurn();
    },
  };

  if (typeof selector === "function") {
    return selector(unifiedState);
  }
  return unifiedState;
}) as any;

useWordGridStore.getState = () => {
  const botState = useWordGridBotStore.getState();
  const pvpState = useWordGridPvPStore.getState();
  const isBot = botState.matchId !== null && (
    botState.view === "active" ||
    botState.view === "completed" ||
    botState.isBotMatch ||
    botState.matchId.startsWith("bot_")
  );
  const activeStore = isBot ? botState : pvpState;
  return {
    ...activeStore,
    isBotMatch: isBot,
    matchesList: [...(pvpState.pvpMatchesList || []), ...(botState.botMatchesList || [])],
    startBotMatch: botState.startBotMatch,
    startQueue: pvpState.startQueue,
    cancelQueue: pvpState.cancelQueue,
    startDirectChallenge: pvpState.startDirectChallenge,
    loadMatch: async (matchId: string, currentUserId: string) => {
      if (matchId.startsWith("bot_")) {
        await botState.loadBotMatch(matchId, currentUserId);
        return;
      }
      try {
        const { data } = await supabase
          .from("wordgrid_matches")
          .select("is_bot_match")
          .eq("id", matchId)
          .maybeSingle();

        if (data?.is_bot_match) {
          await botState.loadBotMatch(matchId, currentUserId);
        } else {
          await pvpState.loadMatch(matchId, currentUserId);
        }
      } catch (err) {
        console.warn("[useWordGridStore] loadMatch DB check error:", err);
        await pvpState.loadMatch(matchId, currentUserId);
      }
    },
    loadMatchesList: async (userId: string) => {
      await Promise.all([
        pvpState.loadMatchesList(userId),
        botState.loadBotMatchesList(userId),
      ]);
    },
    deleteMatch: async (matchId: string, userId: string) => {
      if (matchId.startsWith("bot_") || botState.matchId === matchId) {
        await botState.deleteBotMatch(matchId, userId);
      } else {
        pvpState.resetGame();
      }
    },
    resetGame: () => {
      botState.resetGame();
      pvpState.resetGame();
    },
    playBotTurn: async () => {
      await botState.triggerBotTurn();
    },
  };
};

useWordGridStore.setState = (partial: any) => {
  useWordGridBotStore.setState(partial);
  useWordGridPvPStore.setState(partial);
};
