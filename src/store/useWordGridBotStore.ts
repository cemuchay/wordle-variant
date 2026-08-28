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
import { detectDraftConflicts } from "../utils/wordgrid/boardValidation";
import {
   scheduleWordGridDraftSave,
   cancelWordGridDraftSave,
   clearWordGridDraft,
   loadWordGridDraft,
} from "../utils/wordgrid/draftStorage";
import {
   findStaleMatchIds,
   isStaleMatch,
} from "../utils/wordgrid/staleMatches";
import { safeLocalStorage } from "../utils/storage";

export type WordGridBotViewType =
   | "lobby"
   | "matchmaking"
   | "active"
   | "completed";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Helper to convert arbitrary user/turn IDs to valid PostgreSQL UUID strings or null
const toDbUuid = (id: string | null | undefined): string | null => {
   if (!id || id === "bot" || id === "guest" || id.startsWith("bot_"))
      return null;
   const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
   return uuidRegex.test(id) ? id : null;
};

function generateUUID(): string {
   if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
   ) {
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
      clearWordGridDraft(matchId);
   } catch (e) {
      console.warn("[WordGridBot] Clear snapshot failed:", e);
   }
}

let lastMoveTimer: any = null;

const LAST_MOVE_CLEAR_MS = 4000;

function startLastMoveTimer(set: (partial: any) => void) {
   if (lastMoveTimer) clearTimeout(lastMoveTimer);
   lastMoveTimer = setTimeout(() => {
      set({ lastMove: null });
   }, LAST_MOVE_CLEAR_MS);
}

// Client-owned expiry: mark stale bot matches as abandoned.
async function abandonBotMatchesByIds(ids: string[]): Promise<void> {
   if (ids.length === 0) return;
   try {
      await supabase
         .from("wordgrid_matches")
         .update({
            status: "abandoned",
            completed_at: new Date().toISOString(),
         })
         .in("id", ids);
   } catch (e) {
      console.warn("[WordGridBot] Stale match sweep failed:", e);
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
   lastBotMove: {
      word: string;
      score: number;
      placedTiles: PlacedTile[];
   } | null;
   lastBotPlacedCoords: string[];

   view: WordGridBotViewType;
   placedTiles: PlacedTile[];
   rack: string[];
   loading: boolean;
   error: string | null;
   botMatchesList: any[];
   lastMove: { coords: string[]; playerId: string } | null;
   conflictCoords: string[];

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
   updateFromMatchRecord: (
      record: any,
      currentUserId: string,
      opts?: { suppressNewMoveFx?: boolean },
   ) => void;
   hydrateLocalDraft: () => void;

   // Tile play actions
   moveTileInGrid: (
      fromX: number,
      fromY: number,
      toX: number,
      toY: number,
   ) => void;
   placeTile: (x: number, y: number, letter: string) => void;
   placeBlankAs: (x: number, y: number, letter: string) => boolean;
   recallTile: (x: number, y: number) => void;
   recallAllTiles: () => void;
   shuffleRack: () => void;
   reorderRack: (fromIdx: number, toIdx: number) => void;

   submitMove: (
      userId: string,
      triggerToast: (msg: string, duration?: number, isLarge?: boolean) => void,
   ) => Promise<boolean>;
   triggerBotTurn: (
      triggerToast?: (msg: string, duration?: number) => void,
   ) => Promise<void>;
   deleteBotMatch: (matchId: string, userId: string) => Promise<void>;
   loadBotMatchesList: (userId: string) => Promise<void>;
}

let botHighlightTimer: any = null;

export const useWordGridBotStore = create<WordGridBotState>((set, get) => {
   // Re-run conflict detection against the committed board and schedule the
   // debounced local-draft save after any draft-mutating action.
   const syncDraftFx = () => {
      const { matchId, placedTiles, board, gridSize } = get();
      scheduleWordGridDraftSave(matchId, () => {
         const cur = useWordGridBotStore.getState();
         if (cur.matchId !== matchId) return null;
         return {
            placedTiles: cur.placedTiles,
            rack: cur.rack,
            savedAt: Date.now(),
         };
      });
      set({
         conflictCoords: detectDraftConflicts(placedTiles, board, gridSize),
      });
   };

   return {
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
      lastMove: null,
      conflictCoords: [],

      setView: (view) => set({ view }),

      resetGame: () => {
         if (botHighlightTimer) clearTimeout(botHighlightTimer);
         if (lastMoveTimer) clearTimeout(lastMoveTimer);
         cancelWordGridDraftSave(get().matchId);
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
            lastMove: null,
            conflictCoords: [],
         });
      },

      startBotMatch: async (
         userId,
         difficulty,
         gridSize = DEFAULT_GRID_SIZE,
         triggerToast,
      ) => {
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
                     console.warn(
                        "[WordGridBot] Async DB insert warning:",
                        error,
                     );
                     triggerToast?.(
                        `Offline mode: DB save warning (${error.message})`,
                        3000,
                     );
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
            // Expired while away: cancel instead of resuming
            if (isStaleMatch(local)) {
               await abandonBotMatchesByIds([matchId]);
               clearBotSnapshot(matchId);
            }
            const humanPlayer = local.players?.find(
               (p: any) => p.id === userId || p.id !== "bot",
            );
            const expired = isStaleMatch(local);
            set({
               matchId: local.matchId,
               gridSize: local.gridSize || DEFAULT_GRID_SIZE,
               status: expired ? "abandoned" : local.status || "active",
               board: local.board || [],
               tileBag: local.tileBag || [],
               players: local.players || [],
               currentTurnIndex: local.currentTurnIndex || 0,
               currentTurn: local.currentTurn || userId,
               moves: local.moves || [],
               botDifficulty: local.botDifficulty || "normal",
               isBotMatch: true,
               view:
                  expired || local.status === "completed"
                     ? "completed"
                     : "active",
               placedTiles: [],
               rack: humanPlayer?.rack || local.rack || [],
               loading: false,
            });
            if (!expired) get().hydrateLocalDraft();
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
               let record = data;
               // Expired while away: cancel instead of resuming
               if (isStaleMatch(record)) {
                  await abandonBotMatchesByIds([record.id]);
                  record = {
                     ...record,
                     status: "abandoned",
                     completed_at: new Date().toISOString(),
                  };
               }
               const playersList: WordGridPlayer[] = record.players_data || [
                  {
                     id: userId,
                     username: "You",
                     score: record.p1_score || 0,
                     rack: record.p1_rack || [],
                  },
                  {
                     id: "bot",
                     username: `AI (${(record.bot_difficulty || "normal").toUpperCase()})`,
                     score: record.p2_score || 0,
                     rack: record.p2_rack || [],
                  },
               ];
               const human = playersList.find(
                  (p) => p.id === userId || p.id !== "bot",
               );
               const loadedState = {
                  matchId: record.id,
                  gridSize: record.grid_size || DEFAULT_GRID_SIZE,
                  status: record.status,
                  board: record.board || [],
                  tileBag: record.tile_bag || [],
                  players: playersList,
                  currentTurnIndex: record.current_turn_index || 0,
                  currentTurn: record.current_turn || userId,
                  moves: record.moves || [],
                  botDifficulty: record.bot_difficulty || "normal",
                  isBotMatch: true,
                  view:
                     record.status === "completed" ||
                     record.status === "abandoned"
                        ? "completed"
                        : ("active" as WordGridBotViewType),
                  placedTiles: [],
                  rack: human?.rack || record.p1_rack || [],
                  loading: false,
               };
               set(loadedState);
               saveBotSnapshot(matchId, loadedState);
               get().hydrateLocalDraft();
            }
         } catch (e: any) {
            console.warn("[WordGridBot] Network loadBotMatch error:", e);
            const errMsg = e?.message || "Failed to load match";
            set({ error: errMsg, loading: false });
            triggerToast?.(`Failed to load match: ${errMsg}`, 4000);
         }
      },

      updateFromMatchRecord: (record, currentUserId, opts) => {
         if (!record) return;

         // Preserve any in-progress local draft across incoming board updates
         const prevPlacedTiles = get().placedTiles;
         const keepDraft = prevPlacedTiles.length > 0;

         const playersList: WordGridPlayer[] = record.players_data || [];
         const human = playersList.find(
            (p) => p.id === currentUserId || p.id !== "bot",
         );
         const turnIndex = record.current_turn_index ?? 0;
         const gridSize = record.grid_size || DEFAULT_GRID_SIZE;

         const newBoard = record.board || [];
         const newMoves = record.moves || [];
         const prevMovesCount = get().moves?.length || 0;

         let lastMove = get().lastMove;
         if (!opts?.suppressNewMoveFx && newMoves.length > prevMovesCount) {
            const lastMoveRecord = newMoves[newMoves.length - 1];
            if (lastMoveRecord) {
               lastMove = {
                  coords: Array.isArray(lastMoveRecord.coords)
                     ? lastMoveRecord.coords
                     : [],
                  playerId: lastMoveRecord.player_id,
               };
               startLastMoveTimer(set);
            }
         }

         const conflictCoords = keepDraft
            ? detectDraftConflicts(prevPlacedTiles, newBoard, gridSize)
            : [];

         const loadedState = {
            matchId: record.id,
            gridSize,
            status: record.status,
            board: newBoard,
            tileBag: record.tile_bag || [],
            players: playersList.length > 0 ? playersList : get().players,
            currentTurnIndex: turnIndex,
            currentTurn:
               record.current_turn || (turnIndex === 0 ? currentUserId : "bot"),
            moves: newMoves,
            botDifficulty:
               record.bot_difficulty || get().botDifficulty || "normal",
            isBotMatch: true,
            view:
               record.status === "completed" || record.status === "abandoned"
                  ? "completed"
                  : ("active" as WordGridBotViewType),
            placedTiles: keepDraft ? prevPlacedTiles : [],
            rack: keepDraft ? get().rack : human?.rack || get().rack,
            loading: false,
            lastMove,
            conflictCoords,
         };

         set(loadedState);
         saveBotSnapshot(record.id, loadedState);
      },

      hydrateLocalDraft: () => {
         const { matchId, status, board, rack, gridSize } = get();
         if (!matchId || status === "completed") return;
         const draft = loadWordGridDraft(matchId);
         if (!draft || draft.placedTiles.length === 0) return;

         const inBounds = (n: number) =>
            Number.isInteger(n) && n >= 0 && n < gridSize;
         const boardKeys = new Set(board.map((c) => `${c.x},${c.y}`));

         const remainingRack = [...rack];
         const restoredTiles: PlacedTile[] = [];
         draft.placedTiles.forEach((t) => {
            if (!inBounds(t.x) || !inBounds(t.y)) return;
            if (boardKeys.has(`${t.x},${t.y}`)) return;
            const idx = remainingRack.indexOf(t.letter);
            if (idx !== -1) {
               remainingRack.splice(idx, 1);
               restoredTiles.push({ x: t.x, y: t.y, letter: t.letter });
            }
         });

         if (restoredTiles.length === 0) {
            clearWordGridDraft(matchId);
            return;
         }

         set({
            placedTiles: restoredTiles,
            rack: remainingRack,
            conflictCoords: detectDraftConflicts(
               restoredTiles,
               board,
               gridSize,
            ),
         });
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
         syncDraftFx();
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
         syncDraftFx();
      },

      // Scrabble blank: consumes one '_' and stores the assigned letter in
      // lowercase — the raw-letter pipeline scores lowercase tiles as 0.
      placeBlankAs: (x, y, letter) => {
         const chosen = letter.trim().toUpperCase();
         if (!/^[A-Z]$/.test(chosen)) return false;
         const { rack, placedTiles } = get();
         const blankIdx = rack.indexOf("_");
         if (blankIdx === -1) return false;

         const newRack = [...rack];
         newRack.splice(blankIdx, 1);
         set({
            placedTiles: [
               ...placedTiles,
               { x, y, letter: chosen.toLowerCase() },
            ],
            rack: newRack,
         });
         syncDraftFx();
         return true;
      },

      recallTile: (x, y) => {
         const { rack, placedTiles } = get();
         const tileIdx = placedTiles.findIndex((t) => t.x === x && t.y === y);
         if (tileIdx === -1) return;

         const tile = placedTiles[tileIdx];
         const newPlaced = [...placedTiles];
         newPlaced.splice(tileIdx, 1);
         // Assigned blanks (stored lowercase) go back to the rack as '_'
         const backToRack = /[a-z]/.test(tile.letter) ? "_" : tile.letter;
         set({
            placedTiles: newPlaced,
            rack: [...rack, backToRack],
         });
         syncDraftFx();
      },

      recallAllTiles: () => {
         const { rack, placedTiles } = get();
         set({
            placedTiles: [],
            rack: [
               ...rack,
               ...placedTiles.map((t) =>
                  /^[a-z]$/.test(t.letter) ? "_" : t.letter,
               ),
            ],
         });
         syncDraftFx();
      },

      shuffleRack: () => {
         const { rack } = get();
         const newRack = [...rack];
         for (let i = newRack.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newRack[i], newRack[j]] = [newRack[j], newRack[i]];
         }
         set({ rack: newRack });
         syncDraftFx();
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
         syncDraftFx();
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
            const submittedMoves = humanRes.updatedState.moves || [];
            const updatedState = {
               ...state,
               ...humanRes.updatedState,
               placedTiles: [],
               rack: humanPlayer?.rack || state.rack,
               conflictCoords: [],
               lastMove: {
                  coords:
                     (submittedMoves[submittedMoves.length - 1] as any)
                        ?.coords || [],
                  playerId: userId,
               },
            };

            set(updatedState);
            saveBotSnapshot(state.matchId, updatedState);
            startLastMoveTimer(set);
            clearWordGridDraft(state.matchId);

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
                     triggerToast?.(
                        `Cloud sync warning: ${error.message || "Failed to update match"}`,
                        4000,
                     );
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
            triggerToast?.(
               `Failed to submit move: ${err?.message || "Unexpected error"}`,
               4000,
            );
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
            const botCoords = botMove?.placedTiles
               ? botMove.placedTiles.map((t: any) => `${t.x},${t.y}`)
               : [];

            const updatedState = {
               ...state,
               ...botRes.updatedState,
               currentTurn: humanPlayer?.id || "p1",
               currentTurnIndex: 0,
               isBotThinking: false,
               lastBotMove: botMove,
               lastBotPlacedCoords: botCoords,
               lastMove: { coords: botCoords, playerId: "bot" },
            };

            set(updatedState);
            saveBotSnapshot(state.matchId, updatedState);
            startLastMoveTimer(set);

            if (botMove) {
               window.dispatchEvent(
                  new CustomEvent("opponent-played-move", {
                     detail: {
                        playerName: "WordGrid Bot 🤖",
                        word: botMove.word,
                        score: botMove.score,
                        isSwap:
                           typeof botMove.word === "string" &&
                           botMove.word.includes("Swapped"),
                     },
                  }),
               );
            }

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
                     triggerToast?.(
                        `Cloud sync warning: ${error.message || "Failed to sync bot move"}`,
                        4000,
                     );
                  }
               });
         } catch (err: any) {
            console.error("[WordGridBot] triggerBotTurn error:", err);
            set({ isBotThinking: false });
            triggerToast?.(
               `Bot turn error: ${err?.message || "Failed to process bot turn"}`,
               4000,
            );
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

      loadBotMatchesList: async (userId) => {
         if (!userId) return;
         try {
            const { data } = await supabase
               .from("wordgrid_matches")
               .select("*")
               .eq("is_bot_match", true)
               .eq("player1_id", userId)
               .order("created_at", { ascending: false });

            let rows = data || [];
            // Auto-cancel own stale matches (client-side sweep, no server schedule)
            const staleIds = findStaleMatchIds(rows);
            if (staleIds.length > 0) {
               await abandonBotMatchesByIds(staleIds);
               rows = rows.map((m) =>
                  staleIds.includes(m.id) ? { ...m, status: "abandoned" } : m,
               );
            }
            set({ botMatchesList: rows });
         } catch (e) {
            console.warn("[WordGridBot] loadBotMatchesList error:", e);
         }
      },
   };
});
