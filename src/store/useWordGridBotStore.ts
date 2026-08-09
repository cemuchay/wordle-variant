/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
// src/store/useWordGridBotStore.ts

import { create } from "zustand";
import { supabase } from "../lib/supabaseClient";
import type {
   GridCell,
   PlacedTile,
   WordGridPlayer,
} from "../utils/wordgrid/constants";
import { DEFAULT_GRID_SIZE } from "../utils/wordgrid/constants";
import {
   generateInitialTileBag,
   drawBalancedRack,
} from "../utils/wordgrid/bagBalancing";
import { WordGridBotEngine } from "../utils/wordgrid/WordGridBotEngine";
import { safeLocalStorage } from "../utils/storage";

export type WordGridBotViewType =
   | "lobby"
   | "matchmaking"
   | "active"
   | "completed";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Helper to convert arbitrary user/turn IDs to valid PostgreSQL UUID strings or null
const toDbUuid = (id: string | null | undefined): string | null => {
   if (!id || id === "bot" || id === "guest" || id.startsWith("bot_")) return null;
   const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
   return uuidRegex.test(id) ? id : null;
};

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

// Local Storage Helper for Bot Snapshots
export function saveBotSnapshot(
   matchId: string | null,
   stateObj: Record<string, any>,
) {
   if (!matchId) return;
   try {
      const key = `wordgrid_bot_snapshot_${matchId}`;
      safeLocalStorage.setItem(
         key,
         JSON.stringify({ ...stateObj, timestamp: Date.now() }),
      );
   } catch (e) {
      console.warn("[WordGridBot] Save snapshot failed:", e);
   }
}

export function loadBotSnapshot(
   matchId: string | null,
): Record<string, any> | null {
   if (!matchId) return null;
   try {
      const key = `wordgrid_bot_snapshot_${matchId}`;
      const raw = safeLocalStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (
         parsed &&
         parsed.timestamp &&
         Date.now() - parsed.timestamp > SEVEN_DAYS_MS
      ) {
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
   isBotMatch: boolean;

   isBotThinking: boolean;
   lastBotMove: { word: string; score: number; placedTiles: PlacedTile[] } | null;
   lastBotPlacedCoords: string[];

   view: WordGridBotViewType;
   placedTiles: PlacedTile[];
   rack: string[];
   loading: boolean;
   error: string | null;
   botMatchesList: any[];

   // Actions
   setView: (view: WordGridBotViewType) => void;
   resetGame: () => void;
   startBotMatch: (
      userId: string,
      difficulty: "easy" | "normal" | "hard",
      gridSize?: number,
      triggerToast?: (msg: string, duration?: number) => void,
   ) => Promise<void>;
   loadBotMatch: (
      matchId: string,
      userId: string,
      triggerToast?: (msg: string, duration?: number) => void,
   ) => Promise<void>;
   updateFromMatchRecord: (record: any, currentUserId: string) => void;

   // Tile play actions
   moveTileInGrid: (
      fromX: number,
      fromY: number,
      toX: number,
      toY: number,
   ) => void;
   placeTile: (x: number, y: number, letter: string) => void;
   recallTile: (x: number, y: number) => void;
   recallAllTiles: () => void;
   shuffleRack: () => void;
   reorderRack: (fromIdx: number, toIdx: number) => void;

   submitMove: (
      userId: string,
      triggerToast: (msg: string, duration?: number, isLarge?: boolean) => void,
   ) => Promise<boolean>;
   triggerBotTurn: (triggerToast?: (msg: string, duration?: number) => void) => Promise<void>;
   deleteBotMatch: (matchId: string, userId: string) => Promise<void>;
   loadBotMatchesList: (userId: string) => Promise<void>;
}

let botHighlightTimer: any = null;

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
   isBotMatch: true,

   isBotThinking: false,
   lastBotMove: null,
   lastBotPlacedCoords: [],

   view: "lobby",
   placedTiles: [],
   rack: [],
   loading: false,
   error: null,
   botMatchesList: [],

   setView: (view) => set({ view }),

   resetGame: () => {
      if (botHighlightTimer) clearTimeout(botHighlightTimer);
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
         isBotMatch: true,
         isBotThinking: false,
         lastBotMove: null,
         lastBotPlacedCoords: [],
         view: "lobby",
         placedTiles: [],
         rack: [],
         loading: false,
         error: null,
      });
   },

   startBotMatch: async (userId, difficulty, gridSize = DEFAULT_GRID_SIZE, triggerToast) => {
      set({ loading: true, error: null });
      try {
         const matchId = generateUUID();
         const initialBag = generateInitialTileBag();
         const { rack: p1Rack, newBag: bag1 } = await drawBalancedRack(
            initialBag,
            [],
            7,
            true,
         );
         const { rack: botRack, newBag: finalBag } = await drawBalancedRack(
            bag1,
            [],
            7,
            true,
         );

         const players: WordGridPlayer[] = [
            { id: userId, username: "You", score: 0, rack: p1Rack },
            {
               id: "bot",
               username: `AI (${difficulty.toUpperCase()})`,
               score: 0,
               rack: botRack,
            },
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
            isBotMatch: true,
            view: "active" as WordGridBotViewType,
            placedTiles: [],
            rack: p1Rack,
            loading: false,
         };

         set(newState);
         saveBotSnapshot(matchId, newState);

         // Async DB insert without blocking local play
         const p1Uuid = toDbUuid(userId);
         supabase
            .from("wordgrid_matches")
            .insert({
               id: matchId,
               player1_id: p1Uuid,
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
               current_turn: p1Uuid,
               current_turn_index: 0,
               moves: [],
            })
            .then(({ error }) => {
               if (error) {
                  console.warn("[WordGridBot] Async DB insert warning:", error);
                  triggerToast?.(`Offline mode: DB save warning (${error.message})`, 3000);
               }
            });
      } catch (e: any) {
         console.error("[WordGridBot] startBotMatch error:", e);
         const errMsg = e?.message || "Failed to start bot match";
         set({
            error: errMsg,
            loading: false,
         });
         triggerToast?.(`Failed to start match: ${errMsg}`, 4000);
      }
   },

   loadBotMatch: async (matchId, userId, triggerToast) => {
      set({ loading: true, error: null });
      const local = loadBotSnapshot(matchId);
      if (local) {
         const humanPlayer = local.players?.find(
            (p: any) => p.id === userId || p.id !== "bot",
         );
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
            isBotMatch: true,
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
               {
                  id: userId,
                  username: "You",
                  score: data.p1_score || 0,
                  rack: data.p1_rack || [],
               },
               {
                  id: "bot",
                  username: `AI (${(data.bot_difficulty || "normal").toUpperCase()})`,
                  score: data.p2_score || 0,
                  rack: data.p2_rack || [],
               },
            ];
            const human = playersList.find(
               (p) => p.id === userId || p.id !== "bot",
            );
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
               isBotMatch: true,
               view:
                  data.status === "completed"
                     ? "completed"
                     : ("active" as WordGridBotViewType),
               placedTiles: [],
               rack: human?.rack || data.p1_rack || [],
               loading: false,
            };
            set(loadedState);
            saveBotSnapshot(matchId, loadedState);
         }
      } catch (e: any) {
         console.warn("[WordGridBot] Network loadBotMatch error:", e);
         const errMsg = e?.message || "Failed to load match";
         set({ error: errMsg, loading: false });
         triggerToast?.(`Failed to load match: ${errMsg}`, 4000);
      }
   },

   updateFromMatchRecord: (record, currentUserId) => {
      if (!record) return;
      const playersList: WordGridPlayer[] = record.players_data || [];
      const human = playersList.find((p) => p.id === currentUserId || p.id !== "bot");
      const turnIndex = record.current_turn_index ?? 0;

      const loadedState = {
         matchId: record.id,
         gridSize: record.grid_size || DEFAULT_GRID_SIZE,
         status: record.status,
         board: record.board || [],
         tileBag: record.tile_bag || [],
         players: playersList.length > 0 ? playersList : get().players,
         currentTurnIndex: turnIndex,
         currentTurn: record.current_turn || (turnIndex === 0 ? currentUserId : "bot"),
         moves: record.moves || [],
         botDifficulty: record.bot_difficulty || get().botDifficulty || "normal",
         isBotMatch: true,
         view: record.status === "completed" ? "completed" : ("active" as WordGridBotViewType),
         placedTiles: [],
         rack: human?.rack || get().rack,
         loading: false,
      };

      set(loadedState);
      saveBotSnapshot(record.id, loadedState);
   },

   moveTileInGrid: (fromX, fromY, toX, toY) => {
      const { placedTiles, board } = get();
      const isOccupied =
         board.some((c) => c.x === toX && c.y === toY) ||
         placedTiles.some((t) => t.x === toX && t.y === toY);
      if (isOccupied) return;

      const tileIdx = placedTiles.findIndex(
         (t) => t.x === fromX && t.y === fromY,
      );
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
      if (
         fromIdx < 0 ||
         fromIdx >= rack.length ||
         toIdx < 0 ||
         toIdx >= rack.length ||
         fromIdx === toIdx
      )
         return;
      const newRack = [...rack];
      const [moved] = newRack.splice(fromIdx, 1);
      newRack.splice(toIdx, 0, moved);
      set({ rack: newRack });
   },

   submitMove: async (userId, triggerToast) => {
      const state = get();
      if (!state.matchId) {
         triggerToast?.("No active match found.", 3000);
         return false;
      }
      if (state.currentTurn === "bot") {
         triggerToast?.("Please wait for the bot to finish its move.", 3000);
         return false;
      }
      if (!state.placedTiles || state.placedTiles.length === 0) {
         triggerToast?.("Place at least one tile on the board.", 3000);
         return false;
      }

      try {
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

         if (!humanRes.success || !humanRes.updatedState) {
            return false;
         }

         const humanPlayer = humanRes.updatedState.players?.find(
            (p) => p.id === userId || p.id !== "bot",
         );
         const updatedState = {
            ...state,
            ...humanRes.updatedState,
            placedTiles: [],
            rack: humanPlayer?.rack || state.rack,
         };

         set(updatedState);
         saveBotSnapshot(state.matchId, updatedState);

         // Async DB update snapshot - convert turn to valid PostgreSQL UUID or null
         const dbTurn = toDbUuid(updatedState.currentTurn);
         supabase
            .from("wordgrid_matches")
            .update({
               board: updatedState.board,
               tile_bag: updatedState.tileBag,
               players_data: updatedState.players,
               p1_rack: updatedState.players[0]?.rack || [],
               p2_rack: updatedState.players[1]?.rack || [],
               p1_score: updatedState.players[0]?.score || 0,
               p2_score: updatedState.players[1]?.score || 0,
               current_turn: dbTurn,
               current_turn_index: 1,
               moves: updatedState.moves,
            })
            .eq("id", state.matchId)
            .then(({ error }) => {
               if (error) {
                  console.warn(
                     "[WordGridBot] Async DB move update warning:",
                     error,
                  );
                  triggerToast?.(`Cloud sync warning: ${error.message || "Failed to update match"}`, 4000);
               }
            });

         // Auto-trigger Bot turn immediately
         if (humanRes.botShouldPlay) {
            setTimeout(() => {
               get().triggerBotTurn(triggerToast);
            }, 600);
         }

         return true;
      } catch (err: any) {
         console.error("[WordGridBot] submitMove error:", err);
         triggerToast?.(`Failed to submit move: ${err?.message || "Unexpected error"}`, 4000);
         return false;
      }
   },

   triggerBotTurn: async (triggerToast) => {
      const state = get();
      if (
         !state.matchId ||
         state.status === "completed" ||
         state.currentTurn !== "bot"
      )
         return;

      set({ isBotThinking: true });

      try {
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

         const humanPlayer = botRes.updatedState.players?.find(
            (p) => p.id !== "bot",
         );
         const botMove = (botRes as any).lastBotMove || null;
         const botCoords = botMove?.placedTiles ? botMove.placedTiles.map((t: any) => `${t.x},${t.y}`) : [];

         const updatedState = {
            ...state,
            ...botRes.updatedState,
            currentTurn: humanPlayer?.id || "p1",
            currentTurnIndex: 0,
            isBotThinking: false,
            lastBotMove: botMove,
            lastBotPlacedCoords: botCoords,
         };

         set(updatedState);
         saveBotSnapshot(state.matchId, updatedState);

         if (botHighlightTimer) clearTimeout(botHighlightTimer);
         botHighlightTimer = setTimeout(() => {
            set({ lastBotPlacedCoords: [], lastBotMove: null });
         }, 3500);

         // Async DB update after bot turn - convert turn to valid PostgreSQL UUID or null
         const dbTurn = toDbUuid(updatedState.currentTurn);
         supabase
            .from("wordgrid_matches")
            .update({
               board: updatedState.board,
               tile_bag: updatedState.tileBag,
               players_data: updatedState.players,
               p1_rack: updatedState.players[0]?.rack || [],
               p2_rack: updatedState.players[1]?.rack || [],
               p1_score: updatedState.players[0]?.score || 0,
               p2_score: updatedState.players[1]?.score || 0,
               current_turn: dbTurn,
               current_turn_index: 0,
               moves: updatedState.moves,
            })
            .eq("id", state.matchId)
            .then(({ error }) => {
               if (error) {
                  console.warn(
                     "[WordGridBot] Async DB bot update warning:",
                     error,
                  );
                  triggerToast?.(`Cloud sync warning: ${error.message || "Failed to sync bot move"}`, 4000);
               }
            });
      } catch (err: any) {
         console.error("[WordGridBot] triggerBotTurn error:", err);
         set({ isBotThinking: false });
         triggerToast?.(`Bot turn error: ${err?.message || "Failed to process bot turn"}`, 4000);
      }
   },

   deleteBotMatch: async (matchId, _userId) => {
      clearBotSnapshot(matchId);
      set((s) => ({
         botMatchesList: s.botMatchesList.filter((m) => m.id !== matchId),
         ...(s.matchId === matchId
            ? { matchId: null, view: "lobby" as const }
            : {}),
      }));
      supabase
         .from("wordgrid_matches")
         .delete()
         .eq("id", matchId)
         .then(({ error }) => {
            if (error)
               console.warn("[WordGridBot] Delete DB match warning:", error);
         });
   },

   loadBotMatchesList: async (_userId) => {
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
