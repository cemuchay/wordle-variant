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

    // 3. Score turn (rack size before removal drives Scrabble-style bingo)
    const activeIdx = players.findIndex((p) => p.id === userId);
    if (activeIdx === -1) return { success: false };
    const rackSizeBeforeMove = players[activeIdx]?.rack?.length ?? placedTiles.length;
    const scoreResult = calculateTurnScore(words, rackSizeBeforeMove, board, gridSize);

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
    const currentRack = [...players[activeIdx].rack];
    placedTiles.forEach((tile) => {
      // Assigned blanks are stored in placedTiles as lowercase letters; in rack they are '_'
      const rackLetter = /[a-z]/.test(tile.letter) ? '_' : tile.letter;
      const idx = currentRack.indexOf(rackLetter);
      if (idx !== -1) {
        currentRack.splice(idx, 1);
      } else {
        // Fallback in case of exact match
        const exactIdx = currentRack.indexOf(tile.letter);
        if (exactIdx !== -1) currentRack.splice(exactIdx, 1);
      }
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
      coords: placedTiles.map((t) => `${t.x},${t.y}`),
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
   * Swap is only available when there are tiles in the bag.
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
    if (!tileBag || tileBag.length === 0 || lettersToExchange.length === 0) {
      return { success: false };
    }

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

    // Check game completion condition:
    // 1. Tile bag is empty and hand is empty
    // 2. OR all active players skip/swap consecutively (> 2 consecutive skips/passes across both players)
    const isBagEmpty = newBag.length === 0;
    const isHandEmpty = newRack.length === 0;
    const consecutivePassLimit = Math.max(3, updatedPlayers.length * 2);
    const lastConsecutiveZeroMoves = newMoves.slice(-consecutivePassLimit);
    const isDeadlock = (isBagEmpty && lastConsecutiveZeroMoves.length >= consecutivePassLimit && lastConsecutiveZeroMoves.every((m) => m.score === 0))
      || (lastConsecutiveZeroMoves.length >= consecutivePassLimit && lastConsecutiveZeroMoves.every((m) => m.score === 0 && (m.word === 'PASSED' || m.word?.startsWith('[Swapped'))));
    const newStatus = (isBagEmpty && isHandEmpty) || isDeadlock ? "completed" : state.status;

    const payloadToSave: Record<string, any> = {
      tile_bag: newBag,
      players_data: updatedPlayers,
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
   * Handles skipping a turn for PvP player.
   * No tiles are swapped or modified.
   * If consecutive passes exceed threshold (> 2 consecutive passes in game), game ends.
   */
  static processSkipTurn(
    state: WordGridPvPState,
    userId: string,
  ): {
    success: boolean;
    updatedState?: Partial<WordGridPvPState>;
    payloadToSave?: Record<string, any>;
  } {
    const { matchId, players, currentTurn, moves } = state;
    if (!matchId || currentTurn !== userId) return { success: false };

    const activeIdx = players.findIndex((p) => p.id === userId);
    if (activeIdx === -1) return { success: false };

    const nextTurnIndex = (state.currentTurnIndex + 1) % players.length;
    const nextTurnUserId = players[nextTurnIndex].id;

    const newMove = {
      player_id: userId,
      word: "PASSED",
      score: 0,
      created_at: new Date().toISOString(),
    };

    const newMoves = [...moves, newMove];

    // Scrabble end rule: when more than 2 consecutive passes occur (e.g. 3 or more scoreless passes), game ends.
    // Specifically, if last consecutive passes > 2 (i.e. >= 3 consecutive passes) or each player passed consecutively (2 rounds = 4 passes).
    const consecutiveZeroMoves = [];
    for (let i = newMoves.length - 1; i >= 0; i--) {
      const m = newMoves[i];
      if (m.score === 0 && (m.word === 'PASSED' || m.word?.startsWith('[Swapped'))) {
        consecutiveZeroMoves.push(m);
      } else {
        break;
      }
    }

    const isConsecutivePassDeadlock = consecutiveZeroMoves.length > 2;
    const newStatus = isConsecutivePassDeadlock ? "completed" : state.status;

    const payloadToSave: Record<string, any> = {
      current_turn_index: nextTurnIndex,
      current_turn: nextTurnUserId,
      moves: newMoves,
      status: newStatus,
    };

    return {
      success: true,
      updatedState: {
        currentTurnIndex: nextTurnIndex,
        currentTurn: nextTurnUserId,
        moves: newMoves,
        status: newStatus,
      },
      payloadToSave,
    };
  }
}
