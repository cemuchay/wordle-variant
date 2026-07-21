import React, { memo, useState, useEffect, useCallback, useRef } from 'react';
import type { GuessResult } from '../types/game';
import { HelpCircle, X } from 'lucide-react';
import { ANIMATION_DURATION } from '../constants/ui';
import returnAnimationTime from '../utils/returnAnimationTime';
import { useIsResponsive } from '../hooks/useResponsive';

interface CellProps {
  letter: string;
  status?: 'correct' | 'present' | 'absent' | 'default' | 'empty';
  isRevealing?: boolean;
  revealIndex?: number;
  isShake?: boolean;
  isPop?: boolean;
  isHinted?: boolean;
  isWinner?: boolean;
  isSaving?: boolean;
  compact?: boolean;
  gameplayType?: 'regular' | 'challenge';
  wordLength: number;
  isCursor?: boolean;
  isEditMode?: boolean;
  cellSizePx?: number | null;
}

const Cell = memo(({
  letter,
  status,
  isRevealing,
  revealIndex = 0,
  isShake,
  isPop,
  isHinted,
  isWinner,
  wordLength,
  isCursor,
  isEditMode,
  cellSizePx
}: CellProps) => {
  const tileClass = `
    flex items-center justify-center 
    font-bold uppercase transition-colors duration-300
    border-2 text-white ${wordLength > 5 ? "rounded-md" : ""}
  `;

  let statusClass = 'border-gray-800';
  let animationClass = '';

  if (status === 'correct') statusClass = 'bg-correct border-correct';
  else if (status === 'present') statusClass = 'bg-present border-present';
  else if (status === 'absent') statusClass = 'bg-absent border-absent';
  else if (letter) statusClass = 'border-gray-500';
  if (isCursor && wordLength > 5) statusClass += ' ring-2 ring-blue-400 border-blue-400';
  if (isEditMode && wordLength > 5) statusClass += ' ring-2 ring-yellow-400 border-yellow-400 bg-yellow-400/10';

  if (isRevealing) {
    if (status === 'correct') animationClass = 'animate-reveal-correct';
    else if (status === 'present') animationClass = 'animate-reveal-present';
    else if (status === 'absent') animationClass = 'animate-reveal-absent';
  } else if (isWinner) {
    animationClass = 'animate-bounce-up-down';
  } else if (isShake) {
    animationClass = 'animate-shake';
  } else if (isPop) {
    animationClass = 'animate-pop';
  } else if (isHinted) {
    animationClass = 'animate-pulse text-yellow-500/50 border-yellow-600/50';
  }

  const finalSize = cellSizePx || 48;

  const style: React.CSSProperties = {
    width: `${finalSize}px`,
    height: `${finalSize}px`,
    fontSize: `${finalSize * 0.45}px`,
    ...(isRevealing ? {
      animationDelay: `${revealIndex * ANIMATION_DURATION.TILE_REVEAL}ms`,
      animationFillMode: 'both'
    } : {})
  };

  return (
    <div className={`${tileClass} ${statusClass} ${animationClass}`} style={style}>
      {letter}
    </div>
  );
});

Cell.displayName = 'Cell';

interface NewGridProps {
  wordLength: number;
  maxAttempts: number;
  guesses: GuessResult[][];
  currentGuess: string;
  hintRecord?: { index: number; letter: string } | null;
  isChallengeMode?: boolean;
  isShake?: boolean;
  compact?: boolean;
  gameplayType?: 'regular' | 'challenge';
  cursorIndex?: number;
  editIndex?: number | null;
  onSetCursor?: (index: number) => void;
  onSetEditIndex?: (index: number | null) => void;
  maxGridWidth?: number | null;
  maxGridHeight?: number | null;
  onToggleRules?: () => void;
  showRules?: boolean;
}

const LONG_PRESS_MS = 500;

export const NewGrid: React.FC<NewGridProps> = memo(({
  wordLength,
  maxAttempts,
  guesses,
  currentGuess,
  hintRecord,
  isChallengeMode,
  isShake,
  compact,
  gameplayType,
  cursorIndex,
  editIndex,
  onSetCursor,
  onSetEditIndex,
  maxGridWidth,
  maxGridHeight,
  onToggleRules,
  showRules
}) => {
  const { isDesktop, } = useIsResponsive();

  let cellSizePx: number | null = null;
  if (maxGridWidth && maxGridHeight) {
    const gapSize = compact ? 4 : 6;
    const padding = compact ? 16 : 32;
    const extraWidth = maxAttempts > 6 ? 32 : 0;

    const usableWidth = maxGridWidth - padding - extraWidth;

    const cellWidthLimit = Math.max(20, (usableWidth - (wordLength - 1) * gapSize) / wordLength);

    if (maxAttempts > 6) {
      cellSizePx = Math.floor(cellWidthLimit);
    } else {
      const usableHeight = maxGridHeight - padding;
      const cellHeightLimit = (usableHeight - (maxAttempts - 1) * gapSize) / maxAttempts;
      cellSizePx = Math.floor(Math.max(10, Math.min(cellWidthLimit, cellHeightLimit)));
    }

    // On desktop in challenge mode, apply the resize scale
    const isChallenge = gameplayType === 'challenge' || compact;
    if (isDesktop && isChallenge) {
      const resizeScale = maxAttempts > 6 ? 0.35 : 0.85;
      cellSizePx = Math.floor(cellSizePx * resizeScale);
    }
  }

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlePointerDown = useCallback((i: number) => {
    if (wordLength <= 5) return;
    longPressTimerRef.current = setTimeout(() => {
      onSetEditIndex?.(i);
      longPressTimerRef.current = null;
    }, LONG_PRESS_MS);
  }, [wordLength, onSetEditIndex]);

  const handlePointerUp = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
  }, []);

  const lastClickRef = useRef<{ time: number; index: number } | null>(null);
  const handleCellClick = useCallback((i: number) => {
    const now = Date.now();
    const prev = lastClickRef.current;
    if (wordLength > 5 && prev && prev.index === i && now - prev.time < 300) {
      onSetEditIndex?.(i);
      lastClickRef.current = null;
      return;
    }
    lastClickRef.current = { time: now, index: i };
    onSetCursor?.(i);
  }, [wordLength, onSetCursor, onSetEditIndex]);

  const [revealedRowsCount, setRevealedRowsCount] = useState(guesses.length);

  useEffect(() => {
    if (guesses.length > revealedRowsCount) {
      const timer = setTimeout(() => {
        setRevealedRowsCount(guesses.length);
      }, returnAnimationTime(wordLength));
      return () => clearTimeout(timer);
    } else if (guesses.length < revealedRowsCount) {
      setRevealedRowsCount(guesses.length);
    }
  }, [guesses.length, revealedRowsCount, wordLength]);

  const isCurrentRevealing = guesses.length > revealedRowsCount;
  const revealingRowIndex = isCurrentRevealing ? guesses.length - 1 : null;
  const empties = Math.max(0, maxAttempts - guesses.length - (revealingRowIndex !== null ? 0 : 1));

  // Mascot Face Reactions
  const attemptsCount = guesses.length;
  const isOneAttemptLeft = attemptsCount === maxAttempts - 1 && revealingRowIndex === null;
  const isWon = guesses.some(g => g.length === wordLength && g.every(res => res.status === 'correct'));
  const isLost = !isWon && attemptsCount === maxAttempts && revealingRowIndex === null;

  const lastGuess = guesses[guesses.length - 1];
  let hasRepeatedLetters = false;
  if (lastGuess) {
    const charCounts: Record<string, number> = {};
    for (const res of lastGuess) {
      if (res.letter) {
        const char = res.letter.toUpperCase();
        charCounts[char] = (charCounts[char] || 0) + 1;
        if (charCounts[char] >= 3) {
          hasRepeatedLetters = true;
          break;
        }
      }
    }
  }

  const [mascotData, setMascotData] = useState<{ expression: import('../wordup/shared/WordUpMascot').MascotExpression; label: string } | null>(null);

  useEffect(() => {
    const delay = isCurrentRevealing ? returnAnimationTime(wordLength) : 0;
    let expression: import('../wordup/shared/WordUpMascot').MascotExpression = 'idle';
    let label = 'Looking good!';

    if (isWon) {
      expression = 'happy';
      label = 'Splendid job!';
    } else if (isLost) {
      expression = 'sad';
      label = 'Aww, maybe next time!';
    } else if (isOneAttemptLeft) {
      expression = 'worried';
      label = 'Only 1 guess left!';
    } else if (hasRepeatedLetters) {
      expression = 'thinking';
      label = 'Interesting choice...';
    } else if (attemptsCount > 0) {
      const labels = ['Thinking...', 'Let us see...', 'Keep going!'];
      const idx = (attemptsCount - 1) % labels.length;
      expression = 'thinking';
      label = labels[idx];
    }

    const timer = setTimeout(() => {
      setMascotData({ expression, label });
    }, delay);

    return () => clearTimeout(timer);
  }, [isWon, isLost, isOneAttemptLeft, hasRepeatedLetters, attemptsCount, isCurrentRevealing, wordLength]);

  useEffect(() => {
    if (mascotData) {
      window.dispatchEvent(new CustomEvent('mascot-changed', {
        detail: { expression: mascotData.expression, label: mascotData.label }
      }));
    }
    return () => {
      window.dispatchEvent(new CustomEvent('mascot-changed', {
        detail: null
      }));
    };
  }, [mascotData]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const currentRowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (maxAttempts > 6) {
      if (isLost && scrollContainerRef.current) {
        const delay = isCurrentRevealing ? returnAnimationTime(wordLength) : 0;
        const timer = setTimeout(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({
              top: scrollContainerRef.current.scrollHeight,
              behavior: 'smooth'
            });
          }
        }, delay);
        return () => clearTimeout(timer);
      } else if (currentRowRef.current && scrollContainerRef.current) {
        const container = scrollContainerRef.current;
        const targetRow = currentRowRef.current;
        const targetTop = targetRow.offsetTop;
        const containerHeight = container.clientHeight;
        const rowHeight = targetRow.clientHeight;

        container.scrollTo({
          top: targetTop - (containerHeight / 2) + (rowHeight / 2),
          behavior: 'smooth'
        });
      }
    }
  }, [guesses.length, currentGuess.length, maxAttempts, isWon, isLost, isCurrentRevealing, wordLength]);

  const rowGapClass = compact ? 'gap-1 sm:gap-1.5' : 'gap-1.5 sm:gap-2';
  const [showEditHelp, setShowEditHelp] = useState(false);

  return (
    <div className="relative mx-auto w-fit select-none shrink-0">


      {/*Right Side Rules */}
      {(onToggleRules || wordLength > 5) && (
        <div className="absolute top-0 -right-4 flex items-center gap-2 md:left-full md:ml-3 md:top-2 md:flex-col md:right-auto z-30 shrink-0">
          {onToggleRules && (
            <div className="relative">
              <button
                onClick={onToggleRules}
                className="w-3.5 h-3.5 sm:w-7 sm:h-7 flex items-center justify-center rounded-xl bg-white/10 text-white/50 hover:bg-white/20 hover:text-white/80 transition-all cursor-pointer"
                title="Quick rules"
              >
                <HelpCircle size={15} />
              </button>
              {showRules && (
                <>
                  <div className="absolute right-0 mt-1.5 z-50 w-56 bg-gray-900/95 backdrop-blur-md border border-white/10 p-3.5 rounded-2xl shadow-2xl text-left animate-in fade-in slide-in-from-top-1 duration-150 md:left-full md:bottom-0 md:mt-0 md:ml-2 md:slide-in-from-left-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[9px] font-black uppercase tracking-wider text-correct">Quick Rules</span>
                      <button onClick={onToggleRules} className="text-gray-500 hover:text-white p-0.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer">
                        <X size={10} />
                      </button>
                    </div>
                    <p className="text-[9px] text-gray-400 uppercase font-black tracking-wide mb-2 leading-relaxed">
                      Guess the word in {maxAttempts} tries. Colors show status:
                    </p>
                    <ul className="text-[9px] text-gray-300 space-y-1 font-black uppercase tracking-wide">
                      <li className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded bg-correct shrink-0 border border-white/10" />
                        <span>Correct Spot</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded bg-present shrink-0 border border-white/10" />
                        <span>Wrong Spot</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded bg-absent shrink-0 border border-white/10" />
                        <span>Not In Word</span>
                      </li>
                    </ul>
                  </div>
                  <div className="fixed inset-0 z-40" onClick={onToggleRules} />
                </>
              )}
            </div>
          )}

          {wordLength > 5 && (
            <div className="relative">
              <button
                onClick={() => setShowEditHelp(!showEditHelp)}
                className="w-5 h-5 sm:w-7 sm:h-7 flex items-center justify-center rounded-xl bg-white/10 text-white/50 hover:bg-white/20 hover:text-white/80 text-xs font-bold transition-all cursor-pointer"
                title="Edit controls help"
              >
                ?
              </button>
              {showEditHelp && (
                <>
                  <div className="absolute right-0 mt-1.5 z-50 w-60 bg-slate-900 border border-white/10 rounded-xl p-3 shadow-2xl text-[11px] leading-relaxed text-white/80 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150 md:left-full md:bottom-0 md:mt-0 md:ml-2 md:slide-in-from-left-1">
                    <div className="font-bold text-white/90 text-xs mb-1.5">Editing Controls</div>
                    <p><span className="text-blue-400 font-bold">Tap</span> a cell to move the cursor there.</p>
                    <p><span className="text-red-400 font-bold">Backspace</span> deletes the letter at cursor and shifts remaining left.</p>
                    <p><span className="text-yellow-400 font-bold">Double-click</span> or <span className="text-yellow-400 font-bold">long-press</span> a cell to enter <span className="text-yellow-400">edit mode</span>.</p>
                    <p>In edit mode, <span className="text-red-400 font-bold">Backspace</span> clears that cell without shifting. Type a letter to fill it.</p>
                    <button
                      onClick={() => setShowEditHelp(false)}
                      className="mt-2 w-full text-center text-[10px] text-white/40 hover:text-white/70 uppercase tracking-wider font-bold cursor-pointer"
                    >
                      Got it
                    </button>
                  </div>
                  <div className="fixed inset-0 z-40" onClick={() => setShowEditHelp(false)} />
                </>
              )}
            </div>
          )}
        </div>
      )}

      <div
        ref={scrollContainerRef}
        className={maxAttempts > 6 ? "overflow-y-auto overflow-hidden scrollbar-thin pr-1.5" : ""}
        style={maxAttempts > 6 ? { maxHeight: isDesktop ? 'min(280px, 35vh)' : 'min(360px, 60vh)', overflowY: 'auto' } : undefined}
      >
        <div
          className={`flex flex-col mx-auto h-fit max-h-full items-center justify-center rounded-2xl ${isChallengeMode ? 'bg-correct/5 shadow-[0_0_30px_rgba(0,255,0,0.08)] border border-correct/20' : ''} ${compact ? 'gap-1 sm:gap-1.5 p-2' : 'gap-1.5 sm:gap-2 p-2 sm:p-4'}`}
          style={{ width: 'max-content' }}
        >
          {/* Past Guesses */}
          {guesses.map((guess, i) => {
            const isRevealing = i === revealingRowIndex;
            const isWinningRow = isWon && i === guesses.length - 1 && !isCurrentRevealing;

            return (
              <div key={`row-past-${i}`} className="flex items-center gap-2">
                {maxAttempts > 6 && (
                  <div className="w-6 text-[9px] font-black text-white/20 text-right shrink-0">
                    #{i + 1}
                  </div>
                )}
                <div className={`flex justify-center ${rowGapClass}`}>
                  {guess.map((res, j) => (
                    <Cell
                      key={`past-${i}-${j}`}
                      letter={res.letter}
                      status={res.status}
                      isRevealing={isRevealing}
                      revealIndex={j}
                      isWinner={isWinningRow}
                      wordLength={wordLength}
                      cellSizePx={cellSizePx}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Current Guess Row */}
          {guesses.length < maxAttempts && revealingRowIndex === null && (
            <div ref={currentRowRef} className="flex items-center gap-2">
              {maxAttempts > 6 && (
                <div className="w-6 text-[9px] font-black text-white/20 text-right shrink-0">
                  #{guesses.length + 1}
                </div>
              )}
              <div className={`flex justify-center ${rowGapClass}`}>
                {Array.from({ length: wordLength }).map((_, i) => {
                  const isHinted = hintRecord?.index === i;
                  const raw = currentGuess[i];
                  const letter = raw === '\0' ? '' : (raw || (isHinted ? hintRecord?.letter : ''));
                  const isEditMode = editIndex === i;

                  return (
                    <div
                      key={`current-${i}`}
                      onClick={() => handleCellClick(i)}
                      onPointerDown={() => handlePointerDown(i)}
                      onPointerUp={handlePointerUp}
                      onPointerLeave={handlePointerUp}
                      className="cursor-pointer"
                    >
                      <Cell
                        letter={letter}
                        isPop={!!raw && raw !== '\0'}
                        isShake={isShake}
                        isHinted={isHinted}
                        wordLength={wordLength}
                        isCursor={!isWon && !isLost && !isEditMode && cursorIndex === i}
                        isEditMode={isEditMode}
                        cellSizePx={cellSizePx}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty Rows */}
          {Array.from({ length: empties }).map((_, i) => {
            const index = guesses.length + (revealingRowIndex !== null ? 0 : 1) + i;
            return (
              <div key={`row-empty-${i}`} className="flex items-center gap-2">
                {maxAttempts > 6 && (
                  <div className="w-6 text-[9px] font-black text-white/20 text-right shrink-0">
                    #{index + 1}
                  </div>
                )}
                <div className={`flex justify-center ${rowGapClass}`}>
                  {Array.from({ length: wordLength }).map((_, j) => (
                    <Cell
                      key={`empty-${i}-${j}`}
                      letter=""
                      wordLength={wordLength}
                      cellSizePx={cellSizePx}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

NewGrid.displayName = 'NewGrid';
