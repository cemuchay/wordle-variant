/* eslint-disable @typescript-eslint/no-explicit-any */
import { loadWordLists } from '../../../data/words';
import { checkGuess, calculateSkillIndex, isHintDisabled, getHint } from '../../../lib/game-logic';

export interface MoveAnalysis {
  turn: number;
  guessWord: string;
  targetWord: string;
  poolBeforeCount: number;
  poolAfterCount: number;
  eliminatedCount: number;
  eliminationPercentage: number;
  moveRating: number; // 0.0 - 10.0
  classification:
    | '!! Brilliant'
    | '! Great'
    | '✓ Good'
    | '?! Suboptimal'
    | '? Mistake'
    | '?? Blunder'
    | '🍀 Lucky'
    | '🎯 Solved';
  classificationColor: string;
  agreementScore: number; // 0 - 100%
  luckBonus: number; // 0.0 - 3.0
  isHintRow?: boolean;
  hintAnalysisNotice?: string;
  botRecommendation: {
    word: string;
    reason: string;
    expectedPoolReduction?: string;
  };
  scrutinyReason: string;
}

export interface BotSimulationResult {
  guesses: any[][];
  attempts: number;
  won: boolean;
  usedHint: boolean;
  hintRecord: { index: number; letter: string; row: number } | null;
  skillScore: number;
  botLineWords: string[];
}

export interface GameAnalysisResult {
  accuracyScore: number; // 0 - 100%
  gradeTitle: string;
  moves: MoveAnalysis[];
  moveCounts: {
    brilliant: number;
    great: number;
    good: number;
    suboptimal: number;
    mistake: number;
    blunder: number;
    lucky: number;
    solved: number;
  };
  initialPoolSize: number;
  targetWord: string;
  isWin: boolean;
  hintsUsed: boolean;
  hintPenalty: number;
  hintQuality?: 'strategic' | 'tactical' | 'unnecessary' | 'wasteful';
  hintSummaryText?: string;
  // Bot vs User Match Comparison
  userSkillScore: number;
  botSkillScore: number;
  botSimulation: BotSimulationResult;
  matchOutcome: {
    winner: 'user' | 'bot' | 'tie';
    scoreDiff: number;
    text: string;
  };
}

export interface AnalysisOptions {
  hintsUsed?: boolean;
  hintRecord?: any;
}

/**
 * Validates whether candidate word satisfies guess feedback constraints.
 */
export function isCandidateValid(
  candidate: string,
  guessWord: string,
  statuses: ('correct' | 'present' | 'absent')[]
): boolean {
  const L = candidate.length;
  if (candidate.length !== L || guessWord.length !== L) return false;

  // Positional checks
  for (let i = 0; i < L; i++) {
    if (statuses[i] === 'correct' && candidate[i] !== guessWord[i]) return false;
    if (statuses[i] === 'present' && candidate[i] === guessWord[i]) return false;
  }

  // Letter count requirements
  const charCounts: Record<string, { required: number; exact: boolean }> = {};
  for (let i = 0; i < L; i++) {
    const char = guessWord[i];
    if (!charCounts[char]) {
      charCounts[char] = { required: 0, exact: false };
    }
    if (statuses[i] === 'correct' || statuses[i] === 'present') {
      charCounts[char].required += 1;
    } else if (statuses[i] === 'absent') {
      charCounts[char].exact = true;
    }
  }

  for (const [char, req] of Object.entries(charCounts)) {
    let countInCand = 0;
    for (let i = 0; i < L; i++) {
      if (candidate[i] === char) countInCand++;
    }
    if (countInCand < req.required) return false;
    if (req.exact && countInCand !== req.required) return false;
  }

  return true;
}

/**
 * Selects an intelligent, high-entropy starter word for any given word length.
 */
function findBestEntropyStarter(
  candidatePool: string[],
  wordLength: number
): string {
  const curatedStarters: Record<number, string[]> = {
    3: ['TEA', 'OAT', 'ERA', 'TAN', 'RAT', 'SEA', 'RED'],
    4: ['SOAR', 'ROSE', 'LATE', 'TORE', 'TARE', 'EAST', 'BEAR', 'WIND', 'RANT'],
    5: ['CRANE', 'STARE', 'SLATE', 'TRACE', 'ROAST', 'AUDIO', 'ADIEU', 'RAISE'],
    6: ['PLANET', 'COARSE', 'SENIOR', 'STREAM', 'CASTLE', 'STRIPE'],
    7: ['STARING', 'OUTDATE', 'COARSER', 'PAINTER'],
    8: ['STARLING', 'REASTING', 'RELATION'],
  };

  const curated = curatedStarters[wordLength];
  if (curated) {
    const validInPool = curated.filter((w) => candidatePool.includes(w));
    if (validInPool.length > 0) return validInPool[0];
  }

  const vowels = new Set(['A', 'E', 'I', 'O', 'U']);
  const commonConsonants = new Set(['R', 'S', 'T', 'L', 'N']);

  let bestWord = candidatePool[0] || 'CRANE';
  let bestScore = -1;

  for (const w of candidatePool) {
    const uniqueChars = new Set(w.split(''));
    let score = uniqueChars.size * 3;
    uniqueChars.forEach((ch) => {
      if (vowels.has(ch)) score += 2;
      if (commonConsonants.has(ch)) score += 1.5;
    });
    if (score > bestScore) {
      bestScore = score;
      bestWord = w;
    }
  }

  return bestWord;
}

/**
 * Simulates a full bot game starting with the USER'S starter word.
 * The bot plays blind without knowing the answer and can use hints (-100 pts penalty) if stuck.
 */
export async function simulateBotGame(
  userStarterWord: string,
  targetWord: string
): Promise<BotSimulationResult> {
  const uppercaseTarget = targetWord.trim().toUpperCase();
  const wordLength = uppercaseTarget.length || 5;

  let officialWords: string[] = [];
  let allowedWords: string[] = [];

  try {
    const data = await loadWordLists(wordLength, false);
    officialWords = data.official.map((w) => w.toUpperCase());
    allowedWords = Array.from(data.valid).map((w) => w.toUpperCase());
  } catch (e) {
    console.error('Failed to load wordlists for bot simulation:', e);
  }

  let currentPool = officialWords.includes(uppercaseTarget)
    ? [...officialWords]
    : [...allowedWords];

  if (currentPool.length === 0) {
    currentPool = [uppercaseTarget];
  }

  const botGuesses: any[][] = [];
  const botLineWords: string[] = [];
  let usedHint = false;
  let hintRecord: { index: number; letter: string; row: number } | null = null;

  // Turn 1: Bot MUST play the User's starter word
  const starter = userStarterWord.trim().toUpperCase();
  botLineWords.push(starter);
  const turn1Feedback = checkGuess(starter, uppercaseTarget);
  botGuesses.push(turn1Feedback);

  if (starter === uppercaseTarget) {
    const scoreRes = calculateSkillIndex({
      attempts: 1,
      maxAttempts: 6,
      usedHint: false,
      guesses: botGuesses,
    });
    return {
      guesses: botGuesses,
      attempts: 1,
      won: true,
      usedHint: false,
      hintRecord: null,
      skillScore: scoreRes.finalScore,
      botLineWords,
    };
  }

  const statuses1 = turn1Feedback.map((c) => c.status);
  currentPool = currentPool.filter((w) => isCandidateValid(w, starter, statuses1));

  // Turns 2 to 6
  for (let turn = 1; turn < 6; turn++) {
    const poolBefore = [...currentPool];
    if (poolBefore.length === 0) break;

    // Strategic Bot Hint logic:
    // If bot has >= 4 candidates remaining on turn >= 2 and hint is not disabled, bot can take a hint!
    // Using a hint applies the official -100 pts penalty (SCORING.HINT_PENALTY).
    if (!usedHint && turn >= 2 && poolBefore.length >= 4 && !isHintDisabled(uppercaseTarget, botGuesses)) {
      const hintData = getHint(uppercaseTarget, botGuesses);
      if (hintData) {
        usedHint = true;
        hintRecord = { index: hintData.index, letter: hintData.letter, row: turn + 1 };
      }
    }

    let nextGuess = uppercaseTarget;

    if (poolBefore.length === 1) {
      nextGuess = poolBefore[0];
    } else if (poolBefore.length <= 35) {
      const charCountsInPool = new Map<string, number>();
      poolBefore.forEach((w) => {
        new Set(w.split('')).forEach((c) => {
          charCountsInPool.set(c, (charCountsInPool.get(c) || 0) + 1);
        });
      });

      const distinguishingChars = Array.from(charCountsInPool.entries())
        .filter(([, count]) => count > 0 && count < poolBefore.length)
        .map(([char]) => char);

      let bestTestWord = poolBefore[0];
      let maxScore = -1;

      const candidateList = poolBefore.length <= 8
        ? poolBefore
        : allowedWords.length > 0
        ? allowedWords
        : poolBefore;

      for (const w of candidateList) {
        const uniqueChars = new Set(w.split(''));
        let distinguishingTested = 0;
        distinguishingChars.forEach((ch) => {
          if (uniqueChars.has(ch)) distinguishingTested++;
        });

        if (distinguishingTested === 0 && poolBefore.length > 1) continue;

        const isCandidate = poolBefore.includes(w);
        const score = distinguishingTested * 10 + (isCandidate ? 15 : 0) + uniqueChars.size * 0.5;

        if (score > maxScore) {
          maxScore = score;
          bestTestWord = w;
        }
      }
      nextGuess = bestTestWord;
    } else {
      nextGuess = findBestEntropyStarter(poolBefore, wordLength);
    }

    botLineWords.push(nextGuess);
    const feedback = checkGuess(nextGuess, uppercaseTarget);
    botGuesses.push(feedback);

    const statuses = feedback.map((c) => c.status);
    currentPool = currentPool.filter((w) => isCandidateValid(w, nextGuess, statuses));

    if (nextGuess === uppercaseTarget) {
      break;
    }
  }

  const botWon = botGuesses[botGuesses.length - 1]?.every((c: any) => c.status === 'correct');

  const scoreResult = calculateSkillIndex({
    attempts: botGuesses.length,
    maxAttempts: 6,
    usedHint,
    guesses: botGuesses,
    hintRecord,
  });

  return {
    guesses: botGuesses,
    attempts: botGuesses.length,
    won: botWon,
    usedHint,
    hintRecord,
    skillScore: scoreResult.finalScore,
    botLineWords,
  };
}

/**
 * Main game analysis entry point.
 */
export async function analyzeGame(
  guesses: any[],
  targetWord: string,
  options: AnalysisOptions = {}
): Promise<GameAnalysisResult> {
  const uppercaseTarget = targetWord.trim().toUpperCase();
  const wordLength = uppercaseTarget.length || 5;
  const hintsUsed = !!options.hintsUsed || options.hintRecord !== null && options.hintRecord !== undefined;
  const rawHintRow = options.hintRecord?.row !== undefined ? options.hintRecord.row : -1;

  let officialWords: string[] = [];
  let allowedWords: string[] = [];

  try {
    const data = await loadWordLists(wordLength, false);
    officialWords = data.official.map((w) => w.toUpperCase());
    allowedWords = Array.from(data.valid).map((w) => w.toUpperCase());
  } catch (e) {
    console.error('Failed to load wordlists for game analysis:', e);
  }

  let currentPool = officialWords.includes(uppercaseTarget)
    ? [...officialWords]
    : [...allowedWords];

  if (currentPool.length === 0) {
    currentPool = [uppercaseTarget];
  }

  const initialPoolSize = currentPool.length;
  const moves: MoveAnalysis[] = [];

  const moveCounts = {
    brilliant: 0,
    great: 0,
    good: 0,
    suboptimal: 0,
    mistake: 0,
    blunder: 0,
    lucky: 0,
    solved: 0,
  };

  let totalRatingSum = 0;
  let isWin = false;
  const totalTurns = guesses.length;
  const targetTurnIndex = rawHintRow >= 0 ? rawHintRow : totalTurns - 1;

  let poolAtHintTurn = 0;

  for (let turn = 0; turn < totalTurns; turn++) {
    const row = guesses[turn];
    if (!Array.isArray(row) || row.length === 0) continue;

    const guessWord = row.map((cell: any) => cell.letter || '').join('').toUpperCase();
    const statuses: ('correct' | 'present' | 'absent')[] = row.map((cell: any) => cell.status || 'absent');

    const poolBefore = [...currentPool];
    const poolBeforeCount = poolBefore.length;

    if (turn === targetTurnIndex) {
      poolAtHintTurn = poolBeforeCount;
    }

    const poolAfter = poolBefore.filter((cand) =>
      isCandidateValid(cand, guessWord, statuses)
    );
    currentPool = poolAfter;
    const poolAfterCount = currentPool.length;

    const eliminatedCount = Math.max(0, poolBeforeCount - poolAfterCount);
    const eliminationPercentage =
      poolBeforeCount > 0 ? (eliminatedCount / poolBeforeCount) * 100 : 100;

    const isSolved = guessWord === uppercaseTarget;
    if (isSolved) isWin = true;

    // Calculate Luck Bonus
    let luckBonus = 0;
    if (isSolved && poolBeforeCount > 1) {
      const prob = 1 / poolBeforeCount;
      luckBonus = Math.min(2.5, Number(((1 - prob) * 2.5).toFixed(1)));
    } else if (poolBeforeCount >= 12 && poolAfterCount <= 2 && !isSolved) {
      luckBonus = 1.0;
    }

    // Bot Recommendation logic
    let botWord = uppercaseTarget;
    let botReason = '';
    let expectedPoolReduction = '';

    if (poolBeforeCount === 1) {
      botWord = poolBefore[0];
      botReason = 'Only 1 candidate word remains. Direct solve is optimal.';
      expectedPoolReduction = '100%';
    } else if (turn === 0) {
      botWord = findBestEntropyStarter(poolBefore, wordLength);
      botReason = 'High entropy starter testing common vowels and high-frequency consonants.';
      expectedPoolReduction = '85%+';
    } else if (poolBeforeCount <= 35) {
      const charCountsInPool = new Map<string, number>();
      poolBefore.forEach((w) => {
        new Set(w.split('')).forEach((c) => {
          charCountsInPool.set(c, (charCountsInPool.get(c) || 0) + 1);
        });
      });

      const distinguishingChars = Array.from(charCountsInPool.entries())
        .filter(([, count]) => count > 0 && count < poolBeforeCount)
        .map(([char]) => char);

      let bestTestWord = poolBefore[0];
      let maxScore = -1;

      const candidateList = poolBeforeCount <= 8
        ? poolBefore
        : allowedWords.length > 0
        ? allowedWords
        : poolBefore;

      for (const w of candidateList) {
        const uniqueChars = new Set(w.split(''));
        let distinguishingTested = 0;
        distinguishingChars.forEach((ch) => {
          if (uniqueChars.has(ch)) distinguishingTested++;
        });

        if (distinguishingTested === 0 && poolBeforeCount > 1) continue;

        const isCandidate = poolBefore.includes(w);
        const score = distinguishingTested * 10 + (isCandidate ? 15 : 0) + uniqueChars.size * 0.5;

        if (score > maxScore) {
          maxScore = score;
          bestTestWord = w;
        }
      }

      botWord = bestTestWord;
      const testedList = Array.from(new Set(bestTestWord.split(''))).filter((c) =>
        distinguishingChars.includes(c)
      );
      const testedStr =
        testedList.length > 0 ? testedList.join(', ') : distinguishingChars.slice(0, 4).join(', ');

      if (poolBefore.includes(bestTestWord)) {
        botReason = `Candidate answer testing key letter(s) (${testedStr}) from remaining ${poolBeforeCount} possibilities.`;
      } else {
        botReason = `Optimal move testing key distinguishing letters (${testedStr}) across ${poolBeforeCount} candidates.`;
      }
      expectedPoolReduction = `${Math.min(99, Math.round(((poolBeforeCount - 1) / poolBeforeCount) * 100))}%`;
    } else {
      botWord = findBestEntropyStarter(poolBefore, wordLength);
      botReason = 'Strategic word maximizing unique letter discovery across remaining pool.';
      expectedPoolReduction = '75%+';
    }

    // Tough Move Rating calculation (0.0 to 10.0)
    let moveRating = 7.0;

    let repeatedGrayLetter = false;
    if (turn > 0) {
      const knownAbsent = new Set<string>();
      for (let prevT = 0; prevT < turn; prevT++) {
        const prevRow = guesses[prevT];
        if (Array.isArray(prevRow)) {
          prevRow.forEach((cell: any) => {
            if (cell.status === 'absent') {
              const char = (cell.letter || '').toUpperCase();
              const usedPresentOrCorrect = guesses.some((r: any) =>
                r.some((c: any) => (c.letter || '').toUpperCase() === char && c.status !== 'absent')
              );
              if (!usedPresentOrCorrect) knownAbsent.add(char);
            }
          });
        }
      }
      for (const ch of guessWord) {
        if (knownAbsent.has(ch)) {
          repeatedGrayLetter = true;
          break;
        }
      }
    }

    if (isSolved) {
      if (turn === 0) moveRating = 10.0;
      else if (turn <= 2) moveRating = 9.8;
      else if (turn === 3) moveRating = 9.0;
      else if (turn === 4) moveRating = 7.8;
      else moveRating = 6.2;
    } else if (guessWord === botWord) {
      moveRating = 9.5;
    } else {
      const elimRatio = poolBeforeCount > 0 ? (poolBeforeCount - poolAfterCount) / poolBeforeCount : 1;
      moveRating = Number((3.5 + elimRatio * 4.5).toFixed(1));

      if (repeatedGrayLetter) {
        moveRating = Math.max(1.0, moveRating - 3.5);
      }
    }

    const isThisHintRow = hintsUsed && turn === targetTurnIndex;
    const agreementScore = Math.max(10, Math.min(99, Math.round(moveRating * 9.5)));

    // Strict Move Classification
    let classification: MoveAnalysis['classification'] = '✓ Good';
    let classificationColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';

    if (isSolved) {
      classification = '🎯 Solved';
      classificationColor = 'text-emerald-300 bg-emerald-500/20 border-emerald-500/40';
      moveCounts.solved++;
    } else if (luckBonus >= 1.5) {
      classification = '🍀 Lucky';
      classificationColor = 'text-amber-300 bg-amber-500/20 border-amber-500/40';
      moveCounts.lucky++;
    } else if (moveRating >= 9.2) {
      classification = '!! Brilliant';
      classificationColor = 'text-cyan-300 bg-cyan-500/20 border-cyan-500/40';
      moveCounts.brilliant++;
    } else if (moveRating >= 8.0) {
      classification = '! Great';
      classificationColor = 'text-blue-300 bg-blue-500/20 border-blue-500/40';
      moveCounts.great++;
    } else if (moveRating >= 6.5) {
      classification = '✓ Good';
      classificationColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      moveCounts.good++;
    } else if (moveRating >= 4.5) {
      classification = '?! Suboptimal';
      classificationColor = 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      moveCounts.suboptimal++;
    } else if (moveRating >= 2.5) {
      classification = '? Mistake';
      classificationColor = 'text-orange-400 bg-orange-500/10 border-orange-500/30';
      moveCounts.mistake++;
    } else {
      classification = '?? Blunder';
      classificationColor = 'text-rose-400 bg-rose-500/20 border-rose-500/40';
      moveCounts.blunder++;
    }

    // Scrutiny text
    let scrutinyReason = '';
    if (isSolved) {
      if (turn >= 5) {
        scrutinyReason = `🎯 Solved on final attempt (${turn + 1}/6). Scraping by on the last try.`;
      } else if (luckBonus > 0) {
        scrutinyReason = `🎯 Target word solved! Lucky hit with ${poolBeforeCount} remaining candidate words.`;
      } else {
        scrutinyReason = `🎯 Target word solved cleanly with precision.`;
      }
    } else if (isThisHintRow) {
      scrutinyReason = `💡 Hint used on this turn: penalizes strategic evaluation (-2.0 pts).`;
    } else if (repeatedGrayLetter) {
      scrutinyReason = `⚠️ Suboptimal move: includes letter(s) already confirmed gray in previous turns.`;
    } else if (poolAfterCount === 1) {
      scrutinyReason = `Narrowed candidate pool down to 1 single word (${currentPool[0]}).`;
    } else if (eliminationPercentage >= 90) {
      scrutinyReason = `Highly effective guess! Eliminated ${eliminatedCount} candidates (${eliminationPercentage.toFixed(1)}% of remaining pool).`;
    } else if (eliminationPercentage >= 50) {
      scrutinyReason = `Solid guess: narrowed remaining pool from ${poolBeforeCount} down to ${poolAfterCount}.`;
    } else {
      scrutinyReason = `Limited impact: only eliminated ${eliminatedCount} candidate words (${eliminationPercentage.toFixed(1)}%).`;
    }

    moves.push({
      turn: turn + 1,
      guessWord,
      targetWord: uppercaseTarget,
      poolBeforeCount,
      poolAfterCount,
      eliminatedCount,
      eliminationPercentage: Number(eliminationPercentage.toFixed(1)),
      moveRating,
      classification,
      classificationColor,
      agreementScore,
      luckBonus,
      isHintRow: isThisHintRow,
      botRecommendation: {
        word: botWord,
        reason: botReason,
        expectedPoolReduction,
      },
      scrutinyReason,
    });

    totalRatingSum += moveRating;
  }

  // --- Strategic Hint Evaluation ---
  let hintQuality: GameAnalysisResult['hintQuality'];
  let hintPenalty = 0;
  let hintSummaryText = '';

  if (hintsUsed) {
    const turnsRemainingAfterHint = isWin ? totalTurns - (targetTurnIndex + 1) : 99;

    if (poolAtHintTurn >= 5 && isWin && turnsRemainingAfterHint <= 1) {
      hintQuality = 'strategic';
      hintPenalty = 0;
      hintSummaryText = `💡 Strategic Hint Breakthrough: Used hint to break a ${poolAtHintTurn}-candidate bottleneck & solved immediately!`;
    } else if (poolAtHintTurn >= 3 && isWin && turnsRemainingAfterHint <= 2) {
      hintQuality = 'tactical';
      hintPenalty = 4;
      hintSummaryText = `💡 Tactical Hint: Helpful discovery assisting a quick solve within ${turnsRemainingAfterHint + 1} turn(s).`;
    } else if (poolAtHintTurn <= 2) {
      hintQuality = 'unnecessary';
      hintPenalty = 12;
      hintSummaryText = `⚠️ Unnecessary Hint: Used hint when only ${poolAtHintTurn} candidate(s) remained.`;
    } else {
      hintQuality = 'wasteful';
      hintPenalty = 15;
      hintSummaryText = `⚠️ Suboptimal Hint: Hint was taken but did not lead to a swift solve.`;
    }

    if (moves[targetTurnIndex]) {
      moves[targetTurnIndex].hintAnalysisNotice = hintSummaryText;
      if (hintQuality === 'unnecessary' || hintQuality === 'wasteful') {
        moves[targetTurnIndex].moveRating = Math.max(1.0, moves[targetTurnIndex].moveRating - 2.0);
      } else if (hintQuality === 'strategic') {
        moves[targetTurnIndex].moveRating = Math.min(10.0, moves[targetTurnIndex].moveRating + 0.5);
      }
    }
  }

  // Overall Efficiency Score Calculation
  const avgMoveRating = moves.length > 0 ? totalRatingSum / moves.length : 0;
  let rawScore = avgMoveRating * 10;

  const attemptCaps: Record<number, number> = {
    1: 100,
    2: 95,
    3: 88,
    4: 76,
    5: 60,
    6: 48,
  };

  const cap = isWin ? attemptCaps[totalTurns] || 48 : 20;
  let accuracyScore = Math.min(cap, Math.round(rawScore * (cap / 100)));

  if (hintsUsed) {
    accuracyScore = Math.max(10, accuracyScore - hintPenalty);
  }

  // Strategic Grade Titles
  let gradeTitle = 'Tactician';
  if (accuracyScore >= 95) gradeTitle = 'Grandmaster Strategy 👑';
  else if (accuracyScore >= 85) gradeTitle = 'Master Tactician 🧠';
  else if (accuracyScore >= 72) gradeTitle = 'Calculated Strategist ⚡';
  else if (accuracyScore >= 58) gradeTitle = 'Average Play 🛡️';
  else if (accuracyScore >= 42) gradeTitle = 'Scraped By ⚠️';
  else if (isWin) gradeTitle = 'Lucky Escape 🎲';
  else gradeTitle = 'Defeated 💥';

  // --- BOT SIMULATION & SKILL INDEX MATCH COMPARISON ---
  const userStarterWord = moves[0]?.guessWord || 'CRANE';
  const botSimulation = await simulateBotGame(userStarterWord, uppercaseTarget);

  const userSkillResult = calculateSkillIndex({
    attempts: totalTurns,
    maxAttempts: 6,
    usedHint: hintsUsed,
    guesses,
    hintRecord: options.hintRecord,
  });
  const userSkillScore = userSkillResult.finalScore;
  const botSkillScore = botSimulation.skillScore;

  let matchWinner: 'user' | 'bot' | 'tie' = 'tie';
  let scoreDiff = Math.abs(userSkillScore - botSkillScore);
  let outcomeText = `🤝 Tied Match (${userSkillScore} pts)`;

  if (userSkillScore > botSkillScore) {
    matchWinner = 'user';
    outcomeText = `🎉 You Beat the Bot! (+${scoreDiff} pts)`;
  } else if (botSkillScore > userSkillScore) {
    matchWinner = 'bot';
    outcomeText = `🤖 Bot Outplayed You (+${scoreDiff} pts)`;
  }

  return {
    accuracyScore,
    gradeTitle,
    moves,
    moveCounts,
    initialPoolSize,
    targetWord: uppercaseTarget,
    isWin,
    hintsUsed,
    hintPenalty,
    hintQuality,
    hintSummaryText,
    userSkillScore,
    botSkillScore,
    botSimulation,
    matchOutcome: {
      winner: matchWinner,
      scoreDiff,
      text: outcomeText,
    },
  };
}
