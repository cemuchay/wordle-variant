// src/store/useWordGridPvPStore.ts

import { create } from "zustand";
import { supabase } from "../lib/supabaseClient";
import type { GridCell, PlacedTile, WordGridPlayer } from "../utils/wordgrid/constants";
import { DEFAULT_GRID_SIZE } from "../utils/wordgrid/constants";
import { generateInitialTileBag, drawBalancedRack } from "../utils/wordgrid/bagBalancing";
import { WordGridPvPEngine } from "../utils/wordgrid/WordGridPvPEngine";
import { safeLocalStorage } from "../utils/storage";

export type WordGridPvPViewType = "lobby" | "matchmaking" | "active" | "completed";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function isUuid(val: any): boolean {
  return (
    typeof val === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)
  );
}

function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function savePvPSnapshot(matchId: string | null, snapshot: Record<string, any>) {
  if (!matchId) return;
  try {
    const key = `wordgrid_pvp_snapshot_${matchId}`;
    safeLocalStorage.setItem(key, JSON.stringify({ ...snapshot, timestamp: Date.now() }));
  } catch (e) {
    console.warn("[WordGridPvP] Save snapshot failed:", e);
  }
}

export function loadPvPSnapshot(matchId: string | null): Record<string, any> | null {
  if (!matchId) return null;
  try {
    const key = `wordgrid_pvp_snapshot_${matchId}`;
    const raw = safeLocalStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.timestamp && Date.now() - parsed.timestamp > SEVEN_DAYS_MS) {
      safeLocalStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch (e) {
    console.warn("[WordGridPvP] Load snapshot failed:", e);
  }
  return null;
}

export function clearPvPSnapshot(matchId: string | null) {
  if (!matchId) return;
  try {
    safeLocalStorage.removeItem(`wordgrid_pvp_snapshot_${matchId}`);
    safeLocalStorage.removeItem(`wordgrid_draft_${matchId}`);
  } catch (e) {
    console.warn("[WordGridPvP] Clear snapshot failed:", e);
  }
}

interface WordGridPvPState {
  matchId: string | null;
  gridSize: number;
  maxPlayers: number;
  status: string;
  board: GridCell[];
  tileBag: string[];
  players: WordGridPlayer[];
  currentTurnIndex: number;
  currentTurn: string | null;
  moves: any[];
  role: "player1" | "player2" | null;

  view: WordGridPvPViewType;
  placedTiles: PlacedTile[];
  rack: string[];
  loading: boolean;
  error: string | null;
  pvpMatchesList: any[];

  // Actions
  setView: (view: WordGridPvPViewType) => void;
  resetGame: () => void;
  loadMatch: (matchId: string, currentUserId: string) => Promise<void>;
  updateFromMatchRecord: (record: any, currentUserId: string) => void;
  loadMatchesList: (userId: string) => Promise<void>;

  // Board & Rack actions
  moveTileInGrid: (fromX: number, fromY: number, toX: number, toY: number) => void;
  placeTile: (x: number, y: number, letter: string) => void;
  recallTile: (x: number, y: number) => void;
  recallAllTiles: () => void;
  shuffleRack: () => void;
  reorderRack: (fromIdx: number, toIdx: number) => void;

  submitMove: (userId: string, triggerToast: (msg: string, duration?: number, isLarge?: boolean) => void) => Promise<boolean>;
  exchangeTiles: (userId: string, lettersToExchange: string[], triggerToast?: (msg: string, duration?: number, isLarge?: boolean) => void) => Promise<void>;
  resignMatch: (userId: string) => Promise<void>;
  startQueue: (userId: string, isRated: boolean, gridSize: number, targetPlayers: number, triggerToast: (msg: string, duration?: number) => void) => Promise<void>;
  cancelQueue: (userId: string) => Promise<void>;
  startDirectChallenge: (userId: string, opponentId: string, gridSize: number, triggerToast: (msg: string, duration?: number) => void) => Promise<void>;
}

export const useWordGridPvPStore = create<WordGridPvPState>((set, get) => ({
  matchId: null,
  gridSize: DEFAULT_GRID_SIZE,
  maxPlayers: 2,
  status: "waiting",
  board: [],
  tileBag: [],
  players: [],
  currentTurnIndex: 0,
  currentTurn: null,
  moves: [],
  role: null,

  view: "lobby",
  placedTiles: [],
  rack: [],
  loading: false,
  error: null,
  pvpMatchesList: [],

  setView: (view) => set({ view }),

  resetGame: () => {
    clearPvPSnapshot(get().matchId);
    set({
      matchId: null,
      gridSize: DEFAULT_GRID_SIZE,
      maxPlayers: 2,
      status: "waiting",
      board: [],
      tileBag: [],
      players: [],
      currentTurnIndex: 0,
      currentTurn: null,
      moves: [],
      role: null,
      view: "lobby",
      placedTiles: [],
      rack: [],
      loading: false,
      error: null,
    });
  },

  loadMatch: async (matchId, currentUserId) => {
    get().resetGame();
    set({ loading: true, error: null });
    const local = loadPvPSnapshot(matchId);
    if (local) {
      get().updateFromMatchRecord(local, currentUserId);
    }
    try {
      const { data, error } = await supabase
        .from("wordgrid_matches")
        .select(`*, player1:player1_id(id, username, avatar_url), player2:player2_id(id, username, avatar_url)`)
        .eq("id", matchId)
        .single();
      if (error) throw error;
      if (data) {
        get().updateFromMatchRecord(data, currentUserId);
      }
    } catch (e: any) {
      console.warn("[WordGridPvP] loadMatch network error:", e);
      if (!local) set({ error: e.message });
    } finally {
      set({ loading: false });
    }
  },

  updateFromMatchRecord: (record, currentUserId) => {
    const isP1 = record.player1_id === currentUserId || !record.player1_id;
    const isP2 = !isP1 && record.player2_id === currentUserId;
    const role = isP1 ? "player1" : isP2 ? "player2" : null;

    let playersList: WordGridPlayer[] = record.players_data || [];
    if (playersList.length === 0) {
      playersList = [
        { id: record.player1_id, username: record.player1?.username || "Player 1", score: record.p1_score || 0, rack: record.p1_rack || [] },
        { id: record.player2_id, username: record.player2?.username || "Player 2", score: record.p2_score || 0, rack: record.p2_rack || [] },
      ];
    }

    const activePlayer = playersList.find((p) => p.id === currentUserId);
    const activeRack = activePlayer ? activePlayer.rack : (isP1 ? record.p1_rack : record.p2_rack) || [];

    const turnIndex = record.current_turn_index ?? 0;
    const currentTurn = record.current_turn || playersList[turnIndex]?.id || currentUserId;

    const snapshot = {
      matchId: record.id,
      gridSize: record.grid_size || DEFAULT_GRID_SIZE,
      maxPlayers: record.max_players || 2,
      role: role as "player1" | "player2" | null,
      status: record.status,
      board: record.board || [],
      tileBag: record.tile_bag || [],
      players: playersList,
      currentTurnIndex: turnIndex,
      currentTurn,
      moves: record.moves || [],
      view: (record.status === "completed" ? "completed" : "active") as WordGridPvPViewType,
      placedTiles: [],
      rack: activeRack,
    };

    set(snapshot);
    savePvPSnapshot(record.id, snapshot);
  },

  loadMatchesList: async (userId) => {
    if (!isUuid(userId)) return;
    try {
      const { data, error } = await supabase
        .from("wordgrid_matches")
        .select(`*, player1:player1_id(id, username, avatar_url), player2:player2_id(id, username, avatar_url)`)
        .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
        .eq("is_bot_match", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      set({ pvpMatchesList: data || [] });
    } catch (e) {
      console.warn("[WordGridPvP] loadMatchesList error:", e);
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
    if (!state.matchId || state.currentTurn !== userId) return false;

    const pvpRes = await WordGridPvPEngine.processPlayerMove(
      {
        matchId: state.matchId,
        gridSize: state.gridSize,
        maxPlayers: state.maxPlayers,
        status: state.status,
        board: state.board,
        tileBag: state.tileBag,
        players: state.players,
        currentTurnIndex: state.currentTurnIndex,
        currentTurn: state.currentTurn,
        moves: state.moves,
      },
      userId,
      state.placedTiles,
      triggerToast,
    );

    if (!pvpRes.success || !pvpRes.updatedState || !pvpRes.payloadToSave) return false;

    const activePlayer = pvpRes.updatedState.players?.find((p) => p.id === userId);
    const updatedState = {
      ...state,
      ...pvpRes.updatedState,
      placedTiles: [],
      rack: activePlayer?.rack || state.rack,
    };

    set(updatedState);
    savePvPSnapshot(state.matchId, updatedState);

    const safePayload = {
      ...pvpRes.payloadToSave,
      current_turn: isUuid(pvpRes.payloadToSave?.current_turn) ? pvpRes.payloadToSave.current_turn : null,
    };

    supabase.from("wordgrid_matches").update(safePayload).eq("id", state.matchId).then(({ error }) => {
      if (error) {
        console.warn("[WordGridPvP] Async DB update error:", error);
        triggerToast?.(`Cloud sync warning: ${error.message || "Failed to update match"}`, 4000);
      }
    });

    return true;
  },

  exchangeTiles: async (userId, lettersToExchange, triggerToast) => {
    const state = get();
    if (!state.matchId || state.currentTurn !== userId) return;

    const exRes = await WordGridPvPEngine.processTileExchange(
      {
        matchId: state.matchId,
        gridSize: state.gridSize,
        maxPlayers: state.maxPlayers,
        status: state.status,
        board: state.board,
        tileBag: state.tileBag,
        players: state.players,
        currentTurnIndex: state.currentTurnIndex,
        currentTurn: state.currentTurn,
        moves: state.moves,
      },
      userId,
      lettersToExchange,
    );

    if (!exRes.success || !exRes.updatedState || !exRes.payloadToSave) return;

    const activePlayer = exRes.updatedState.players?.find((p) => p.id === userId);
    const updatedState = {
      ...state,
      ...exRes.updatedState,
      placedTiles: [],
      rack: activePlayer?.rack || state.rack,
    };

    set(updatedState);
    savePvPSnapshot(state.matchId, updatedState);

    const safeExPayload = {
      ...exRes.payloadToSave,
      current_turn: isUuid(exRes.payloadToSave?.current_turn) ? exRes.payloadToSave.current_turn : null,
    };

    supabase.from("wordgrid_matches").update(safeExPayload).eq("id", state.matchId).then(({ error }) => {
      if (error) {
        console.warn("[WordGridPvP] Async DB exchange error:", error);
        triggerToast?.(`Cloud sync warning: ${error.message || "Failed to exchange tiles"}`, 4000);
      }
    });
  },

  resignMatch: async (_userId) => {
    const { matchId } = get();
    if (!matchId) return;
    set({ status: "completed", view: "completed" });
    savePvPSnapshot(matchId, { ...get(), status: "completed" });
    supabase.from("wordgrid_matches").update({ status: "completed" }).eq("id", matchId);
  },

  startQueue: async (userId, _isRated, gridSize, targetPlayers, _triggerToast) => {
    set({ loading: true, view: "matchmaking" });
    try {
      const matchId = generateUUID();
      const initialBag = generateInitialTileBag();
      const { rack: p1Rack, newBag } = await drawBalancedRack(initialBag, [], 7, true);

      const payload = {
        id: matchId,
        player1_id: userId,
        status: "active",
        grid_size: gridSize,
        max_players: targetPlayers,
        board: [],
        tile_bag: newBag,
        p1_rack: p1Rack,
        p1_score: 0,
        current_turn: userId,
        current_turn_index: 0,
        moves: [],
      };

      const { data, error } = await supabase.from("wordgrid_matches").insert(payload).select().single();
      if (error) throw error;

      get().updateFromMatchRecord(data, userId);
    } catch (e: any) {
      console.error("[WordGridPvP] startQueue error:", e);
      set({ error: e.message, loading: false, view: "lobby" });
    }
  },

  cancelQueue: async () => {
    set({ loading: false, view: "lobby" });
  },

  startDirectChallenge: async (userId, opponentId, gridSize, triggerToast) => {
    set({ loading: true });
    try {
      const matchId = generateUUID();
      const initialBag = generateInitialTileBag();
      const { rack: p1Rack, newBag: bag1 } = await drawBalancedRack(initialBag, [], 7, true);
      const { rack: p2Rack, newBag: finalBag } = await drawBalancedRack(bag1, [], 7, true);

      const payload = {
        id: matchId,
        player1_id: userId,
        player2_id: opponentId,
        status: "active",
        grid_size: gridSize,
        board: [],
        tile_bag: finalBag,
        p1_rack: p1Rack,
        p2_rack: p2Rack,
        p1_score: 0,
        p2_score: 0,
        current_turn: userId,
        current_turn_index: 0,
        moves: [],
      };

      const { data, error } = await supabase.from("wordgrid_matches").insert(payload).select().single();
      if (error) throw error;

      get().updateFromMatchRecord(data, userId);
      triggerToast("Direct challenge started!");
    } catch (e: any) {
      console.error("[WordGridPvP] Direct challenge error:", e);
      set({ error: e.message, loading: false });
    }
  },
}));
