// src/store/useWordGridBotStore.ts

import { create } from "zustand";
import { supabase } from "../lib/supabaseClient";
import type { GridCell, PlacedTile, WordGridPlayer } from "../utils/wordgrid/constants";
import { DEFAULT_GRID_SIZE } from "../utils/wordgrid/constants";
import { generateInitialTileBag, drawBalancedRack } from "../utils/wordgrid/bagBalancing";
import { WordGridBotEngine } from "../utils/wordgrid/WordGridBotEngine";
import { safeLocalStorage } from "../utils/storage";
import { TIMEOUT } from "../constants/game";

export type WordGridBotViewType = "lobby" | "matchmaking" | "active" | "completed";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Local Storage Helper for Bot Snapshots
export function saveBotSnapshot(matchId: string | null, stateObj: Record<string, any>) {
  if (!matchId) return;
  try {
    const key = `wordgrid_bot_snapshot_${matchId}`;
    safeLocalStorage.setItem(key, JSON.stringify({ ...stateObj, timestamp: Date.now() }));
  } catch (e) {
    console.warn("[WordGridBot] Save snapshot failed:", e);
  }
}

export function loadBotSnapshot(matchId: string | null): Record<string, any> | null {
  if (!matchId) return null;
  try {
    const key = `wordgrid_bot_snapshot_${matchId}`;
    const raw = safeLocalStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.timestamp && Date.now() - parsed.timestamp > SEVEN_DAYS_MS) {
      safeLocalStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch (e) {
    console.warn("[WordGridBot] Load snapshot failed:", e);
  }
  return null;
}

export function clearBotSnapshot(matchId: string | null) {
  if (!matchId) return;
  try {
    safeLocalStorage.removeItem(`wordgrid_bot_snapshot_${matchId}`);
    safeLocalStorage.removeItem(`wordgrid_draft_${matchId}`);
  } catch (e) {
    console.warn("[WordGridBot] Clear snapshot failed:", e);
  }
}

interface WordGridBotState {
  matchId: string | null;
  gridSize: number;
  status: string;
  board: GridCell[];
  tileBag: string[];
  players: WordGridPlayer[];
  currentTurnIndex: number;
  currentTurn: string | null;
  moves: any[];
  botDifficulty: "easy" | "normal" | "hard";
  
  view: WordGridBotViewType;
  placedTiles: PlacedTile[];
  rack: string[];
  loading: boolean;
  error: string | null;
  botMatchesList: any[];

  // Actions
  setView: (view: WordGridBotViewType) => void;
  resetGame: () => void;
  startBotMatch: (userId: string, difficulty: "easy" | "normal" | "hard", gridSize?: number) => Promise<void>;
  loadBotMatch: (matchId: string, userId: string) => Promise<void>;
  
  // Tile play actions
  moveTileInGrid: (fromX: number, fromY: number, toX: number, toY: number) => void;
  placeTile: (x: number, y: number, letter: string) => void;
  recallTile: (x: number, y: number) => void;
  recallAllTiles: () => void;
  shuffleRack: () => void;
  reorderRack: (fromIdx: number, toIdx: number) => void;
  
  submitMove: (userId: string, triggerToast: (msg: string, duration?: number, isLarge?: boolean) => void) => Promise<boolean>;
  triggerBotTurn: () => Promise<void>;
  deleteBotMatch: (matchId: string, userId: string) => Promise<void>;
  loadBotMatchesList: (userId: string) => Promise<void>;
}

export const useWordGridBotStore = create<WordGridBotState>((set, get) => ({
  matchId: null,
  gridSize: DEFAULT_GRID_SIZE,
  status: "waiting",
  board: [],
  tileBag: [],
  players: [],
  currentTurnIndex: 0,
  currentTurn: null,
  moves: [],
  botDifficulty: "normal",
  
  view: "lobby",
  placedTiles: [],
  rack: [],
  loading: false,
  error: null,
  botMatchesList: [],

  setView: (view) => set({ view }),

  resetGame: () => {
    clearBotSnapshot(get().matchId);
    set({
      matchId: null,
      gridSize: DEFAULT_GRID_SIZE,
      status: "waiting",
      board: [],
      tileBag: [],
      players: [],
      currentTurnIndex: 0,
      currentTurn: null,
      moves: [],
      botDifficulty: "normal",
      view: "lobby",
      placedTiles: [],
      rack: [],
      loading: false,
      error: null,
    });
  },

  startBotMatch: async (userId, difficulty, gridSize = DEFAULT_GRID_SIZE) => {
    set({ loading: true, error: null });
    try {
      const matchId = `bot_${Date.now()}`;
      const initialBag = generateInitialTileBag();
      const { rack: p1Rack, newBag: bag1 } = await drawBalancedRack(initialBag, [], 7, true);
      const { rack: botRack, newBag: finalBag } = await drawBalancedRack(bag1, [], 7, true);

      const players: WordGridPlayer[] = [
        { id: userId, username: "You", score: 0, rack: p1Rack },
        { id: "bot", username: `AI (${difficulty.toUpperCase()})`, score: 0, rack: botRack },
      ];

      const newState = {
        matchId,
        gridSize,
        status: "active",
        board: [],
        tileBag: finalBag,
        players,
        currentTurnIndex: 0,
        currentTurn: userId,
        moves: [],
        botDifficulty: difficulty,
        view: "active" as WordGridBotViewType,
        placedTiles: [],
        rack: p1Rack,
        loading: false,
      };

      set(newState);
      saveBotSnapshot(matchId, newState);

      // Async DB insert without blocking local play
      supabase.from("wordgrid_matches").insert({
        id: matchId,
        player1_id: userId === "guest" ? null : userId,
        player2_id: null,
        is_bot_match: true,
        bot_difficulty: difficulty,
        grid_size: gridSize,
        status: "active",
        board: [],
        tile_bag: finalBag,
        players_data: players,
        p1_rack: p1Rack,
        p2_rack: botRack,
        p1_score: 0,
        p2_score: 0,
        current_turn: userId,
        current_turn_index: 0,
        moves: [],
      }).then(({ error }) => {
        if (error) console.warn("[WordGridBot] Async DB insert warning:", error);
      });
    } catch (e: any) {
      console.error("[WordGridBot] startBotMatch error:", e);
      set({ error: e?.message || "Failed to start bot match", loading: false });
    }
  },

  loadBotMatch: async (matchId, userId) => {
    set({ loading: true, error: null });
    const local = loadBotSnapshot(matchId);
    if (local) {
      const humanPlayer = local.players?.find((p: any) => p.id === userId || p.id !== "bot");
      set({
        matchId: local.matchId,
        gridSize: local.gridSize || DEFAULT_GRID_SIZE,
        status: local.status || "active",
        board: local.board || [],
        tileBag: local.tileBag || [],
        players: local.players || [],
        currentTurnIndex: local.currentTurnIndex || 0,
        currentTurn: local.currentTurn || userId,
        moves: local.moves || [],
        botDifficulty: local.botDifficulty || "normal",
        view: local.status === "completed" ? "completed" : "active",
        placedTiles: [],
        rack: humanPlayer?.rack || local.rack || [],
        loading: false,
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("wordgrid_matches")
        .select("*")
        .eq("id", matchId)
        .single();
      if (error) throw error;
      if (data) {
        const playersList: WordGridPlayer[] = data.players_data || [
          { id: userId, username: "You", score: data.p1_score || 0, rack: data.p1_rack || [] },
          { id: "bot", username: `AI (${(data.bot_difficulty || "normal").toUpperCase()})`, score: data.p2_score || 0, rack: data.p2_rack || [] },
        ];
        const human = playersList.find((p) => p.id === userId || p.id !== "bot");
        const loadedState = {
          matchId: data.id,
          gridSize: data.grid_size || DEFAULT_GRID_SIZE,
          status: data.status,
          board: data.board || [],
          tileBag: data.tile_bag || [],
          players: playersList,
          currentTurnIndex: data.current_turn_index || 0,
          currentTurn: data.current_turn || userId,
          moves: data.moves || [],
          botDifficulty: data.bot_difficulty || "normal",
          view: data.status === "completed" ? "completed" : ("active" as WordGridBotViewType),
          placedTiles: [],
          rack: human?.rack || data.p1_rack || [],
          loading: false,
        };
        set(loadedState);
        saveBotSnapshot(matchId, loadedState);
      }
    } catch (e: any) {
      console.warn("[WordGridBot] Network loadBotMatch error:", e);
      set({ error: e.message, loading: false });
    }
  },

  moveTileInGrid: (fromX, fromY, toX, toY) => {
    const { placedTiles, board } = get();
    const isOccupied = board.some((c) => c.x === toX && c.y === toY) || placedTiles.some((t) => t.x === toX && t.y === toY);
    if (isOccupied) return;

    const tileIdx = placedTiles.findIndex((t) => t.x === fromX && t.y === fromY);
    if (tileIdx === -1) return;

    const newPlaced = [...placedTiles];
    newPlaced[tileIdx] = { ...newPlaced[tileIdx], x: toX, y: toY };
    set({ placedTiles: newPlaced });
  },

  placeTile: (x, y, letter) => {
    const { rack, placedTiles } = get();
    const idx = rack.findIndex((l) => l === letter);
    if (idx === -1) return;

    const newRack = [...rack];
    newRack.splice(idx, 1);
    set({
      placedTiles: [...placedTiles, { x, y, letter }],
      rack: newRack,
    });
  },

  recallTile: (x, y) => {
    const { rack, placedTiles } = get();
    const tileIdx = placedTiles.findIndex((t) => t.x === x && t.y === y);
    if (tileIdx === -1) return;

    const tile = placedTiles[tileIdx];
    const newPlaced = [...placedTiles];
    newPlaced.splice(tileIdx, 1);
    set({
      placedTiles: newPlaced,
      rack: [...rack, tile.letter],
    });
  },

  recallAllTiles: () => {
    const { rack, placedTiles } = get();
    set({
      placedTiles: [],
      rack: [...rack, ...placedTiles.map((t) => t.letter)],
    });
  },

  shuffleRack: () => {
    const { rack } = get();
    const newRack = [...rack];
    for (let i = newRack.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newRack[i], newRack[j]] = [newRack[j], newRack[i]];
    }
    set({ rack: newRack });
  },

  reorderRack: (fromIdx, toIdx) => {
    const { rack } = get();
    if (fromIdx < 0 || fromIdx >= rack.length || toIdx < 0 || toIdx >= rack.length || fromIdx === toIdx) return;
    const newRack = [...rack];
    const [moved] = newRack.splice(fromIdx, 1);
    newRack.splice(toIdx, 0, moved);
    set({ rack: newRack });
  },

  submitMove: async (userId, triggerToast) => {
    const state = get();
    if (!state.matchId || state.currentTurn === "bot") return false;

    const humanRes = await WordGridBotEngine.processHumanMove(
      {
        matchId: state.matchId,
        gridSize: state.gridSize,
        status: state.status,
        board: state.board,
        tileBag: state.tileBag,
        players: state.players,
        currentTurnIndex: state.currentTurnIndex,
        currentTurn: state.currentTurn,
        moves: state.moves,
        botDifficulty: state.botDifficulty,
      },
      userId,
      state.placedTiles,
      triggerToast,
    );

    if (!humanRes.success || !humanRes.updatedState) return false;

    const humanPlayer = humanRes.updatedState.players?.find((p) => p.id === userId || p.id !== "bot");
    const updatedState = {
      ...state,
      ...humanRes.updatedState,
      placedTiles: [],
      rack: humanPlayer?.rack || state.rack,
    };

    set(updatedState);
    saveBotSnapshot(state.matchId, updatedState);

    // Async DB update snapshot
    supabase.from("wordgrid_matches").update({
      board: updatedState.board,
      tile_bag: updatedState.tileBag,
      players_data: updatedState.players,
      p1_rack: updatedState.players[0]?.rack || [],
      p2_rack: updatedState.players[1]?.rack || [],
      p1_score: updatedState.players[0]?.score || 0,
      p2_score: updatedState.players[1]?.score || 0,
      current_turn: "bot",
      current_turn_index: 1,
      moves: updatedState.moves,
    }).eq("id", state.matchId).then(({ error }) => {
      if (error) console.warn("[WordGridBot] Async DB move update warning:", error);
    });

    // Auto-trigger Bot turn immediately
    if (humanRes.botShouldPlay) {
      setTimeout(() => {
        get().triggerBotTurn();
      }, 600);
    }

    return true;
  },

  triggerBotTurn: async () => {
    const state = get();
    if (!state.matchId || state.status === "completed" || state.currentTurn !== "bot") return;

    const botRes = await WordGridBotEngine.processBotMove({
      matchId: state.matchId,
      gridSize: state.gridSize,
      status: state.status,
      board: state.board,
      tileBag: state.tileBag,
      players: state.players,
      currentTurnIndex: state.currentTurnIndex,
      currentTurn: state.currentTurn,
      moves: state.moves,
      botDifficulty: state.botDifficulty,
    });

    const humanPlayer = botRes.updatedState.players?.find((p) => p.id !== "bot");
    const updatedState = {
      ...state,
      ...botRes.updatedState,
      currentTurn: humanPlayer?.id || "p1",
      currentTurnIndex: 0,
    };

    set(updatedState);
    saveBotSnapshot(state.matchId, updatedState);

    // Async DB update after bot turn
    supabase.from("wordgrid_matches").update({
      board: updatedState.board,
      tile_bag: updatedState.tileBag,
      players_data: updatedState.players,
      p1_rack: updatedState.players[0]?.rack || [],
      p2_rack: updatedState.players[1]?.rack || [],
      p1_score: updatedState.players[0]?.score || 0,
      p2_score: updatedState.players[1]?.score || 0,
      current_turn: humanPlayer?.id || "p1",
      current_turn_index: 0,
      moves: updatedState.moves,
    }).eq("id", state.matchId).then(({ error }) => {
      if (error) console.warn("[WordGridBot] Async DB bot update warning:", error);
    });
  },

  deleteBotMatch: async (matchId, userId) => {
    clearBotSnapshot(matchId);
    set((s) => ({
      botMatchesList: s.botMatchesList.filter((m) => m.id !== matchId),
      ...(s.matchId === matchId ? { matchId: null, view: "lobby" as const } : {}),
    }));
    supabase.from("wordgrid_matches").delete().eq("id", matchId).then(({ error }) => {
      if (error) console.warn("[WordGridBot] Delete DB match warning:", error);
    });
  },

  loadBotMatchesList: async (userId) => {
    try {
      const { data } = await supabase
        .from("wordgrid_matches")
        .select("*")
        .eq("is_bot_match", true)
        .order("created_at", { ascending: false });
      set({ botMatchesList: data || [] });
    } catch (e) {
      console.warn("[WordGridBot] loadBotMatchesList error:", e);
    }
  },
}));
