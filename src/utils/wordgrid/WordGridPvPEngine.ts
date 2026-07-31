// src/utils/wordgrid/WordGridPvPEngine.ts

import type { GridCell, PlacedTile, WordGridPlayer } from "./constants";
import { validateBoardPlacement } from "./boardValidation";
import { calculateTurnScore } from "./scoring";
import { validateWordInDictionary } from "./dictionary";
import { drawBalancedRack } from "./bagBalancing";

export interface WordGridPvPState {
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
}

export class WordGridPvPEngine {
  /**
   * Validates a player move against the board and dictionary, updating scores, rack, tile bag, and match turn state.
   */
  static async processPlayerMove(
    state: WordGridPvPState,
    userId: string,
    placedTiles: PlacedTile[],
    triggerToast: (msg: string, duration?: number, isLarge?: boolean) => void,
  ): Promise<{
    success: boolean;
    updatedState?: Partial<WordGridPvPState>;
    payloadToSave?: Record<string, any>;
  }> {
    const { matchId, board, players, currentTurn, tileBag, moves, gridSize } = state;
    if (!matchId || currentTurn !== userId) {
      return { success: false };
    }

    // 1. Placement alignment & full-grid nerve validation
    const validation = validateBoardPlacement(placedTiles, board, gridSize);
    if (!validation.isValid) {
      triggerToast(validation.error || "Invalid placement");
      return { success: false };
    }

    // 2. Dictionary check for all formed words across the grid
    const words = validation.wordsFormed || [];
    for (const w of words) {
      const isValid = await validateWordInDictionary(w.word);
      if (!isValid) {
        triggerToast(`"${w.word}" is not a valid word!`);
        return { success: false };
      }
    }

    // 3. Score turn
    const scoreResult = calculateTurnScore(words, placedTiles.length, board, gridSize);

    // 4. Update board
    const newBoard = [...board];
    placedTiles.forEach((tile) => {
      newBoard.push({
        x: tile.x,
        y: tile.y,
        letter: tile.letter,
        ownerId: userId,
      });
    });

    // 5. Rack update & draw from bag
    const activeIdx = players.findIndex((p) => p.id === userId);
    if (activeIdx === -1) return { success: false };

    const currentRack = [...players[activeIdx].rack];
    placedTiles.forEach((tile) => {
      const idx = currentRack.indexOf(tile.letter);
      if (idx !== -1) currentRack.splice(idx, 1);
    });

    const { rack: newRack, newBag } = await drawBalancedRack(
      tileBag,
      currentRack,
      7,
    );

    const updatedPlayers = [...players];
    updatedPlayers[activeIdx] = {
      ...updatedPlayers[activeIdx],
      score: updatedPlayers[activeIdx].score + scoreResult.totalScore,
      rack: newRack,
    };

    const nextTurnIndex = (state.currentTurnIndex + 1) % updatedPlayers.length;
    const nextTurnUserId = updatedPlayers[nextTurnIndex].id;

    // Check game completion condition (tile bag empty & a player used all tiles or consecutive passes)
    const isBagEmpty = newBag.length === 0;
    const isHandEmpty = newRack.length === 0;
    const newStatus = isBagEmpty && isHandEmpty ? "completed" : state.status;

    const newMove = {
      player_id: userId,
      word: words.map((w) => w.word).join(", "),
      primary_word: words[0]?.word || words.map((w) => w.word).join(", "),
      score: scoreResult.totalScore,
      breakdown: scoreResult.words.map((w) => `${w.word}: ${w.breakdown}`).join(" | ") + (scoreResult.bingoApplied ? " + 50 (Bingo)" : ""),
      created_at: new Date().toISOString(),
    };

    const newMoves = [...moves, newMove];

    const payloadToSave: Record<string, any> = {
      board: newBoard,
      tile_bag: newBag,
      players_data: updatedPlayers,
      p1_score: updatedPlayers[0]?.score || 0,
      p2_score: updatedPlayers[1]?.score || 0,
      p1_rack: updatedPlayers[0]?.rack || [],
      p2_rack: updatedPlayers[1]?.rack || [],
      current_turn_index: nextTurnIndex,
      current_turn: nextTurnUserId,
      moves: newMoves,
      status: newStatus,
    };

    return {
      success: true,
      updatedState: {
        board: newBoard,
        tileBag: newBag,
        players: updatedPlayers,
        currentTurnIndex: nextTurnIndex,
        currentTurn: nextTurnUserId,
        moves: newMoves,
        status: newStatus,
      },
      payloadToSave,
    };
  }

  /**
   * Handles tile exchange for PvP player.
   */
  static async processTileExchange(
    state: WordGridPvPState,
    userId: string,
    lettersToExchange: string[],
  ): Promise<{
    success: boolean;
    updatedState?: Partial<WordGridPvPState>;
    payloadToSave?: Record<string, any>;
  }> {
    const { matchId, players, currentTurn, tileBag, moves } = state;
    if (!matchId || currentTurn !== userId) return { success: false };

    const activeIdx = players.findIndex((p) => p.id === userId);
    if (activeIdx === -1) return { success: false };

    const currentRack = [...players[activeIdx].rack];

    // Remove selected letters
    lettersToExchange.forEach((letter) => {
      const idx = currentRack.indexOf(letter);
      if (idx !== -1) currentRack.splice(idx, 1);
    });

    // Draw replacement tiles from bag
    const pool = [...tileBag];
    const drawn: string[] = [];
    for (let i = 0; i < lettersToExchange.length; i++) {
      if (pool.length === 0) break;
      const randIdx = Math.floor(Math.random() * pool.length);
      drawn.push(pool.splice(randIdx, 1)[0]);
    }

    // Put swapped letters back into bag
    const newBag = [...pool, ...lettersToExchange];
    const newRack = [...currentRack, ...drawn];

    const updatedPlayers = [...players];
    updatedPlayers[activeIdx] = {
      ...updatedPlayers[activeIdx],
      rack: newRack,
    };

    const nextTurnIndex = (state.currentTurnIndex + 1) % updatedPlayers.length;
    const nextTurnUserId = updatedPlayers[nextTurnIndex].id;

    const newMove = {
      player_id: userId,
      word: `[Swapped ${lettersToExchange.length} tiles]`,
      score: 0,
      created_at: new Date().toISOString(),
    };

    const newMoves = [...moves, newMove];

    const payloadToSave: Record<string, any> = {
      tile_bag: newBag,
      players_data: updatedPlayers,
      p1_rack: updatedPlayers[0]?.rack || [],
      p2_rack: updatedPlayers[1]?.rack || [],
      current_turn_index: nextTurnIndex,
      current_turn: nextTurnUserId,
      moves: newMoves,
    };

    return {
      success: true,
      updatedState: {
        tileBag: newBag,
        players: updatedPlayers,
        currentTurnIndex: nextTurnIndex,
        currentTurn: nextTurnUserId,
        moves: newMoves,
      },
      payloadToSave,
    };
  }
}
