// src/utils/wordgrid/WordGridBotEngine.ts

import type { GridCell, PlacedTile, WordGridPlayer } from "./constants";
import { validateBoardPlacement } from "./boardValidation";
import { calculateTurnScore } from "./scoring";
import { validateWordInDictionary } from "./dictionary";
import { drawBalancedRack } from "./bagBalancing";
import type { BotDifficulty } from "./botAI";
import { findBotWordMove, preloadBotWordPools } from "./botAI";

export interface WordGridBotState {
  matchId: string | null;
  gridSize: number;
  status: string;
  board: GridCell[];
  tileBag: string[];
  players: WordGridPlayer[];
  currentTurnIndex: number;
  currentTurn: string | null;
  moves: any[];
  botDifficulty: BotDifficulty;
}

export class WordGridBotEngine {
  /**
   * Processes a human player move against the bot.
   */
  static async processHumanMove(
    state: WordGridBotState,
    userId: string,
    placedTiles: PlacedTile[],
    triggerToast: (msg: string, duration?: number, isLarge?: boolean) => void,
  ): Promise<{
    success: boolean;
    updatedState?: Partial<WordGridBotState>;
    botShouldPlay?: boolean;
  }> {
    const { board, players, currentTurn, tileBag, moves, gridSize } = state;
    if (currentTurn !== userId && currentTurn === "bot") {
      return { success: false };
    }

    // 1. Placement validation with full grid nerve validation
    const validation = validateBoardPlacement(placedTiles, board, gridSize);
    if (!validation.isValid) {
      triggerToast(validation.error || "Invalid placement");
      return { success: false };
    }

    // 2. Validate all formed words in dictionary
    const words = validation.wordsFormed || [];
    for (const w of words) {
      const isValid = await validateWordInDictionary(w.word);
      if (!isValid) {
        triggerToast(`"${w.word}" is not a valid word!`);
        return { success: false };
      }
    }

    // 3. Score calculation (rack size before removal drives Scrabble-style bingo)
    const humanIdx = players.findIndex((p) => p.id === userId || p.id !== "bot");
    const activeHumanIdx = humanIdx !== -1 ? humanIdx : 0;
    const rackSizeBeforeMove =
      players[activeHumanIdx]?.rack?.length ?? placedTiles.length;
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

    // 5. Update rack & draw from bag
    const currentRack = [...players[activeHumanIdx].rack];
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
    updatedPlayers[activeHumanIdx] = {
      ...updatedPlayers[activeHumanIdx],
      score: updatedPlayers[activeHumanIdx].score + scoreResult.totalScore,
      rack: newRack,
    };

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

    const isBagEmpty = newBag.length === 0;
    const isHandEmpty = newRack.length === 0;
    const isCompleted = isBagEmpty && isHandEmpty;
    const newStatus = isCompleted ? "completed" : state.status;

    return {
      success: true,
      updatedState: {
        board: newBoard,
        tileBag: newBag,
        players: updatedPlayers,
        currentTurnIndex: 1,
        currentTurn: "bot",
        moves: newMoves,
        status: newStatus,
      },
      botShouldPlay: !isCompleted,
    };
  }

  /**
   * Executes the bot turn using botAI search and updates state.
   */
  static async processBotMove(
    state: WordGridBotState,
  ): Promise<{
    updatedState: Partial<WordGridBotState>;
    lastBotMove: { word: string; score: number; placedTiles: PlacedTile[] };
  }> {
    await preloadBotWordPools();

    const { board, players, tileBag, moves, gridSize, botDifficulty } = state;
    const botIdx = players.findIndex((p) => p.id === "bot");
    const activeBotIdx = botIdx !== -1 ? botIdx : 1;
    const botPlayer = players[activeBotIdx] || { rack: [], score: 0 };

    const botMove = await findBotWordMove(
      board,
      botPlayer.rack,
      gridSize,
      botDifficulty,
    );

    const updatedBoard = [...board];
    const updatedPlayers = [...players];
    let updatedBag = [...tileBag];
    let updatedMoves = [...moves];

    if (botMove && botMove.placedTiles.length > 0) {
      botMove.placedTiles.forEach((tile) => {
        updatedBoard.push({
          x: tile.x,
          y: tile.y,
          letter: tile.letter,
          ownerId: "bot",
        });
      });

      const currentBotRack = [...botPlayer.rack];
      botMove.placedTiles.forEach((tile) => {
        const idx = currentBotRack.indexOf(tile.letter);
        if (idx !== -1) currentBotRack.splice(idx, 1);
      });

      const drawResult = await drawBalancedRack(updatedBag, currentBotRack, 7);
      updatedBag = drawResult.newBag;

      updatedPlayers[activeBotIdx] = {
        ...updatedPlayers[activeBotIdx],
        score: (updatedPlayers[activeBotIdx]?.score || 0) + botMove.score,
        rack: drawResult.rack,
      };

      updatedMoves.push({
        player_id: "bot",
        word: botMove.word,
        primary_word: botMove.word.split(",")[0].trim(),
        score: botMove.score,
        breakdown: botMove.breakdown || "",
        coords: botMove.placedTiles.map((t) => `${t.x},${t.y}`),
        created_at: new Date().toISOString(),
      });
    } else {
      // Bot passes / swaps tiles if no valid move found
      const drawResult = await drawBalancedRack(updatedBag, [], 7);
      updatedBag = drawResult.newBag;

      updatedPlayers[activeBotIdx] = {
        ...updatedPlayers[activeBotIdx],
        rack: drawResult.rack,
      };

      updatedMoves.push({
        player_id: "bot",
        word: "[Bot Swapped Tiles]",
        score: 0,
        created_at: new Date().toISOString(),
      });
    }

    const humanPlayer = players.find((p) => p.id !== "bot");
    const humanId = humanPlayer?.id || "p1";

    const isBagEmpty = updatedBag.length === 0;
    const isBotHandEmpty = (updatedPlayers[activeBotIdx]?.rack?.length ?? 0) === 0;
    
    // Check consecutive pass deadlock (> 2 consecutive passes)
    const consecutiveZeroMoves = [];
    for (let i = updatedMoves.length - 1; i >= 0; i--) {
      const m = updatedMoves[i];
      if (m.score === 0 && (m.word === 'PASSED' || m.word?.startsWith('[Bot Swapped') || m.word?.startsWith('[Swapped'))) {
        consecutiveZeroMoves.push(m);
      } else {
        break;
      }
    }
    const isDeadlock = (isBagEmpty && consecutiveZeroMoves.length >= 2) || consecutiveZeroMoves.length > 2;
    const newStatus = (isBagEmpty && isBotHandEmpty) || isDeadlock ? "completed" : state.status;

    return {
      updatedState: {
        board: updatedBoard,
        tileBag: updatedBag,
        players: updatedPlayers,
        currentTurnIndex: 0,
        currentTurn: humanId,
        moves: updatedMoves,
        status: newStatus,
      },
      lastBotMove: botMove && botMove.placedTiles.length > 0 ? {
        word: botMove.word,
        score: botMove.score,
        placedTiles: botMove.placedTiles,
      } : {
        word: "[Bot Swapped Tiles]",
        score: 0,
        placedTiles: [],
      },
    };
  }

  /**
   * Processes a human player skip against the bot.
   * No tiles are swapped or modified.
   */
  static processHumanSkip(
    state: WordGridBotState,
    userId: string,
  ): {
    success: boolean;
    updatedState?: Partial<WordGridBotState>;
    botShouldPlay?: boolean;
  } {
    const { players, currentTurn, moves } = state;
    if (currentTurn !== userId && currentTurn === "bot") {
      return { success: false };
    }

    const newMove = {
      player_id: userId,
      word: "PASSED",
      score: 0,
      created_at: new Date().toISOString(),
    };

    const newMoves = [...moves, newMove];

    // Check consecutive passes > 2
    const consecutiveZeroMoves = [];
    for (let i = newMoves.length - 1; i >= 0; i--) {
      const m = newMoves[i];
      if (m.score === 0 && (m.word === 'PASSED' || m.word?.startsWith('[Bot Swapped') || m.word?.startsWith('[Swapped'))) {
        consecutiveZeroMoves.push(m);
      } else {
        break;
      }
    }
    const isDeadlock = consecutiveZeroMoves.length > 2;
    const newStatus = isDeadlock ? "completed" : state.status;

    return {
      success: true,
      updatedState: {
        currentTurnIndex: 1,
        currentTurn: "bot",
        moves: newMoves,
        status: newStatus,
      },
      botShouldPlay: newStatus !== "completed",
    };
  }

  /**
   * Processes a human player tile exchange against the bot.
   * Swap is only available when there are tiles in the bag.
   */
  static processHumanExchange(
    state: WordGridBotState,
    userId: string,
    lettersToExchange: string[],
  ): {
    success: boolean;
    updatedState?: Partial<WordGridBotState>;
    botShouldPlay?: boolean;
  } {
    const { players, currentTurn, tileBag, moves } = state;
    if (currentTurn !== userId && currentTurn === "bot") {
      return { success: false };
    }
    if (!tileBag || tileBag.length === 0 || lettersToExchange.length === 0) {
      return { success: false };
    }

    const humanIdx = players.findIndex((p) => p.id === userId || p.id !== "bot");
    if (humanIdx === -1) return { success: false };

    const currentRack = [...players[humanIdx].rack];
    lettersToExchange.forEach((letter) => {
      const idx = currentRack.indexOf(letter);
      if (idx !== -1) currentRack.splice(idx, 1);
    });

    const pool = [...tileBag];
    const drawn: string[] = [];
    for (let i = 0; i < lettersToExchange.length; i++) {
      if (pool.length === 0) break;
      const randIdx = Math.floor(Math.random() * pool.length);
      drawn.push(pool.splice(randIdx, 1)[0]);
    }

    const newBag = [...pool, ...lettersToExchange];
    const newRack = [...currentRack, ...drawn];

    const updatedPlayers = [...players];
    updatedPlayers[humanIdx] = {
      ...updatedPlayers[humanIdx],
      rack: newRack,
    };

    const newMove = {
      player_id: userId,
      word: `[Swapped ${lettersToExchange.length} tiles]`,
      score: 0,
      created_at: new Date().toISOString(),
    };

    const newMoves = [...moves, newMove];

    const isBagEmpty = newBag.length === 0;
    const isHandEmpty = newRack.length === 0;

    const consecutiveZeroMoves = [];
    for (let i = newMoves.length - 1; i >= 0; i--) {
      const m = newMoves[i];
      if (m.score === 0 && (m.word === 'PASSED' || m.word?.startsWith('[Bot Swapped') || m.word?.startsWith('[Swapped'))) {
        consecutiveZeroMoves.push(m);
      } else {
        break;
      }
    }
    const isDeadlock = (isBagEmpty && consecutiveZeroMoves.length >= 2) || consecutiveZeroMoves.length > 2;
    const newStatus = (isBagEmpty && isHandEmpty) || isDeadlock ? "completed" : state.status;

    return {
      success: true,
      updatedState: {
        tileBag: newBag,
        players: updatedPlayers,
        currentTurnIndex: 1,
        currentTurn: "bot",
        moves: newMoves,
        status: newStatus,
      },
      botShouldPlay: newStatus !== "completed",
    };
  }
}
