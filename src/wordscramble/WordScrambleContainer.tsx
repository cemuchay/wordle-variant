import React, { useReducer, useEffect, useCallback, useMemo, useState, useRef } from 'react';
import { scrambleReducer, initialScrambleState } from './engine/ScrambleEngine';
import type { ScrambleConfig, ScrambleTile } from './engine/types';
import { LocalStorageScrambleRepository } from './storage/ScrambleRepository';
import { loadWordLists } from '../data/words';
import { ScrambleLobby } from './components/ScrambleLobby';
import { ScrambleHeader } from './components/ScrambleHeader';
import { ScrambleBoard } from './components/ScrambleBoard';
import { SubmissionTray } from './components/SubmissionTray';
import { FoundWordsList } from './components/FoundWordsList';
import { ScrambleSummaryModal } from './components/ScrambleSummaryModal';
import { ScrambleWordSplash, type ScrambleWordSplashData } from './components/ScrambleWordSplash';
import { ScrambleTutorialModal } from './components/ScrambleTutorialModal';
import { safeLocalStorage } from '../utils/storage';
import { useApp } from '../context/AppContext';
import { TOAST_DURATION } from '../constants/ui';
import { ArrowLeft, RefreshCw, HelpCircle } from 'lucide-react';

interface WordScrambleContainerProps {
  onBackToMenu?: () => void;
}

const TUTORIAL_STORAGE_KEY = 'wordscramble_tutorial_completed';

export const WordScrambleContainer: React.FC<WordScrambleContainerProps> = ({
  onBackToMenu,
}) => {
  const { triggerToast } = useApp();
  const [state, dispatch] = useReducer(scrambleReducer, initialScrambleState);
  const [view, setView] = useState<'lobby' | 'game'>('lobby');
  const [validDictionary, setValidDictionary] = useState<Set<string>>(new Set());
  const [wordListMap, setWordListMap] = useState<Record<number, string[]>>({});
  const [showInGameTutorial, setShowInGameTutorial] = useState<boolean>(false);

  // Splash animation state when a correct word is accepted
  const [splashData, setSplashData] = useState<ScrambleWordSplashData | null>(null);
  const prevFoundWordsLengthRef = useRef(0);

  const repository = useMemo(() => new LocalStorageScrambleRepository(), []);

  // Preload and build active dictionary whenever target lengths change with thorough error handling
  const prepareDictionaries = useCallback(async (lengths: number[]): Promise<{
    wordListMap: Record<number, string[]>;
    validDictionary: Set<string>;
  }> => {
    const newWordListMap: Record<number, string[]> = {};
    const combinedValid = new Set<string>();

    try {
      await Promise.all(
        lengths.map(async (len) => {
          try {
            const cache = await loadWordLists(len, false);
            if (cache && cache.official && cache.official.length > 0) {
              newWordListMap[len] = cache.official;
              cache.valid.forEach((w) => combinedValid.add(w));
            } else {
              throw new Error(`Empty word list for length ${len}`);
            }
          } catch (err) {
            console.warn(`Fallback word loader for length ${len}:`, err);
            // Fallback default starter words if network/cache failed
            const fallbackMap: Record<number, string[]> = {
              3: ['CAT', 'DOG', 'SUN', 'BAT', 'HAT', 'RUN', 'TOP', 'PEN', 'CUP', 'BOX'],
              4: ['BIRD', 'STAR', 'MOON', 'FISH', 'LION', 'TREE', 'BOOK', 'WIND', 'GOLD', 'FIRE'],
              5: ['APPLE', 'CRANE', 'GRAPE', 'PLANT', 'TRAIN', 'HOUSE', 'LIGHT', 'WATER', 'STONE', 'BREAD'],
              6: ['PLANET', 'SILVER', 'SPRING', 'CASTLE', 'FLOWER', 'GARDEN', 'STREAM', 'WONDER'],
              7: ['RAINBOW', 'THUNDER', 'DIAMOND', 'JOURNEY', 'CRYSTAL', 'MORNING', 'SUNRISE'],
              8: ['STARSHIP', 'MOUNTAIN', 'SUNLIGHT', 'CHAMPION', 'FIREWORK', 'TREASURE'],
              9: ['BUTTERFLY', 'BEAUTIFUL', 'LIGHTNING', 'ASTRONOMY', 'WATERFALL'],
              10: ['WONDERLAND', 'BASKETBALL', 'PLAYGROUND', 'SPACECRAFT']
            };
            const fallbackWords = fallbackMap[len] || fallbackMap[5];
            newWordListMap[len] = fallbackWords;
            fallbackWords.forEach((w) => combinedValid.add(w));
          }
        })
      );

      setWordListMap(newWordListMap);
      setValidDictionary(combinedValid);
      return { wordListMap: newWordListMap, validDictionary: combinedValid };
    } catch (e: any) {
      console.error('WordScramble dictionary load error:', e);
      throw e;
    }
  }, []);

  const handleStartGame = async (config: ScrambleConfig) => {
    try {
      const { wordListMap: preparedMap } = await prepareDictionaries(config.selectedLengths);

      const hasWords = config.selectedLengths.some((len) => (preparedMap[len] || []).length > 0);
      if (!hasWords) {
        throw new Error('No words available for selected lengths. Please try another selection.');
      }

      dispatch({ type: 'START_GAME', config, wordListMap: preparedMap });
      prevFoundWordsLengthRef.current = 0;
      setSplashData(null);
      setView('game');
    } catch (err: any) {
      console.error('Error starting Word Scramble game:', err);
      triggerToast(err?.message || 'Could not start game. Please try again.', TOAST_DURATION.DEFAULT);
    }
  };

  const handleResumeGame = async (savedState: any) => {
    try {
      await prepareDictionaries(savedState.config.selectedLengths);
      dispatch({ type: 'RESTORE_SAVED_GAME', state: savedState });
      prevFoundWordsLengthRef.current = (savedState.foundWords || []).length;
      setSplashData(null);
      setView('game');
    } catch (err: any) {
      console.error('Error resuming saved game:', err);
      triggerToast(err?.message || 'Could not resume game.', TOAST_DURATION.DEFAULT);
    }
  };

  const handleReturnToLobby = () => {
    setView('lobby');
  };

  // Detect milestone word discoveries (5, 10, 15, 20, etc.) and trigger celebratory milestone splash
  useEffect(() => {
    if (view !== 'game') return;

    const currentCount = state.foundWords.length;
    const prevCount = prevFoundWordsLengthRef.current;

    if (currentCount > prevCount && currentCount > 0) {
      // Trigger splash ONLY on milestone multiples of 5 (e.g. 5, 10, 15, 20, 25, 30...)
      if (currentCount % 5 === 0) {
        const latestWord = state.foundWords[0];
        if (latestWord) {
          setSplashData({
            milestoneCount: currentCount,
            latestWord: latestWord.word,
            totalScore: state.score,
            streak: state.streak,
            timeBonus: latestWord.timeBonus,
            timestamp: latestWord.timestamp || Date.now(),
          });
        }
      }
    }
    prevFoundWordsLengthRef.current = currentCount;
  }, [state.foundWords, state.score, state.streak, view]);

  // Auto-dismiss milestone splash animation
  useEffect(() => {
    if (!splashData) return;
    const timer = setTimeout(() => {
      setSplashData(null);
    }, 1800);
    return () => clearTimeout(timer);
  }, [splashData]);

  // Dynamic Timer Tick according to progressive decay multiplier
  useEffect(() => {
    if (view !== 'game' || state.status !== 'playing' || state.config.mode === 'untimed') return;

    // Base 1000ms divided by decay multiplier (e.g. 1.1x -> 909ms, 1.2x -> 833ms, 1.3x -> 769ms)
    const decay = state.timeDecayMultiplier || 1.0;
    const intervalMs = Math.max(400, Math.round(1000 / decay));

    const timer = setInterval(() => {
      dispatch({ type: 'TICK_TIMER' });
    }, intervalMs);
    return () => clearInterval(timer);
  }, [view, state.status, state.config.mode, state.timeDecayMultiplier]);

  // Persist session to repository on Game Over and clean up active game
  useEffect(() => {
    if (view !== 'game') return;

    if (state.status === 'game_over') {
      const longest = state.foundWords.reduce(
        (max, curr) => (curr.word.length > max.length ? curr.word : max),
        ''
      );
      repository.saveSession({
        id: `session_${Date.now()}`,
        gameMode: state.config.mode,
        selectedLengths: state.config.selectedLengths,
        score: state.score,
        wordsFound: state.foundWords.map((f) => f.word),
        totalWordsCount: state.foundWords.length,
        longestWord: longest,
        highestStreak: state.highestStreak,
        timeSpentSeconds: state.config.durationSeconds - state.remainingSeconds,
        completedAt: new Date().toISOString(),
      }).then(() => {
        repository.clearActiveGame();
      });
    }
  }, [view, state.status, state.foundWords, state.score, state.highestStreak, state.config, state.remainingSeconds, repository]);

  // Debounced auto-save for active game in progress (avoids disk stalls on every 1-second timer tick)
  useEffect(() => {
    if (view !== 'game' || (state.status !== 'playing' && state.status !== 'paused')) return;

    const timeout = setTimeout(() => {
      repository.saveActiveGame({
        status: state.status,
        config: state.config,
        tiles: state.tiles,
        stagedTileIds: state.stagedTileIds,
        score: state.score,
        streak: state.streak,
        highestStreak: state.highestStreak,
        remainingSeconds: state.remainingSeconds,
        foundWords: state.foundWords,
        savedAt: new Date().toISOString(),
      });
    }, 1500);

    return () => clearTimeout(timeout);
  }, [
    view,
    state.status,
    state.tiles,
    state.stagedTileIds,
    state.score,
    state.streak,
    state.highestStreak,
    state.foundWords,
    state.config,
    repository
  ]);

  // Staged tiles calculation
  const stagedTiles = useMemo(() => {
    return state.stagedTileIds
      .map((id) => state.tiles.find((t) => t.id === id))
      .filter((t): t is ScrambleTile => Boolean(t));
  }, [state.stagedTileIds, state.tiles]);

  const isValidLength = state.config.selectedLengths.includes(stagedTiles.length);

  // Auto-Submit: ONLY when exactly 1 word length is configured in game options
  useEffect(() => {
    if (view !== 'game' || state.status !== 'playing' || stagedTiles.length === 0) return;
    // Condition 2: Only auto submit when only 1 word length is configured
    if (state.config.selectedLengths.length !== 1) return;

    const targetLen = state.config.selectedLengths[0];
    if (stagedTiles.length !== targetLen) return;

    const formedWord = stagedTiles.map((t) => t.letter).join('').toUpperCase();

    if (state.foundWords.some((f) => f.word === formedWord)) {
      triggerToast(`"${formedWord}" already played!`, TOAST_DURATION.SHORT);
      return;
    }

    if (validDictionary.has(formedWord)) {
      dispatch({
        type: 'SUBMIT_WORD',
        validDictionary,
        wordListMap,
      });
    }
  }, [view, stagedTiles, validDictionary, wordListMap, state.status, state.config.selectedLengths, state.foundWords, triggerToast]);

  // Stable Callbacks to prevent re-rendering memoized Board and Tray on 1s timer ticks
  const handleStageTile = useCallback((tileId: string) => {
    dispatch({ type: 'STAGE_TILE', tileId });
  }, []);

  const handleUnstageTile = useCallback((tileId: string) => {
    dispatch({ type: 'UNSTAGE_TILE', tileId });
  }, []);

  const handleSwapStagedTiles = useCallback((fromIndex: number, toIndex: number) => {
    dispatch({ type: 'SWAP_STAGED_TILES', fromIndex, toIndex });
  }, []);

  const handleBackspace = useCallback(() => {
    dispatch({ type: 'UNSTAGE_LAST_TILE' });
  }, []);

  const handleClear = useCallback(() => {
    dispatch({ type: 'CLEAR_STAGING' });
  }, []);

  const handleShuffle = useCallback(() => {
    dispatch({ type: 'SHUFFLE_TILES' });
  }, []);

  const handleSubmit = useCallback(() => {
    if (stagedTiles.length === 0) return;
    const formedWord = stagedTiles.map((t) => t.letter).join('').toUpperCase();

    // Check if word has already been played
    if (state.foundWords.some((entry) => entry.word === formedWord)) {
      triggerToast(`"${formedWord}" already played!`, TOAST_DURATION.SHORT);
      return;
    }

    // Check if length is acceptable
    if (!state.config.selectedLengths.includes(formedWord.length)) {
      triggerToast(
        `Word must be ${state.config.selectedLengths.map((l) => `${l}L`).join(' or ')}`,
        TOAST_DURATION.SHORT
      );
      dispatch({
        type: 'SUBMIT_WORD',
        validDictionary,
        wordListMap,
      });
      return;
    }

    // Check if in dictionary
    if (!validDictionary.has(formedWord)) {
      triggerToast(`"${formedWord}" not in word list!`, TOAST_DURATION.SHORT);
      dispatch({
        type: 'SUBMIT_WORD',
        validDictionary,
        wordListMap,
      });
      return;
    }

    dispatch({
      type: 'SUBMIT_WORD',
      validDictionary,
      wordListMap,
    });
  }, [stagedTiles, state.foundWords, state.config.selectedLengths, validDictionary, wordListMap, triggerToast]);

  const handleTogglePause = useCallback(() => {
    dispatch({ type: state.status === 'playing' ? 'PAUSE_GAME' : 'RESUME_GAME' });
  }, [state.status]);

  // Desktop Physical Keyboard Support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input, textarea or contenteditable element
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (view !== 'game' || state.status !== 'playing') return;

      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClear();
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        handleShuffle();
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        // Look for the first available tile matching this letter in the letter pool grid
        const char = e.key.toUpperCase();
        const availableTile = state.tiles.find(
          (t) => t.status === 'available' && t.letter.toUpperCase() === char
        );
        if (availableTile) {
          e.preventDefault();
          handleStageTile(availableTile.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, state.status, state.tiles, handleSubmit, handleBackspace, handleClear, handleShuffle, handleStageTile]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 text-slate-100 flex flex-col items-center pt-4 sm:pt-8 pb-20 px-3 sm:px-5 select-none overflow-y-auto overscroll-contain relative touch-pan-y">
      {/* Accepted Word Splash Popup Notification */}
      <ScrambleWordSplash
        splash={splashData}
        onDismiss={() => setSplashData(null)}
      />

      {view === 'lobby' ? (
        <ScrambleLobby
          onStartNewGame={handleStartGame}
          onResumeGame={handleResumeGame}
          onBackToMenu={onBackToMenu}
        />
      ) : (
        <>
          {/* Top In-Game Navbar */}
          <header className="w-full max-w-4xl flex items-center justify-between mb-3 mt-1">
            <button
              onClick={handleReturnToLobby}
              className="p-2 sm:p-2.5 rounded-xl bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-300 transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer active:scale-95 shadow-md"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Lobby</span>
            </button>

            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-amber-300 to-cyan-400">
                WORD SCRAMBLE MATRIX
              </span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => setShowInGameTutorial(true)}
                className="p-2 sm:p-2.5 rounded-xl bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-cyan-400 transition-all flex items-center gap-1 text-xs font-bold cursor-pointer active:scale-95 shadow-md"
                title="How to Play"
              >
                <HelpCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Guide</span>
              </button>

              <button
                onClick={() => handleStartGame(state.config)}
                className="p-2 sm:p-2.5 rounded-xl bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-300 transition-all flex items-center gap-1 text-xs font-bold cursor-pointer active:scale-95 shadow-md"
                title="Restart with same configuration"
              >
                <RefreshCw className="w-4 h-4 text-cyan-400" />
                <span className="hidden sm:inline">Restart</span>
              </button>
            </div>
          </header>

          {/* In-Game Tutorial Modal */}
          <ScrambleTutorialModal
            isOpen={showInGameTutorial}
            onComplete={() => {
              safeLocalStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
              setShowInGameTutorial(false);
            }}
            onSkip={() => {
              safeLocalStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
              setShowInGameTutorial(false);
            }}
          />

          {/* Main Game Surface: Responsive Desktop 2-Column & Mobile 1-Column */}
          <main className="w-full max-w-4xl flex flex-col lg:flex-row items-start justify-center gap-4 flex-1">
            {/* Left Column on Desktop (Selected Word on TOP -> Letter Pool Below), Top on Mobile */}
            <section className="w-full lg:w-7/12 flex flex-col gap-2.5">
              {/* Selected Words (Submission Tray) ON TOP as requested */}
              <SubmissionTray
                stagedTiles={stagedTiles}
                targetLengths={state.config.selectedLengths}
                onUnstageTile={handleUnstageTile}
                onSwapTiles={handleSwapStagedTiles}
                onBackspace={handleBackspace}
                onClear={handleClear}
                onSubmit={handleSubmit}
                onShuffle={handleShuffle}
                isValidLength={isValidLength}
                disabled={state.status !== 'playing'}
              />

              {/* Letter Pool Matrix BELOW Selected Words */}
              <ScrambleBoard
                tiles={state.tiles}
                onTileClick={handleStageTile}
                disabled={state.status !== 'playing'}
              />
            </section>

            {/* Right Column on Desktop (Score & Options & Discovered Words), Bottom on Mobile */}
            <section className="w-full lg:w-5/12 flex flex-col gap-2.5">
              <ScrambleHeader
                score={state.score}
                streak={state.streak}
                remainingSeconds={state.remainingSeconds}
                mode={state.config.mode}
                targetLengths={state.config.selectedLengths}
                isPaused={state.status === 'paused'}
                onTogglePause={handleTogglePause}
                timeDecayMultiplier={state.timeDecayMultiplier}
              />

              <FoundWordsList foundWords={state.foundWords} />
            </section>
          </main>

          {/* Game Over Summary Modal with Return to Lobby */}
          <ScrambleSummaryModal
            isOpen={state.status === 'game_over'}
            gameState={state}
            onPlayAgain={() => handleStartGame(state.config)}
            onReturnToLobby={handleReturnToLobby}
          />
        </>
      )}
    </div>
  );
};
export default WordScrambleContainer;
