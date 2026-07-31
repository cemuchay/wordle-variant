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

    // 3. Score calculation
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

    // 5. Update rack & draw from bag
    const humanIdx = players.findIndex((p) => p.id === userId || p.id !== "bot");
    const activeHumanIdx = humanIdx !== -1 ? humanIdx : 0;

    const currentRack = [...players[activeHumanIdx].rack];
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
    updatedPlayers[activeHumanIdx] = {
      ...updatedPlayers[activeHumanIdx],
      score: updatedPlayers[activeHumanIdx].score + scoreResult.totalScore,
      rack: newRack,
    };

    const newMove = {
      player_id: userId,
      word: words.map((w) => w.word).join(", "),
      score: scoreResult.totalScore,
      created_at: new Date().toISOString(),
    };

    const newMoves = [...moves, newMove];

    return {
      success: true,
      updatedState: {
        board: newBoard,
        tileBag: newBag,
        players: updatedPlayers,
        currentTurnIndex: 1,
        currentTurn: "bot",
        moves: newMoves,
      },
      botShouldPlay: true,
    };
  }

  /**
   * Executes the bot turn using botAI search and updates state.
   */
  static async processBotMove(
    state: WordGridBotState,
  ): Promise<{
    updatedState: Partial<WordGridBotState>;
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
        score: botMove.score,
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

    return {
      updatedState: {
        board: updatedBoard,
        tileBag: updatedBag,
        players: updatedPlayers,
        currentTurnIndex: 0,
        currentTurn: humanId,
        moves: updatedMoves,
      },
    };
  }
}
