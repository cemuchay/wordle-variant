/* eslint-disable @typescript-eslint/no-explicit-any */
// src/store/useWordGridStore.ts

import { create } from "zustand";
import { supabase } from "../lib/supabaseClient";
import type { GridCell, PlacedTile } from "../utils/wordgrid/constants";
import { TILE_BAG_DISTRIBUTION } from "../utils/wordgrid/constants";
import { validateBoardPlacement } from "../utils/wordgrid/boardValidation";
import { calculateTurnScore } from "../utils/wordgrid/scoring";
import { validateWordInDictionary } from "../utils/wordgrid/dictionary";

// Helper to generate a full initial bag of tiles
export function generateInitialTileBag(): string[] {
   const bag: string[] = [];
   Object.entries(TILE_BAG_DISTRIBUTION).forEach(([letter, count]) => {
      for (let i = 0; i < count; i++) {
         bag.push(letter);
      }
   });
   // Shuffle bag
   for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
   }
   return bag;
}

export type WordGridViewType = "lobby" | "matchmaking" | "active" | "completed";

interface WordGridState {
   // Game States
   matchId: string | null;
   role: "player1" | "player2" | null;
   status: string;
   board: GridCell[];
   tileBag: string[];
   p1Rack: string[];
   p2Rack: string[];
   currentTurn: string | null;
   p1Score: number;
   p2Score: number;
   moves: any[];
   consecutivePasses: number;
   isBotMatch: boolean;
   botDifficulty: "easy" | "normal" | "hard";
   player1: any | null;
   player2: any | null;

   // Local/UI UI States
   view: WordGridViewType;
   placedTiles: PlacedTile[]; // Tiles currently placed in the current turn
   rack: string[]; // Active player's working rack (excluding placed tiles)
   loading: boolean;
   error: string | null;
   matchesList: any[];

   // Actions
   setView: (view: WordGridViewType) => void;
   resetGame: () => void;
   setMatchId: (matchId: string | null) => void;
   setRole: (role: "player1" | "player2" | null) => void;

   // Board & Rack play actions
   placeTile: (x: number, y: number, letter: string) => void;
   recallTile: (x: number, y: number) => void;
   recallAllTiles: () => void;
   shuffleRack: () => void;

   // Game turn submissions
   submitMove: (
      userId: string,
      triggerToast: (msg: string, duration?: number) => void,
   ) => Promise<boolean>;
   passTurn: (_userId: string) => Promise<void>;
   exchangeTiles: (
      _userId: string,
      lettersToExchange: string[],
   ) => Promise<void>;
   resignMatch: (_userId: string) => Promise<void>;

   // Supabase Sync & Realtime
   loadMatch: (matchId: string, currentUserId: string) => Promise<void>;
   updateFromMatchRecord: (record: any, currentUserId: string) => void;
   loadMatchesList: (userId: string) => Promise<void>;
   startQueue: (
      userId: string,
      isRated: boolean,
      triggerToast: (msg: string, duration?: number) => void,
   ) => Promise<void>;
   cancelQueue: (userId: string) => Promise<void>;
   startBotMatch: (
      userId: string,
      difficulty: "easy" | "normal" | "hard",
   ) => Promise<void>;
   startDirectChallenge: (
      userId: string,
      opponentId: string,
      triggerToast: (msg: string, duration?: number) => void,
   ) => Promise<void>;
   playBotTurn: (
      newBoard: GridCell[],
      newBag: string[],
      botRack: string[],
      botScore: number,
   ) => Promise<void>;
}

export const useWordGridStore = create<WordGridState>((set, get) => ({
   matchId: null,
   role: null,
   status: "waiting",
   board: [],
   tileBag: [],
   p1Rack: [],
   p2Rack: [],
   currentTurn: null,
   p1Score: 0,
   p2Score: 0,
   moves: [],
   consecutivePasses: 0,
   isBotMatch: false,
   botDifficulty: "normal",
   player1: null,
   player2: null,

   view: "lobby",
   placedTiles: [],
   rack: [],
   loading: false,
   error: null,
   matchesList: [],

   setView: (view) => set({ view }),

   resetGame: () =>
      set({
         matchId: null,
         role: null,
         status: "waiting",
         board: [],
         tileBag: [],
         p1Rack: [],
         p2Rack: [],
         currentTurn: null,
         p1Score: 0,
         p2Score: 0,
         moves: [],
         consecutivePasses: 0,
         isBotMatch: false,
         botDifficulty: "normal",
         player1: null,
         player2: null,
         placedTiles: [],
         rack: [],
         error: null,
         matchesList: [],
      }),

   setMatchId: (matchId) => set({ matchId }),
   setRole: (role) => set({ role }),

   placeTile: (x, y, letter) => {
      const { rack, placedTiles } = get();
      // Remove one instance of the letter from rack
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
      const recalledLetters = placedTiles.map((t) => t.letter);
      set({
         placedTiles: [],
         rack: [...rack, ...recalledLetters],
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

   loadMatch: async (matchId, currentUserId) => {
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
      const isP1 = record.player1_id === currentUserId;
      const isP2 = record.player2_id === currentUserId;
      const role = isP1 ? "player1" : isP2 ? "player2" : null;
      const activeRack = isP1 ? record.p1_rack : record.p2_rack;

      set({
         matchId: record.id,
         role,
         status: record.status,
         board: record.board || [],
         tileBag: record.tileBag || [],
         p1Rack: record.p1_rack || [],
         p2Rack: record.p2_rack || [],
         currentTurn: record.current_turn,
         p1Score: record.p1_score,
         p2Score: record.p2_score,
         moves: record.moves || [],
         consecutivePasses: record.consecutive_passes,
         isBotMatch: record.is_bot_match,
         botDifficulty: record.bot_difficulty,
         player1: record.player1,
         player2: record.player2,
         view: record.status === "completed" ? "completed" : "active",
         rack: get().placedTiles.length > 0 ? get().rack : activeRack, // Keep working rack if tiles are placed
      });
   },

   submitMove: async (userId, triggerToast) => {
      const {
         matchId,
         placedTiles,
         board,
         role,
         p1Rack,
         p2Rack,
         tileBag,
         p1Score,
         p2Score,
         moves,
      } = get();
      if (!matchId || !role) return false;

      // 1. Board placement alignment validation
      const validation = validateBoardPlacement(placedTiles, board);
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
      const currentRack = role === "player1" ? p1Rack : p2Rack;
      const scoreResult = calculateTurnScore(words, placedTiles.length, board);

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

      // Draw replacement tiles from the bag
      const newRack = [...currentRack];
      // Remove placed letters from rack
      placedTiles.forEach((tile) => {
         const idx = newRack.indexOf(tile.letter);
         if (idx !== -1) newRack.splice(idx, 1);
      });

      const newBag = [...tileBag];
      const tilesNeeded = 7 - newRack.length;
      for (let i = 0; i < tilesNeeded; i++) {
         if (newBag.length === 0) break;
         newRack.push(newBag.pop()!);
      }

      // Prepare fields for update
      const isP1 = role === "player1";

      const movePayload = {
         player_id: userId,
         word: words.map((w) => w.word).join(", "),
         score: scoreResult.totalScore,
         tiles_placed: placedTiles,
         timestamp: new Date().toISOString(),
      };

      const nextP1Rack = isP1 ? newRack : p1Rack;
      const nextP2Rack = isP1 ? p2Rack : newRack;
      const nextP1Score = isP1 ? p1Score + scoreResult.totalScore : p1Score;
      const nextP2Score = isP1 ? p2Score : p2Score + scoreResult.totalScore;
      const nextMoves = [...moves, movePayload];

      // Check game end: empty bag and one player rack empty
      const bagEmpty = newBag.length === 0;
      const rackEmpty = nextP1Rack.length === 0 || nextP2Rack.length === 0;
      const isCompleted = bagEmpty && rackEmpty;

      const updatePayload: any = {
         board: newBoard,
         tile_bag: newBag,
         p1_rack: nextP1Rack,
         p2_rack: nextP2Rack,
         p1_score: nextP1Score,
         p2_score: nextP2Score,
         moves: nextMoves,
         consecutive_passes: 0,
         current_turn: get().isBotMatch
            ? userId
            : isP1
              ? get().player2?.id
              : get().player1?.id,
         last_move_at: new Date().toISOString(),
      };

      if (isCompleted) {
         updatePayload.status = "completed";
         updatePayload.completed_at = new Date().toISOString();
      }

      try {
         const { error } = await supabase
            .from("wordgrid_matches")
            .update(updatePayload)
            .eq("id", matchId);

         if (error) throw error;
         set({ placedTiles: [], rack: newRack });
         triggerToast(`Placed word(s)! Score: +${scoreResult.totalScore}`);

         // Handle Bot Turn if applicable
         if (get().isBotMatch && !isCompleted) {
            setTimeout(
               () =>
                  get().playBotTurn(newBoard, newBag, nextP2Rack, nextP2Score),
               1500,
            );
         }

         return true;
      } catch (e: any) {
         triggerToast("Error saving move");
         console.error(e);
         return false;
      }
   },

   passTurn: async (_userId) => {
      const { matchId, consecutivePasses, role, player1, player2 } = get();
      if (!matchId || !role) return;

      const nextPassCount = consecutivePasses + 1;
      const isCompleted = nextPassCount >= 4; // 2 passes each = game over

      const updatePayload: any = {
         consecutive_passes: nextPassCount,
         current_turn: role === "player1" ? player2?.id : player1?.id,
         last_move_at: new Date().toISOString(),
      };

      if (isCompleted) {
         updatePayload.status = "completed";
         updatePayload.completed_at = new Date().toISOString();
      }

      await supabase
         .from("wordgrid_matches")
         .update(updatePayload)
         .eq("id", matchId);
      get().recallAllTiles();
   },

   exchangeTiles: async (_userId, lettersToExchange) => {
      const { matchId, role, p1Rack, p2Rack, tileBag, player1, player2 } =
         get();
      if (!matchId || !role || lettersToExchange.length === 0) return;

      const currentRack = role === "player1" ? p1Rack : p2Rack;
      const nextRack = [...currentRack];
      const nextBag = [...tileBag];

      // Remove letters to exchange
      lettersToExchange.forEach((l) => {
         const idx = nextRack.indexOf(l);
         if (idx !== -1) nextRack.splice(idx, 1);
      });

      // Draw replacements
      for (let i = 0; i < lettersToExchange.length; i++) {
         if (nextBag.length === 0) break;
         nextRack.push(nextBag.pop()!);
      }

      // Put exchanged letters back to the bag and shuffle
      nextBag.push(...lettersToExchange);
      // Reshuffle bag
      for (let i = nextBag.length - 1; i > 0; i--) {
         const j = Math.floor(Math.random() * (i + 1));
         [nextBag[i], nextBag[j]] = [nextBag[j], nextBag[i]];
      }

      const isP1 = role === "player1";
      const updatePayload = {
         tile_bag: nextBag,
         p1_rack: isP1 ? nextRack : p1Rack,
         p2_rack: isP1 ? p2Rack : nextRack,
         current_turn: isP1 ? player2?.id : player1?.id,
         consecutive_passes: 0,
         last_move_at: new Date().toISOString(),
      };

      await supabase
         .from("wordgrid_matches")
         .update(updatePayload)
         .eq("id", matchId);
      set({ rack: nextRack });
      get().recallAllTiles();
   },

   resignMatch: async (_userId) => {
      const { matchId } = get();
      if (!matchId) return;

      await supabase
         .from("wordgrid_matches")
         .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            // The other player wins - logic handled during score displaying
         })
         .eq("id", matchId);
   },

   startQueue: async (userId, isRated, triggerToast) => {
      set({ view: "matchmaking" });
      try {
         const { data, error } = await supabase.rpc("join_wordgrid_queue", {
            p_user_id: userId,
            p_is_rated: isRated,
         });

         if (error) throw error;
         const res = data as any;
         if (res.match_id) {
            set({ matchId: res.match_id, role: res.role });
            await get().loadMatch(res.match_id, userId);
         }
      } catch (e: any) {
         triggerToast("Matchmaking error. Please try again.");
         set({ view: "lobby" });
      }
   },

   cancelQueue: async (userId) => {
      await supabase.from("wordgrid_queue").delete().eq("user_id", userId);
      set({ view: "lobby" });
   },

   startBotMatch: async (userId, difficulty) => {
      set({ loading: true });
      const initialBag = generateInitialTileBag();

      // Draw 7 cards for player 1, and 7 cards for bot
      const p1Rack: string[] = [];
      const p2Rack: string[] = [];
      for (let i = 0; i < 7; i++) {
         p1Rack.push(initialBag.pop()!);
         p2Rack.push(initialBag.pop()!);
      }

      try {
         const { data, error } = await supabase
            .from("wordgrid_matches")
            .insert({
               player1_id: userId,
               player2_id: null,
               is_bot_match: true,
               bot_difficulty: difficulty,
               status: "active",
               board: [],
               tile_bag: initialBag,
               p1_rack: p1Rack,
               p2_rack: p2Rack,
               current_turn: userId,
               p1_score: 0,
               p2_score: 0,
               moves: [],
            })
            .select()
            .single();

         if (error) throw error;
         if (data) {
            set({
               matchId: data.id,
               role: "player1",
               view: "active",
               rack: p1Rack,
               board: [],
               p1Rack,
               p2Rack,
               tileBag: initialBag,
               p1Score: 0,
               p2Score: 0,
               currentTurn: userId,
               isBotMatch: true,
               botDifficulty: difficulty,
               player1: { id: userId, username: "Player (You)" },
               player2: {
                  id: "bot",
                  username: `AI (${difficulty.toUpperCase()})`,
               },
            });
         }
      } catch (e) {
         console.error(e);
      } finally {
         set({ loading: false });
      }
   },

   loadMatchesList: async (userId) => {
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

   startDirectChallenge: async (userId, opponentId, triggerToast) => {
      set({ loading: true });
      const initialBag = generateInitialTileBag();

      // Draw 7 cards for player 1, and 7 cards for opponent
      const p1Rack: string[] = [];
      const p2Rack: string[] = [];
      for (let i = 0; i < 7; i++) {
         p1Rack.push(initialBag.pop()!);
         p2Rack.push(initialBag.pop()!);
      }

      try {
         const { data, error } = await supabase
            .from("wordgrid_matches")
            .insert({
               player1_id: userId,
               player2_id: opponentId,
               is_bot_match: false,
               status: "active",
               board: [],
               tile_bag: initialBag,
               p1_rack: p1Rack,
               p2_rack: p2Rack,
               current_turn: userId,
               p1_score: 0,
               p2_score: 0,
               moves: [],
            })
            .select(
               `
          *,
          player1:player1_id(id, username, avatar_url),
          player2:player2_id(id, username, avatar_url)
        `,
            )
            .single();

         if (error) throw error;
         if (data) {
            set({
               matchId: data.id,
               role: "player1",
               view: "active",
               rack: p1Rack,
               board: [],
               p1Rack,
               p2Rack,
               tileBag: initialBag,
               p1Score: 0,
               p2Score: 0,
               currentTurn: userId,
               isBotMatch: false,
               player1: data.player1,
               player2: data.player2,
            });
            triggerToast("Challenge match created! Place your starting word.");
         }
      } catch (e) {
         console.error(e);
         triggerToast("Failed to create challenge.");
      } finally {
         set({ loading: false });
      }
   },

   // Simplistic local Bot gameplay simulator (Procedural AI player)
   playBotTurn: async (
      newBoard: GridCell[],
      newBag: string[],
      botRack: string[],
      botScore: number,
   ) => {
      // A simplified bot that passes or exchanges tiles, or places a dummy word
      // (In a full Scrabble app, the bot searches for valid anagram matches,
      // here we simulate a smart random placement at an active coordinate to keep code lightweight)
      const { matchId, moves } = get();
      if (!matchId) return;

      // Simulate simple bot thinking
      const passOrPlay = Math.random();
      let updatedBoard = [...newBoard];
      let updatedBag = [...newBag];
      let updatedRack = [...botRack];
      let addedScore = 0;
      let wordPlaced = "PASS";
      let consecutivePasses = get().consecutivePasses;

      if (passOrPlay > 0.2 && botRack.length > 0) {
         // Find an open spot. For simplicity, we search for center if board empty,
         // or check adjacent to any existing tiles.
         let placeX = 5;
         let placeY = 5;

         if (newBoard.length > 0) {
            const refCell =
               newBoard[Math.floor(Math.random() * newBoard.length)];
            const dirs = [
               [0, 1],
               [0, -1],
               [1, 0],
               [-1, 0],
            ];
            for (const [dx, dy] of dirs) {
               const tx = refCell.x + dx;
               const ty = refCell.y + dy;
               if (
                  tx >= 0 &&
                  tx < 11 &&
                  ty >= 0 &&
                  ty < 11 &&
                  !newBoard.some((c) => c.x === tx && c.y === ty)
               ) {
                  placeX = tx;
                  placeY = ty;
                  break;
               }
            }
         }

         const letter = botRack[0];
         updatedBoard.push({
            x: placeX,
            y: placeY,
            letter,
            ownerId: "bot",
         });
         // Remove from rack
         updatedRack.splice(0, 1);
         // Replenish
         if (updatedBag.length > 0) {
            updatedRack.push(updatedBag.pop()!);
         }
         addedScore = 4; // Flat simulated bot placement score
         wordPlaced = letter;
         consecutivePasses = 0;
      } else {
         consecutivePasses++;
      }

      const movePayload = {
         player_id: "bot",
         word: wordPlaced,
         score: addedScore,
         tiles_placed: [],
         timestamp: new Date().toISOString(),
      };

      const isCompleted =
         (updatedBag.length === 0 && updatedRack.length === 0) ||
         consecutivePasses >= 4;

      const updatePayload: any = {
         board: updatedBoard,
         tile_bag: updatedBag,
         p2_rack: updatedRack,
         p2_score: botScore + addedScore,
         moves: [...moves, movePayload],
         consecutive_passes: consecutivePasses,
         current_turn: get().player1?.id, // Switch back to user
         last_move_at: new Date().toISOString(),
      };

      if (isCompleted) {
         updatePayload.status = "completed";
         updatePayload.completed_at = new Date().toISOString();
      }

      await supabase
         .from("wordgrid_matches")
         .update(updatePayload)
         .eq("id", matchId);
   },
}));
