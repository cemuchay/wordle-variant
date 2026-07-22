/* eslint-disable @typescript-eslint/no-explicit-any */
// src/store/useWordGridStore.ts

import { create } from "zustand";
import { supabase } from "../lib/supabaseClient";
import type {
   GridCell,
   PlacedTile,
   WordGridPlayer,
} from "../utils/wordgrid/constants";
import { DEFAULT_GRID_SIZE } from "../utils/wordgrid/constants";
import { validateBoardPlacement } from "../utils/wordgrid/boardValidation";
import { calculateTurnScore } from "../utils/wordgrid/scoring";
import { validateWordInDictionary } from "../utils/wordgrid/dictionary";
import {
   generateInitialTileBag,
   drawBalancedRack,
} from "../utils/wordgrid/bagBalancing";

import { safeLocalStorage } from "../utils/storage";
import { preloadBotWordPools, findBotWordMove } from "../utils/wordgrid/botAI";

export type WordGridViewType = "lobby" | "matchmaking" | "active" | "completed";

// Helper to validate UUID string
function isUuid(val: any): boolean {
   return (
      typeof val === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
         val,
      )
   );
}

// 1. Retry wrapper for network requests (2 retries max)
async function withRetry<T>(
   fn: () => Promise<T>,
   maxRetries = 2,
   delayMs = 600,
): Promise<T> {
   let lastErr: any;
   for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
         return await fn();
      } catch (err: any) {
         lastErr = err;
         if (attempt < maxRetries) {
            await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
         }
      }
   }
   throw lastErr;
}

// 7 days expiration in milliseconds
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// 2. Local Storage Draft Persistence (Debounce 300ms)
let draftDebounceTimer: ReturnType<typeof setTimeout> | null = null;

export function saveDraftToLocalStorage(
   matchId: string | null,
   placedTiles: PlacedTile[],
   rack: string[],
) {
   if (!matchId) return;
   if (draftDebounceTimer) clearTimeout(draftDebounceTimer);
   draftDebounceTimer = setTimeout(() => {
      try {
         const key = `wordgrid_draft_${matchId}`;
         if (placedTiles.length === 0) {
            safeLocalStorage.removeItem(key);
         } else {
            safeLocalStorage.setItem(
               key,
               JSON.stringify({ placedTiles, rack, timestamp: Date.now() }),
            );
         }
      } catch (e) {
         console.warn("[WordGrid] Failed to save draft:", e);
      }
   }, 300);
}

export function clearDraftFromLocalStorage(matchId: string | null) {
   if (!matchId) return;
   if (draftDebounceTimer) clearTimeout(draftDebounceTimer);
   try {
      safeLocalStorage.removeItem(`wordgrid_draft_${matchId}`);
   } catch (e) {
      console.warn("[WordGrid] Failed to clear draft:", e);
   }
}

export function loadDraftFromLocalStorage(
   matchId: string | null,
): { placedTiles: PlacedTile[]; rack: string[] } | null {
   if (!matchId) return null;
   try {
      const dataStr = safeLocalStorage.getItem(`wordgrid_draft_${matchId}`);
      if (!dataStr) return null;
      const parsed = JSON.parse(dataStr);

      // Auto-clear draft if older than 7 days
      if (parsed.timestamp && Date.now() - parsed.timestamp > SEVEN_DAYS_MS) {
         clearDraftFromLocalStorage(matchId);
         return null;
      }

      if (Array.isArray(parsed.placedTiles) && Array.isArray(parsed.rack)) {
         return { placedTiles: parsed.placedTiles, rack: parsed.rack };
      }
   } catch (e) {
      console.warn("[WordGrid] Failed to load draft:", e);
   }
   return null;
}

// 3. Pending Uploads Queue in Local Storage
const PENDING_UPLOADS_KEY = "wordgrid_pending_uploads";

function enqueuePendingUpload(
   id: string,
   matchId: string,
   type: "update" | "insert",
   payload: any,
) {
   try {
      const existingStr = safeLocalStorage.getItem(PENDING_UPLOADS_KEY);
      const list = existingStr ? JSON.parse(existingStr) : [];
      list.push({
         id,
         matchId,
         type,
         payload,
         timestamp: Date.now(),
         status: "pending_upload",
      });
      safeLocalStorage.setItem(PENDING_UPLOADS_KEY, JSON.stringify(list));
   } catch (e) {
      console.warn("[WordGrid] Failed to enqueue pending upload:", e);
   }
}

function dequeuePendingUpload(id: string) {
   try {
      const existingStr = safeLocalStorage.getItem(PENDING_UPLOADS_KEY);
      if (!existingStr) return;
      let list = JSON.parse(existingStr);
      list = list.filter((item: any) => item.id !== id);
      if (list.length === 0) {
         safeLocalStorage.removeItem(PENDING_UPLOADS_KEY);
      } else {
         safeLocalStorage.setItem(PENDING_UPLOADS_KEY, JSON.stringify(list));
      }
   } catch (e) {
      console.warn("[WordGrid] Failed to dequeue pending upload:", e);
   }
}

// Prune any WordGrid local storage drafts older than 7 days
export function pruneExpiredStorageData() {
   try {
      const keys = safeLocalStorage.getAllKeys();
      const now = Date.now();
      for (const key of keys) {
         if (key.startsWith("wordgrid_draft_")) {
            const raw = safeLocalStorage.getItem(key);
            if (raw) {
               try {
                  const data = JSON.parse(raw);
                  if (data.timestamp && now - data.timestamp > SEVEN_DAYS_MS) {
                     safeLocalStorage.removeItem(key);
                  }
               } catch {
                  /* no empty blocks */
               }
            }
         }
      }
   } catch (e) {
      console.warn("[WordGrid] Prune expired storage failed:", e);
   }
}

export async function flushPendingUploads() {
   try {
      pruneExpiredStorageData();

      const existingStr = safeLocalStorage.getItem(PENDING_UPLOADS_KEY);
      if (!existingStr) return;
      const list: any[] = JSON.parse(existingStr);
      if (!Array.isArray(list) || list.length === 0) return;

      const now = Date.now();
      const validUploads = list.filter(
         (item: any) =>
            !item.timestamp || now - item.timestamp <= SEVEN_DAYS_MS,
      );

      if (validUploads.length !== list.length) {
         if (validUploads.length === 0) {
            safeLocalStorage.removeItem(PENDING_UPLOADS_KEY);
         } else {
            safeLocalStorage.setItem(
               PENDING_UPLOADS_KEY,
               JSON.stringify(validUploads),
            );
         }
      }

      for (const item of validUploads) {
         try {
            if (item.type === "update" && item.matchId) {
               await safeWordGridUpdate(item.matchId, item.payload);
            } else if (item.type === "insert") {
               await safeWordGridInsert(item.payload);
            }
            dequeuePendingUpload(item.id);
            clearDraftFromLocalStorage(item.matchId);
         } catch (err) {
            console.warn("[WordGrid] Flush upload item failed:", item.id, err);
         }
      }
   } catch (e) {
      console.warn("[WordGrid] Failed to flush pending uploads:", e);
   }
}

// Helper to update wordgrid_matches safely with 2 retries and offline queueing
async function safeWordGridUpdate(
   matchId: string,
   payload: Record<string, any>,
) {
   const uploadId = `upd_${matchId}_${Date.now()}`;
   enqueuePendingUpload(uploadId, matchId, "update", payload);

   try {
      const res = await withRetry(async () => {
         let { error } = await supabase
            .from("wordgrid_matches")
            .update(payload)
            .eq("id", matchId);

         if (
            error &&
            (error.code === "PGRST204" ||
               error.message?.includes("schema cache") ||
               error.message?.includes("column"))
         ) {
            const fallbackPayload = { ...payload };
            delete fallbackPayload.players_data;
            delete fallbackPayload.current_turn_index;
            delete fallbackPayload.grid_size;
            delete fallbackPayload.max_players;

            const fallbackRes = await supabase
               .from("wordgrid_matches")
               .update(fallbackPayload)
               .eq("id", matchId);
            error = fallbackRes.error;
         }
         if (error) throw error;
         return { error: null };
      }, 2);

      dequeuePendingUpload(uploadId);
      clearDraftFromLocalStorage(matchId);
      return res;
   } catch (error: any) {
      console.warn(
         "[WordGrid] Network update failed after 2 retries, payload queued in safeLocalStorage.",
         error,
      );
      return { error };
   }
}

// Helper to insert into wordgrid_matches safely with 2 retries and offline queueing
async function safeWordGridInsert(payload: Record<string, any>) {
   const uploadId = `ins_${Date.now()}`;
   enqueuePendingUpload(uploadId, payload.id || "", "insert", payload);

   try {
      const res = await withRetry(async () => {
         let r = await supabase
            .from("wordgrid_matches")
            .insert(payload)
            .select()
            .single();

         if (
            r.error &&
            (r.error.code === "PGRST204" ||
               r.error.message?.includes("schema cache") ||
               r.error.message?.includes("column"))
         ) {
            const fallbackPayload = { ...payload };
            delete fallbackPayload.players_data;
            delete fallbackPayload.current_turn_index;
            delete fallbackPayload.grid_size;
            delete fallbackPayload.max_players;

            r = await supabase
               .from("wordgrid_matches")
               .insert(fallbackPayload)
               .select()
               .single();
         }
         if (r.error) throw r.error;
         return r;
      }, 2);

      dequeuePendingUpload(uploadId);
      return res;
   } catch (err: any) {
      console.warn(
         "[WordGrid] Network insert failed after 2 retries, payload queued in safeLocalStorage.",
         err,
      );
      return { data: null, error: err };
   }
}

interface WordGridState {
   // Game States
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
   isBotMatch: boolean;
   botDifficulty: "easy" | "normal" | "hard";

   // Legacy 2-player quick access getters
   player1: any | null;
   player2: any | null;
   p1Score: number;
   p2Score: number;
   role: "player1" | "player2" | null;

   // Local UI States
   view: WordGridViewType;
   placedTiles: PlacedTile[]; // Tiles currently placed in the current turn
   rack: string[]; // Active player's working rack
   loading: boolean;
   error: string | null;
   matchesList: any[];

   // Actions
   setView: (view: WordGridViewType) => void;
   resetGame: () => void;
   setMatchId: (matchId: string | null) => void;

   // Board & Rack play actions
   moveTileInGrid: (fromX: number, fromY: number, toX: number, toY: number) => void;
   placeTile: (x: number, y: number, letter: string) => void;
   recallTile: (x: number, y: number) => void;
   recallAllTiles: () => void;
   shuffleRack: () => void;

   // Game turn submissions (No Pass option - Swap or Play only)
   submitMove: (
      userId: string,
      triggerToast: (msg: string, duration?: number, isLarge?: boolean) => void,
   ) => Promise<boolean>;
   exchangeTiles: (
      userId: string,
      lettersToExchange: string[],
      triggerToast?: (msg: string, duration?: number, isLarge?: boolean) => void,
   ) => Promise<void>;
   resignMatch: (userId: string) => Promise<void>;

   // Supabase Sync & Matchmaking
   loadMatch: (matchId: string, currentUserId: string) => Promise<void>;
   updateFromMatchRecord: (record: any, currentUserId: string) => void;
   loadMatchesList: (userId: string) => Promise<void>;
   startQueue: (
      userId: string,
      isRated: boolean,
      gridSize: number,
      targetPlayers: number,
      triggerToast: (msg: string, duration?: number) => void,
   ) => Promise<void>;
   cancelQueue: (userId: string) => Promise<void>;
   startBotMatch: (
      userId: string,
      difficulty: "easy" | "normal" | "hard",
      gridSize?: number,
   ) => Promise<void>;
   startDirectChallenge: (
      userId: string,
      opponentId: string,
      gridSize: number,
      triggerToast: (msg: string, duration?: number) => void,
   ) => Promise<void>;
   playBotTurn: (
      newBoard: GridCell[],
      newBag: string[],
      botPlayerIdx: number,
   ) => Promise<void>;
}

export const useWordGridStore = create<WordGridState>((set, get) => ({
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
   isBotMatch: false,
   botDifficulty: "normal",

   player1: null,
   player2: null,
   p1Score: 0,
   p2Score: 0,
   role: null,

   view: "lobby",
   placedTiles: [],
   rack: [],
   loading: false,
   error: null,
   matchesList: [],

   setView: (view) => set({ view }),

   resetGame: () => {
      clearDraftFromLocalStorage(get().matchId);
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
         isBotMatch: false,
         botDifficulty: "normal",
         player1: null,
         player2: null,
         p1Score: 0,
         p2Score: 0,
         role: null,
         placedTiles: [],
         rack: [],
         error: null,
         matchesList: [],
      });
   },

   setMatchId: (matchId) => set({ matchId }),

   moveTileInGrid: (fromX: number, fromY: number, toX: number, toY: number) => {
      const { placedTiles, board, matchId } = get();
      // Cannot move to an already occupied cell (either on existing board or placed tiles)
      const isBoardOccupied = board.some((c) => c.x === toX && c.y === toY);
      const isPlacedOccupied = placedTiles.some((t) => t.x === toX && t.y === toY);
      if (isBoardOccupied || isPlacedOccupied) return;

      const tileIdx = placedTiles.findIndex((t) => t.x === fromX && t.y === fromY);
      if (tileIdx === -1) return;

      const newPlaced = [...placedTiles];
      newPlaced[tileIdx] = { ...newPlaced[tileIdx], x: toX, y: toY };

      set({ placedTiles: newPlaced });
      saveDraftToLocalStorage(matchId, newPlaced, get().rack);
   },

   placeTile: (x, y, letter) => {
      const { rack, placedTiles, matchId } = get();
      const idx = rack.findIndex((l) => l === letter);
      if (idx === -1) return;

      const newRack = [...rack];
      newRack.splice(idx, 1);
      const newPlaced = [...placedTiles, { x, y, letter }];

      set({
         placedTiles: newPlaced,
         rack: newRack,
      });
      saveDraftToLocalStorage(matchId, newPlaced, newRack);
   },

   recallTile: (x, y) => {
      const { rack, placedTiles, matchId } = get();
      const tileIdx = placedTiles.findIndex((t) => t.x === x && t.y === y);
      if (tileIdx === -1) return;

      const tile = placedTiles[tileIdx];
      const newPlaced = [...placedTiles];
      newPlaced.splice(tileIdx, 1);
      const newRack = [...rack, tile.letter];

      set({
         placedTiles: newPlaced,
         rack: newRack,
      });
      saveDraftToLocalStorage(matchId, newPlaced, newRack);
   },

   recallAllTiles: () => {
      const { rack, placedTiles, matchId } = get();
      const recalledLetters = placedTiles.map((t) => t.letter);
      set({
         placedTiles: [],
         rack: [...rack, ...recalledLetters],
      });
      clearDraftFromLocalStorage(matchId);
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

   loadMatch: async (matchId, currentUserId) => {
      get().resetGame();
      set({ loading: true, error: null });
      try {
         const { data, error } = await supabase
            .from("wordgrid_matches")
            .select(
               `
          *,
          player1:player1_id(id, username, avatar_url),
          player2:player2_id(id, username, avatar_url)
        `,
            )
            .eq("id", matchId)
            .single();

         if (error) throw error;
         if (data) {
            get().updateFromMatchRecord(data, currentUserId);
         }
      } catch (e: any) {
         set({ error: e.message });
      } finally {
         set({ loading: false });
      }
   },

   updateFromMatchRecord: (record, currentUserId) => {
      // In bot matches or guest matches where player1_id was inserted as null in DB, treat current user as player1
      const isBotMatch = record.is_bot_match || get().isBotMatch;
      const isP1 = record.player1_id === currentUserId || isBotMatch || !record.player1_id;
      const isP2 = !isP1 && record.player2_id === currentUserId;
      const role = isP1 ? "player1" : isP2 ? "player2" : null;

      // Extract player list (support new multi-player structure or legacy 2p schema)
      let playersList: WordGridPlayer[] = record.players_data || [];
      if (playersList.length === 0) {
         playersList = [
            {
               id: record.player1_id,
               username: record.player1?.username || "Player 1",
               avatar_url: record.player1?.avatar_url,
               score: record.p1_score || 0,
               rack: record.p1_rack || [],
            },
            {
               id: record.player2_id || "bot",
               username: record.is_bot_match
                  ? `AI (${(record.bot_difficulty || "normal").toUpperCase()})`
                  : record.player2?.username || "Player 2",
               avatar_url: record.player2?.avatar_url,
               score: record.p2_score || 0,
               rack: record.p2_rack || [],
            },
         ];
      }

      const activePlayerObj = playersList.find((p) => p.id === currentUserId || (isP1 && p.id !== 'bot'));
      const activeRack = activePlayerObj
         ? activePlayerObj.rack
         : isP1
           ? (record.p1_rack || playersList[0]?.rack)
           : (record.p2_rack || playersList[1]?.rack);

      const turnIndex =
         record.current_turn_index !== undefined &&
         record.current_turn_index !== null
            ? record.current_turn_index
            : Math.max(
                 0,
                 playersList.findIndex((p) => p.id === record.current_turn),
              );

      const resolvedCurrentTurn =
         record.current_turn || playersList[turnIndex]?.id || currentUserId || (isP1 ? record.player1_id : record.player2_id);

      // Check if a local storage draft exists for this matchId and restore uncommitted placed tiles
      let activePlaced = get().placedTiles;
      let activeWorkingRack =
         get().placedTiles.length > 0 ? get().rack : activeRack || [];
      if (record.id) {
         const draft = loadDraftFromLocalStorage(record.id);
         if (
            draft &&
            Array.isArray(draft.placedTiles) &&
            draft.placedTiles.length > 0
         ) {
            activePlaced = draft.placedTiles;
            activeWorkingRack = draft.rack;
         }
      }

      set({
         matchId: record.id,
         gridSize: record.grid_size || DEFAULT_GRID_SIZE,
         maxPlayers: record.max_players || 2,
         role,
         status: record.status,
         board: record.board || [],
         tileBag: record.tile_bag || record.tileBag || [],
         players: playersList,
         currentTurnIndex: turnIndex,
         currentTurn: resolvedCurrentTurn,

         p1Score: record.p1_score || (playersList[0]?.score ?? 0),
         p2Score: record.p2_score || (playersList[1]?.score ?? 0),
         moves: record.moves || [],
         isBotMatch: record.is_bot_match,
         botDifficulty: record.bot_difficulty,
         player1: record.player1 || {
            id: record.player1_id,
            username: playersList[0]?.username,
         },
         player2: record.player2 || {
            id: record.player2_id,
            username: playersList[1]?.username,
         },
         view: record.status === "completed" ? "completed" : "active",
         placedTiles: activePlaced,
         rack: activeWorkingRack,
      });
   },

   submitMove: async (userId, triggerToast) => {
      const {
         matchId,
         placedTiles,
         board,
         players,
         currentTurn,
         tileBag,
         moves,
         gridSize,
      } = get();
      if (!matchId || currentTurn !== userId) return false;

      // 1. Board placement alignment validation
      const validation = validateBoardPlacement(placedTiles, board, gridSize);
      if (!validation.isValid) {
         triggerToast(validation.error || "Invalid placement");
         return false;
      }

      // 2. Dictionary word validity checks
      const words = validation.wordsFormed || [];
      for (const w of words) {
         const isValid = await validateWordInDictionary(w.word);
         if (!isValid) {
            triggerToast(`"${w.word}" is not a valid word!`);
            return false;
         }
      }

      // 3. Score calculation
      const scoreResult = calculateTurnScore(words, placedTiles.length, board, gridSize);

      // Update board state
      const newBoard = [...board];
      placedTiles.forEach((tile) => {
         newBoard.push({
            x: tile.x,
            y: tile.y,
            letter: tile.letter,
            ownerId: userId,
         });
      });

      // Update player's rack and draw replacements using bag balancing
      const activeIdx = players.findIndex((p) => p.id === userId);
      if (activeIdx === -1) return false;

      const currentRack = [...players[activeIdx].rack];
      placedTiles.forEach((tile) => {
         const idx = currentRack.indexOf(tile.letter);
         if (idx !== -1) currentRack.splice(idx, 1);
      });

      const { rack: newRack, newBag } = await drawBalancedRack(
         tileBag,
         currentRack,
         7,
         false,
      );

      // Update players list with updated score and rack
      const updatedPlayers = [...players];
      updatedPlayers[activeIdx] = {
         ...updatedPlayers[activeIdx],
         score: updatedPlayers[activeIdx].score + scoreResult.totalScore,
         rack: newRack,
      };

      // Determine next player's turn
      const nextTurnIdx = (get().currentTurnIndex + 1) % players.length;
      const nextPlayerTurnId = updatedPlayers[nextTurnIdx].id;

      const movePayload = {
         player_id: userId,
         word: words.map((w) => w.word).join(", "),
         score: scoreResult.totalScore,
         breakdown: scoreResult.words.map((w) => w.breakdown).join(" | ") + (scoreResult.bingoApplied ? " + 50 (1st Move Bingo Bonus)" : ""),
         tiles_placed: placedTiles,
         timestamp: new Date().toISOString(),
      };

      const nextMoves = [...moves, movePayload];

      // Check game end condition: empty bag and all players unable to move / rack empty
      const isCompleted =
         newBag.length === 0 && updatedPlayers.some((p) => p.rack.length === 0);

      const updatePayload: any = {
         board: newBoard,
         tile_bag: newBag,
         players_data: updatedPlayers,
         p1_rack: updatedPlayers[0]?.rack || [],
         p2_rack: updatedPlayers[1]?.rack || [],
         p1_score: updatedPlayers[0]?.score || 0,
         p2_score: updatedPlayers[1]?.score || 0,
         moves: nextMoves,
         current_turn_index: nextTurnIdx,
         current_turn: isUuid(nextPlayerTurnId) ? nextPlayerTurnId : null,
         last_move_at: new Date().toISOString(),
      };

      if (isCompleted) {
         updatePayload.status = "completed";
         updatePayload.completed_at = new Date().toISOString();
      }

      try {
         const { error } = await safeWordGridUpdate(matchId, updatePayload);

         if (error) throw error;
         set({
            placedTiles: [],
            rack: newRack,
            players: updatedPlayers,
            currentTurnIndex: nextTurnIdx,
            currentTurn: nextPlayerTurnId,
         });
         triggerToast(`Placed word(s)! Score: +${scoreResult.totalScore}`, 4000, true);

         // Handle Bot Turn if applicable
         if (get().isBotMatch && !isCompleted && (nextPlayerTurnId === "bot" || updatedPlayers[nextTurnIdx]?.id === "bot")) {
            setTimeout(
               () => get().playBotTurn(newBoard, newBag, nextTurnIdx),
               600,
            );
         }

         return true;
      } catch (e: any) {
         triggerToast(`Error saving move: ${e?.message || "DB Error"}`);
         console.error("submitMove error:", e);
         return false;
      }
   },

   exchangeTiles: async (userId, lettersToExchange, triggerToast) => {
      const { matchId, players, tileBag, currentTurnIndex, moves } = get();
      if (!matchId || lettersToExchange.length === 0) return;

      // 1. Locate active player index in players array
      let activeIdx = players.findIndex((p) => p.id === userId);
      if (activeIdx === -1) {
         if (userId === get().player1?.id) activeIdx = 0;
         else if (userId === get().player2?.id) activeIdx = 1;
         else activeIdx = currentTurnIndex;
      }

      const activePlayer = players[activeIdx] || { id: userId, rack: get().rack };
      const currentRack = [...activePlayer.rack];

      // Remove letters to exchange
      lettersToExchange.forEach((l) => {
         const idx = currentRack.indexOf(l);
         if (idx !== -1) currentRack.splice(idx, 1);
      });

      // Draw replacement tiles
      const { rack: newRack, newBag: tempBag } = await drawBalancedRack(
         tileBag,
         currentRack,
         7,
         false,
      );

      // Put exchanged letters back into bag and reshuffle
      const nextBag = [...tempBag, ...lettersToExchange];
      for (let i = nextBag.length - 1; i > 0; i--) {
         const j = Math.floor(Math.random() * (i + 1));
         [nextBag[i], nextBag[j]] = [nextBag[j], nextBag[i]];
      }

      // Swapping tiles loses turn! Switch turn to next player.
      const updatedPlayers = [...players];
      updatedPlayers[activeIdx] = {
         ...updatedPlayers[activeIdx],
         rack: newRack,
      };

      const nextTurnIdx = (currentTurnIndex + 1) % players.length;
      const nextPlayerTurnId = updatedPlayers[nextTurnIdx].id;

      const movePayload = {
         player_id: userId,
         word: `SWAP (${lettersToExchange.length} tiles)`,
         score: 0,
         tiles_placed: [],
         timestamp: new Date().toISOString(),
      };

      const updatePayload: any = {
         tile_bag: nextBag,
         players_data: updatedPlayers,
         p1_rack: updatedPlayers[0]?.rack || [],
         p2_rack: updatedPlayers[1]?.rack || [],
         moves: [...moves, movePayload],
         current_turn_index: nextTurnIdx,
         current_turn: isUuid(nextPlayerTurnId) ? nextPlayerTurnId : null,
         last_move_at: new Date().toISOString(),
      };

      const { error } = await safeWordGridUpdate(matchId, updatePayload);
      if (error) {
         console.error("exchangeTiles error:", error);
         if (triggerToast) triggerToast("Failed to save tile exchange.");
         return;
      }

      set({
         rack: newRack,
         players: updatedPlayers,
         currentTurnIndex: nextTurnIdx,
         currentTurn: nextPlayerTurnId,
      });
      get().recallAllTiles();

      if (triggerToast) {
         triggerToast(`Swapped ${lettersToExchange.length} tiles. Turn ended.`);
      }

      // Handle Bot Turn if applicable after swapping tiles
      if (get().isBotMatch && (nextPlayerTurnId === "bot" || updatedPlayers[nextTurnIdx]?.id === "bot")) {
         setTimeout(
            () => get().playBotTurn(get().board, nextBag, nextTurnIdx),
            600,
         );
      }
   },

   // eslint-disable-next-line @typescript-eslint/no-unused-vars
   resignMatch: async (_userId) => {
      const { matchId } = get();
      if (!matchId) return;

      await safeWordGridUpdate(matchId, {
         status: "completed",
         completed_at: new Date().toISOString(),
      });
   },

   startQueue: async (
      userId,
      isRated,
      gridSize,
      targetPlayers,
      triggerToast,
   ) => {
      set({ view: "matchmaking", error: null });
      try {
         // Attempt to call RPC with dynamic params
         let { data, error } = await supabase.rpc("join_wordgrid_queue", {
            p_user_id: userId,
            p_is_rated: isRated,
            p_grid_size: gridSize,
            p_max_players: targetPlayers,
         });

         // Fallback if RPC signature in DB does not take p_grid_size yet
         if (
            error &&
            (error.code === "PGRST202" ||
               error.message?.includes("function") ||
               error.message?.includes("parameter"))
         ) {
            const fallbackRes = await supabase.rpc("join_wordgrid_queue", {
               p_user_id: userId,
               p_is_rated: isRated,
            });
            data = fallbackRes.data;
            error = fallbackRes.error;
         }

         if (error) throw error;
         const res = data as any;
         if (res?.match_id) {
            set({ matchId: res.match_id, role: res.role });
            await get().loadMatch(res.match_id, userId);
         }
      } catch (e: any) {
         console.error("Matchmaking RPC error:", e);
         triggerToast(e?.message || "Matchmaking error. Please try again.");
         set({ view: "lobby", error: e?.message || "Matchmaking error" });
      }
   },

   cancelQueue: async (userId) => {
      if (!isUuid(userId)) {
         set({ view: "lobby" });
         return;
      }
      await supabase.from("wordgrid_queue").delete().eq("user_id", userId);
      set({ view: "lobby" });
   },

    startBotMatch: async (userId, difficulty, gridSize = DEFAULT_GRID_SIZE) => {
       get().resetGame();
       set({ loading: true, error: null, isBotMatch: true, botDifficulty: difficulty });
       preloadBotWordPools();
       const initialBag = generateInitialTileBag();

      // Draw balanced 7 tiles for player, and 7 tiles for bot
      const { rack: p1Rack, newBag: bagAfterP1 } = await drawBalancedRack(
         initialBag,
         [],
         7,
         true,
      );
      const { rack: botRack, newBag: finalBag } = await drawBalancedRack(
         bagAfterP1,
         [],
         7,
         true,
      );

      const dbPlayer1Id = isUuid(userId) ? userId : null;

      const initialPlayers: WordGridPlayer[] = [
         {
            id: userId,
            username: "Player (You)",
            score: 0,
            rack: p1Rack,
         },
         {
            id: "bot",
            username: `AI (${difficulty.toUpperCase()})`,
            score: 0,
            rack: botRack,
         },
      ];

      try {
         const insertRes = await safeWordGridInsert({
            player1_id: dbPlayer1Id,
            player2_id: null,
            is_bot_match: true,
            bot_difficulty: difficulty,
            grid_size: gridSize,
            max_players: 2,
            status: "active",
            board: [],
            tile_bag: finalBag,
            players_data: initialPlayers,
            p1_rack: p1Rack,
            p2_rack: botRack,
            current_turn_index: 0,
            current_turn: userId,
            p1_score: 0,
            p2_score: 0,
            moves: [],
         });

         const matchIdToUse = insertRes?.data?.id || `bot_match_${Date.now()}`;

         set({
            matchId: matchIdToUse,
            gridSize,
            role: "player1",
            view: "active",
            rack: p1Rack,
            board: [],
            players: initialPlayers,
            tileBag: finalBag,
            p1Score: 0,
            p2Score: 0,
            currentTurnIndex: 0,
            currentTurn: userId,
            isBotMatch: true,
            botDifficulty: difficulty,
            status: "active",
            player1: { id: userId, username: "Player (You)" },
            player2: {
               id: "bot",
               username: `AI (${difficulty.toUpperCase()})`,
            },
         });
      } catch (e: any) {
         console.error("startBotMatch error:", e);
         set({ error: e?.message || "Failed to start bot match" });
      } finally {
         set({ loading: false });
      }
   },

   loadMatchesList: async (userId) => {
      if (!isUuid(userId)) {
         set({ matchesList: [] });
         return;
      }

      try {
         const { data, error } = await supabase
            .from("wordgrid_matches")
            .select(
               `
          *,
          player1:player1_id(id, username, avatar_url),
          player2:player2_id(id, username, avatar_url)
        `,
            )
            .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
            .order("last_move_at", { ascending: false });

         if (error) throw error;
         set({ matchesList: data || [] });
      } catch (e) {
         console.error("Failed to load matches list:", e);
      }
   },

   startDirectChallenge: async (userId, opponentId, gridSize, triggerToast) => {
      set({ loading: true, error: null });
      const initialBag = generateInitialTileBag();

      const { rack: p1Rack, newBag: bag1 } = await drawBalancedRack(
         initialBag,
         [],
         7,
         true,
      );
      const { rack: p2Rack, newBag: finalBag } = await drawBalancedRack(
         bag1,
         [],
         7,
         true,
      );

      const initialPlayers: WordGridPlayer[] = [
         { id: userId, username: "Player 1", score: 0, rack: p1Rack },
         { id: opponentId, username: "Player 2", score: 0, rack: p2Rack },
      ];

      try {
         const { data, error } = await safeWordGridInsert({
            player1_id: isUuid(userId) ? userId : null,
            player2_id: isUuid(opponentId) ? opponentId : null,
            grid_size: gridSize,
            max_players: 2,
            is_bot_match: false,
            status: "active",
            board: [],
            tile_bag: finalBag,
            players_data: initialPlayers,
            p1_rack: p1Rack,
            p2_rack: p2Rack,
            current_turn_index: 0,
            current_turn: isUuid(userId) ? userId : null,
            p1_score: 0,
            p2_score: 0,
            moves: [],
         });

         if (error) throw error;
         if (data) {
            set({
               matchId: data.id,
               gridSize,
               role: "player1",
               view: "active",
               rack: p1Rack,
               board: [],
               players: initialPlayers,
               tileBag: finalBag,
               p1Score: 0,
               p2Score: 0,
               currentTurnIndex: 0,
               currentTurn: userId,
               isBotMatch: false,
               player1: data.player1 || { id: userId, username: "Player 1" },
               player2: data.player2 || {
                  id: opponentId,
                  username: "Player 2",
               },
            });
            triggerToast("Challenge match created! Place your starting word.");
         }
      } catch (e: any) {
         console.error("startDirectChallenge error:", e);
         triggerToast(e?.message || "Failed to create challenge.");
      }
   },
    playBotTurn: async (
       newBoard: GridCell[],
       newBag: string[],
       botPlayerIdx: number,
    ) => {
       const { matchId, moves, players, gridSize, botDifficulty } = get();
       if (!matchId) return;

       // Preload bot word pools if not preloaded yet
       await preloadBotWordPools();

       const updatedPlayers = [...players];
       const botPlayer = updatedPlayers[botPlayerIdx] || {
          id: "bot",
          username: "AI",
          score: 0,
          rack: [],
       };
       const botRack = [...botPlayer.rack];
       const updatedBoard = [...newBoard];
       let currentBag = [...newBag];
       let addedScore = 0;
       let wordPlaced = "SWAP";

       const botMove = await findBotWordMove(updatedBoard, botRack, gridSize, botDifficulty);

      if (botMove && botMove.placedTiles.length > 0) {
         // Apply placed tiles to board
         for (const tile of botMove.placedTiles) {
            updatedBoard.push({
               x: tile.x,
               y: tile.y,
               letter: tile.letter.toUpperCase(),
               ownerId: "bot",
            });
            const rIdx = botRack.findIndex((l) => l.toUpperCase() === tile.letter.toUpperCase());
            if (rIdx !== -1) botRack.splice(rIdx, 1);
         }

         const { rack: refreshedRack, newBag: nextBag } = await drawBalancedRack(
            currentBag,
            botRack,
            7,
            false,
         );
         currentBag = nextBag;
         addedScore = botMove.score;
         wordPlaced = botMove.word;

         updatedPlayers[botPlayerIdx] = {
            ...botPlayer,
            score: botPlayer.score + addedScore,
            rack: refreshedRack,
         };
      } else {
         // If no word can be formed, exchange 2 tiles if bag is not empty
         const swapCount = Math.min(2, botRack.length);
         if (swapCount > 0 && currentBag.length > 0) {
            const swappedLetters = botRack.splice(0, swapCount);
            const { rack: refreshedRack, newBag: tempBag } = await drawBalancedRack(
               currentBag,
               botRack,
               7,
               false,
            );
            currentBag = [...tempBag, ...swappedLetters];
            wordPlaced = `SWAP (${swapCount} tiles)`;
            updatedPlayers[botPlayerIdx] = {
               ...botPlayer,
               rack: refreshedRack,
            };
         }
      }

      const nextTurnIdx = (botPlayerIdx + 1) % players.length;
      const nextPlayerTurnId = updatedPlayers[nextTurnIdx].id;

      const movePayload = {
         player_id: "bot",
         word: wordPlaced,
         score: addedScore,
         breakdown: botMove?.score ? `${botMove.word} = ${botMove.score} pts` : undefined,
         tiles_placed: botMove?.placedTiles || [],
         timestamp: new Date().toISOString(),
      };

      const isCompleted =
         currentBag.length === 0 &&
         updatedPlayers.some((p) => p.rack.length === 0);

      const updatePayload: any = {
         board: updatedBoard,
         tile_bag: currentBag,
         players_data: updatedPlayers,
         p2_rack: updatedPlayers[1]?.rack || [],
         p2_score: updatedPlayers[1]?.score || 0,
         moves: [...moves, movePayload],
         current_turn_index: nextTurnIdx,
         current_turn: isUuid(nextPlayerTurnId) ? nextPlayerTurnId : null,
         last_move_at: new Date().toISOString(),
      };

      if (isCompleted) {
         updatePayload.status = "completed";
         updatePayload.completed_at = new Date().toISOString();
      }

      const { error } = await safeWordGridUpdate(matchId, updatePayload);
      if (error) {
         console.error("playBotTurn error:", error);
      }
   },
}));
