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
  isDesktop: boolean;
  isSmall: boolean;
  isSuperTiny: boolean;
  cellSizePx?: number | null;
}

// Sizing config supporting different widths/heights for mobile and desktop (sm)
const TILE_SIZES = [
  {
    length: 3,
    small: { w: 1.87, h: 1.87 },
    mobile: { w: 2.2, h: 2.2 },
    desktop: { w: 2, h: 2 }
  },
  {
    length: 4,
    small: { w: 1.78, h: 1.78 },
    mobile: { w: 2.1, h: 2.1 },
    desktop: { w: 2, h: 2 }
  },
  {
    length: 5,
    small: { w: 1.87, h: 1.87 },
    mobile: { w: 2.2, h: 2.2 },
    desktop: { w: 2, h: 2 }
  },
  {
    length: 6,
    small: { w: 1.87, h: 1.87 },
    mobile: { w: 2.2, h: 2.2 },
    desktop: { w: 2, h: 2 }
  },
  {
    length: 7,
    small: { w: 1.87, h: 1.87 },
    mobile: { w: 2.2, h: 2.2 },
    desktop: { w: 2, h: 2 }
  },
  {
    length: 8,
    small: { w: 1.87, h: 1.87 },
    mobile: { w: 2.2, h: 2.2 },
    desktop: { w: 2, h: 2 }
  },
  {
    length: 9,
    small: { w: 1.7, h: 1.7 },
    mobile: { w: 2, h: 2 },
    desktop: { w: 2, h: 2 }
  },
  {
    length: 10,
    small: { w: 1.7, h: 1.7 },
    mobile: { w: 2, h: 2 },
    desktop: { w: 2, h: 2 }
  },
];

const Cell = memo(({ letter, status, isRevealing, revealIndex = 0, isShake, isPop, isHinted, isWinner, compact, gameplayType, wordLength, isCursor, isEditMode, isDesktop, isSmall, cellSizePx }: CellProps) => {
  const isChallenge = gameplayType === 'challenge' || compact;

  // 1. Get the current size profile based on word length
  const sizeConfig = TILE_SIZES.find((s) => s.length === wordLength) || TILE_SIZES[TILE_SIZES.length - 1];

  // 2. Select dimensions based on device size
  const dimensions = isDesktop ? sizeConfig.desktop : (isSmall ? sizeConfig.small : sizeConfig.mobile);

  // 3. Optional: If challenge mode needs a slight reduction scale (e.g., 85% size) on desktop
  let scale = { h: 1, w: 1 };
  if (isDesktop && isChallenge) {
    scale = { h: 0.85, w: 0.85 };
  }

  const finalWidth = dimensions.w * scale.w;
  const finalHeight = dimensions.h * scale.h;

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

  // 4. Inject responsive widths and heights into inline styles
  const style: React.CSSProperties = {
    width: cellSizePx ? `${cellSizePx}px` : `${finalWidth}rem`,
    height: cellSizePx ? `${cellSizePx}px` : `${finalHeight}rem`,
    fontSize: cellSizePx ? `${cellSizePx * 0.45}px` : `${finalWidth * 0.5}rem`, // Font sizes scale fluidly with width
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

interface GridProps {
  wordLength: number;
  maxAttempts: number;
  guesses: GuessResult[][];
  currentGuess: string;
  hintRecord?: { letter: string, index: number } | null;
  isChallengeMode?: boolean;
  isShake?: boolean;
  isSaving?: boolean;
  compact?: boolean;
  gameplayType?: 'regular' | 'challenge';
  cursorIndex?: number;
  editIndex?: number | null;
  onSetCursor?: (index: number) => void;
  onSetEditIndex?: (index: number | null) => void;
  maxGridWidth?: number;
  maxGridHeight?: number;
  onToggleRules?: () => void;
  showRules?: boolean;
}

const LONG_PRESS_MS = 400;

export const Grid: React.FC<GridProps> = memo(({ wordLength, maxAttempts, guesses, currentGuess, hintRecord, isChallengeMode, isShake, compact, gameplayType, cursorIndex, editIndex, onSetCursor, onSetEditIndex, maxGridWidth, maxGridHeight, onToggleRules, showRules }) => {
  const { isDesktop, isSmall, isSuperTiny } = useIsResponsive();

  // Calculate dynamic square cell size if constraints are provided
  let cellSizePx: number | null = null;
  if (maxGridWidth && maxGridHeight) {
    const gapSize = compact ? 4 : 6;
    const padding = compact ? 16 : 32;
    const extraWidth = maxAttempts > 6 ? 32 : 0;

    const usableWidth = maxGridWidth - padding - extraWidth;
    const usableHeight = maxGridHeight - padding;

    const cellWidthLimit = (usableWidth - (wordLength - 1) * gapSize) / wordLength;
    const cellHeightLimit = (usableHeight - (maxAttempts - 1) * gapSize) / maxAttempts;

    cellSizePx = Math.floor(Math.max(10, Math.min(cellWidthLimit, cellHeightLimit)));

    // On desktop in challenge mode, apply the 85% resize scale
    const isChallenge = gameplayType === 'challenge' || compact;
    if (isDesktop && isChallenge) {
      cellSizePx = Math.floor(cellSizePx * 0.85);
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
  useEffect(() => () => { if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current); }, []);
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

  const [mascotData, setMascotData] = useState<{ expression: import('./wordup/WordUpView/components/WordUpMascot').MascotExpression; label: string } | null>(null);

  useEffect(() => {
    const delay = isCurrentRevealing ? returnAnimationTime(wordLength) : 0;

    let expression: import('./wordup/WordUpView/components/WordUpMascot').MascotExpression = 'idle';
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

  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const currentRowRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (maxAttempts > 6) {
      if ((isWon || isLost) && scrollContainerRef.current) {
        // Wait for the reveal animation to finish before scrolling to the bottom
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
        // Scroll only the grid's local scrollContainer instead of using window-shifting scrollIntoView
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
      {/* Mobile Header Rules */}
      {!isDesktop && (onToggleRules || wordLength > 5) && (
        <div className="flex items-center justify-end gap-1.5 mb-1 w-full px-0.5">
          {onToggleRules && (
            <div className="relative">
              <button
                onClick={onToggleRules}
                className="w-5 h-5 flex items-center justify-center rounded-full bg-white/10 text-white/50 hover:bg-white/20 hover:text-white/80 transition-all cursor-pointer"
                title="Quick rules"
              >
                <HelpCircle size={12} />
              </button>
              {showRules && (
                <>
                  <div className="absolute right-0 mt-2 z-50 w-56 bg-gray-900/95 backdrop-blur-md border border-white/10 p-3.5 rounded-2xl shadow-2xl text-left animate-in fade-in slide-in-from-top-1 duration-150">
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
                className="w-5 h-5 flex items-center justify-center rounded-full bg-white/10 text-white/50 hover:bg-white/20 hover:text-white/80 text-[10px] font-bold transition-all cursor-pointer"
                title="Edit controls help"
              >
                ?
              </button>
              {showEditHelp && (
                <>
                  <div className="absolute top-full right-0 mt-1 z-50 w-60 bg-slate-900 border border-white/10 rounded-xl p-2 shadow-2xl text-[11px] leading-relaxed text-white/80 space-y-1.5">
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
        className={maxAttempts > 6 ? "overflow-y-auto overflow-hidden py-2 sm:py-4 scrollbar-thin pr-1.5" : ""}
        style={maxAttempts > 6 ? { maxHeight: 'min(360px, 60vh)', overflowY: 'auto' } : undefined}
      >
        <div
          className={`game-board-grid flex flex-col mx-auto h-fit max-h-full items-center justify-center rounded-2xl ${isChallengeMode ? 'bg-correct/5 shadow-[0_0_30px_rgba(0,255,0,0.08)] border border-correct/20' : ''} ${compact ? 'gap-1 sm:gap-1.5 p-2' : 'gap-1.5 sm:gap-2 p-2 sm:p-4'}`}
          style={{
            width: 'max-content'
          }}
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
                      compact={compact}
                      gameplayType={gameplayType}
                      wordLength={wordLength}
                      isDesktop={isDesktop}
                      isSmall={isSmall}
                      isSuperTiny={isSuperTiny}
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
                        compact={compact}
                        gameplayType={gameplayType}
                        wordLength={wordLength}
                        isCursor={!isWon && !isLost && !isEditMode && cursorIndex === i}
                        isEditMode={isEditMode}
                        isDesktop={isDesktop}
                        isSmall={isSmall}
                        isSuperTiny={isSuperTiny}
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
            const rowIndex = guesses.length + (revealingRowIndex !== null ? 0 : 1) + i;
            return (
              <div key={`row-empty-${i}`} className="flex items-center gap-2">
                {maxAttempts > 6 && (
                  <div className="w-6 text-[9px] font-black text-white/20 text-right shrink-0">
                    #{rowIndex + 1}
                  </div>
                )}
                <div className={`flex justify-center ${rowGapClass}`}>
                  {Array.from({ length: wordLength }).map((_, j) => {
                    const isHinted = hintRecord?.index === j;
                    return (
                      <Cell
                        key={`empty-${i}-${j}`}
                        letter={isHinted ? hintRecord?.letter : ''}
                        isHinted={isHinted}
                        compact={compact}
                        gameplayType={gameplayType}
                        wordLength={wordLength}
                        isDesktop={isDesktop}
                        isSmall={isSmall}
                        isSuperTiny={isSuperTiny}
                        cellSizePx={cellSizePx}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

      {/* Desktop Right Side Rules */}
      {isDesktop && (onToggleRules || wordLength > 5) && (
        <div className="absolute left-full ml-3 top-2 flex flex-col items-center gap-2 shrink-0">
            {onToggleRules && (
              <div className="relative">
                <button
                  onClick={onToggleRules}
                  className="w-7 h-7 flex items-center justify-center rounded-xl bg-white/10 text-white/50 hover:bg-white/20 hover:text-white/80 transition-all cursor-pointer"
                  title="Quick rules"
                >
                  <HelpCircle size={15} />
                </button>
                 {showRules && (
                  <>
                    <div className="absolute left-full bottom-0 ml-2 z-50 w-56 bg-gray-900/95 backdrop-blur-md border border-white/10 p-3.5 rounded-2xl shadow-2xl text-left animate-in fade-in slide-in-from-left-1 duration-150">
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
                  className="w-7 h-7 flex items-center justify-center rounded-xl bg-white/10 text-white/50 hover:bg-white/20 hover:text-white/80 text-xs font-bold transition-all cursor-pointer"
                  title="Edit controls help"
                >
                  ?
                </button>
                {showEditHelp && (
                  <>
                    <div className="absolute left-full bottom-0 ml-2 z-50 w-60 bg-slate-900 border border-white/10 rounded-xl p-3 shadow-2xl text-[11px] leading-relaxed text-white/80 space-y-1.5 animate-in fade-in slide-in-from-left-1 duration-150">
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
      </div>
    </div>
  );
});


Grid.displayName = 'Grid';
