import React, { useReducer, useEffect, useCallback, useMemo, useState } from 'react';
import { scrambleReducer, initialScrambleState } from './engine/ScrambleEngine';
import type { ScrambleConfig, ScrambleTile } from './engine/types';
import { LocalStorageScrambleRepository } from './storage/ScrambleRepository';
import { loadWordLists } from '../data/words';
import { ScrambleHeader } from './components/ScrambleHeader';
import { ScrambleBoard } from './components/ScrambleBoard';
import { SubmissionTray } from './components/SubmissionTray';
import { FoundWordsList } from './components/FoundWordsList';
import { ScrambleConfigModal } from './components/ScrambleConfigModal';
import { ScrambleSummaryModal } from './components/ScrambleSummaryModal';
import { ArrowLeft, Settings } from 'lucide-react';

interface WordScrambleContainerProps {
  onBackToMenu?: () => void;
}

export const WordScrambleContainer: React.FC<WordScrambleContainerProps> = ({
  onBackToMenu,
}) => {
  const [state, dispatch] = useReducer(scrambleReducer, initialScrambleState);
  const [isConfigOpen, setIsConfigOpen] = useState(true);
  const [validDictionary, setValidDictionary] = useState<Set<string>>(new Set());
  const [wordListMap, setWordListMap] = useState<Record<number, string[]>>({});
  const [isLoadingWords, setIsLoadingWords] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const repository = useMemo(() => new LocalStorageScrambleRepository(), []);

  // Preload and build active dictionary whenever target lengths change with thorough error handling
  const prepareDictionaries = useCallback(async (lengths: number[]): Promise<{
    wordListMap: Record<number, string[]>;
    validDictionary: Set<string>;
  }> => {
    setIsLoadingWords(true);
    setErrorMessage(null);
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
      const msg = e?.message || 'Failed to initialize word dictionary';
      console.error('WordScramble dictionary load error:', e);
      setErrorMessage(msg);
      throw e;
    } finally {
      setIsLoadingWords(false);
    }
  }, []);

  const handleStartGame = async (config: ScrambleConfig) => {
    try {
      setErrorMessage(null);
      const { wordListMap: preparedMap } = await prepareDictionaries(config.selectedLengths);
      
      // Ensure we have at least one valid list
      const hasWords = config.selectedLengths.some((len) => (preparedMap[len] || []).length > 0);
      if (!hasWords) {
        throw new Error('No words available for selected lengths. Please try another selection.');
      }

      dispatch({ type: 'START_GAME', config, wordListMap: preparedMap });
      setIsConfigOpen(false);
    } catch (err: any) {
      console.error('Error starting Word Scramble game:', err);
      setErrorMessage(err?.message || 'Could not start game. Please try again.');
    }
  };

  // Timer Tick
  useEffect(() => {
    if (state.status !== 'playing' || state.config.mode === 'untimed') return;
    const timer = setInterval(() => {
      dispatch({ type: 'TICK_TIMER' });
    }, 1000);
    return () => clearInterval(timer);
  }, [state.status, state.config.mode]);

  // Persist session to repository on Game Over
  useEffect(() => {
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
      });
    }
  }, [state.status]);

  // Desktop Physical Keyboard Support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (state.status !== 'playing' || isConfigOpen) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        dispatch({
          type: 'SUBMIT_WORD',
          validDictionary,
          wordListMap,
        });
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        dispatch({ type: 'UNSTAGE_LAST_TILE' });
      } else if (e.key === 'Escape') {
        e.preventDefault();
        dispatch({ type: 'CLEAR_STAGING' });
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        dispatch({ type: 'SHUFFLE_TILES' });
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        const char = e.key.toUpperCase();
        // Find first available tile on board matching letter
        const availableTile = state.tiles.find(
          (t) => t.status === 'available' && t.letter === char
        );
        if (availableTile) {
          dispatch({ type: 'STAGE_TILE', tileId: availableTile.id });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.status, state.tiles, isConfigOpen, validDictionary, wordListMap]);

  // Staged tiles
  const stagedTiles = useMemo(() => {
    return state.stagedTileIds
      .map((id) => state.tiles.find((t) => t.id === id))
      .filter((t): t is ScrambleTile => Boolean(t));
  }, [state.stagedTileIds, state.tiles]);

  const isValidLength = state.config.selectedLengths.includes(stagedTiles.length);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 text-slate-100 flex flex-col items-center pt-8 sm:pt-12 pb-24 px-3 sm:px-5 select-none overflow-y-auto">
      {/* Top Navbar */}
      <header className="w-full max-w-xl flex items-center justify-between mb-4 mt-2">
        <button
          onClick={onBackToMenu}
          className="p-2.5 rounded-xl bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-300 transition-all flex items-center gap-1.5 text-xs font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>More Games</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-amber-300 to-cyan-400">
            WORD SCRAMBLE MATRIX
          </span>
        </div>

        <button
          onClick={() => setIsConfigOpen(true)}
          className="p-2.5 rounded-xl bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-300 transition-all"
        >
          <Settings className="w-4 h-4" />
        </button>
      </header>

      {/* Main Game Surface */}
      <main className="w-full max-w-xl flex flex-col flex-1">
        <ScrambleHeader
          score={state.score}
          streak={state.streak}
          remainingSeconds={state.remainingSeconds}
          mode={state.config.mode}
          targetLengths={state.config.selectedLengths}
        />

        <SubmissionTray
          stagedTiles={stagedTiles}
          targetLengths={state.config.selectedLengths}
          onUnstageTile={(id) => dispatch({ type: 'UNSTAGE_TILE', tileId: id })}
          onBackspace={() => dispatch({ type: 'UNSTAGE_LAST_TILE' })}
          onClear={() => dispatch({ type: 'CLEAR_STAGING' })}
          onSubmit={() =>
            dispatch({
              type: 'SUBMIT_WORD',
              validDictionary,
              wordListMap,
            })
          }
          onShuffle={() => dispatch({ type: 'SHUFFLE_TILES' })}
          isValidLength={isValidLength}
          disabled={state.status !== 'playing'}
        />

        <ScrambleBoard
          tiles={state.tiles}
          onTileClick={(id) => dispatch({ type: 'STAGE_TILE', tileId: id })}
          disabled={state.status !== 'playing'}
        />

        <FoundWordsList foundWords={state.foundWords} />
      </main>

      {/* Configuration & Start Modal */}
      <ScrambleConfigModal
        isOpen={isConfigOpen}
        onStartGame={handleStartGame}
        isLoading={isLoadingWords}
        errorMessage={errorMessage}
      />

      {/* Game Over Summary Modal */}
      <ScrambleSummaryModal
        isOpen={state.status === 'game_over'}
        gameState={state}
        onPlayAgain={() => handleStartGame(state.config)}
        onOpenSettings={() => setIsConfigOpen(true)}
      />
    </div>
  );
};
export default WordScrambleContainer;
