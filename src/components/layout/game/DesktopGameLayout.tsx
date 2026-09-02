import React from 'react';
import { NewGrid } from '../../NewGrid';
import { Keyboard } from '../../Keyboard';
import { PostGameHub } from '../../postgame/PostGameHub';
import type { GuessResult, LetterStatus } from '../../../types/game';

interface DesktopGameLayoutProps {
  wordLength: number;
  maxAttempts: number;
  guesses: GuessResult[][];
  currentGuess: string;
  cursorIndex?: number;
  editIndex?: number | null;
  letterStatuses: Record<string, LetterStatus>;
  keyboardStatuses: Record<string, LetterStatus>;
  hintRecord: { letter: string; index: number; row?: number } | null;
  isGameOver: boolean;
  isAlreadyPlayed?: boolean;
  isShake?: boolean;
  compact?: boolean;
  gameplayType?: 'regular' | 'challenge' | 'archive' | 'guest';
  targetWord?: string;
  gameMessage?: string;
  usedHint?: boolean;
  canShowHint?: boolean;
  isHintLocked?: boolean;
  hideKeyboard: boolean;
  isBoardCollapsed: boolean;
  gridDimensions: { maxWidth: number; maxHeight: number };
  showHelp: boolean;
  date?: string | null;
  onChar: (char: string) => void;
  onDelete: () => void;
  onEnter: () => void;
  onSetCursor?: (index: number) => void;
  onSetEditIndex?: (index: number | null) => void;
  onHint?: () => void;
  onToggleRules: () => void;
  onToggleBoardCollapse: () => void;
  onNavigate?: (item: 'play' | 'chat' | 'leaderboard' | 'challenges' | 'wordup') => void;
  onOpenFreePlay?: (mode: 'guest' | 'archive') => void;
  activeDailyMarathons?: any[];
  isMarathonLoading?: boolean;
  isMarathonError?: boolean;
  setSelectedChallengeId?: (id: string | null) => void;
  setIsChallengeOpen?: (open: boolean) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  keyboardRef: React.RefObject<HTMLDivElement | null>;
}

export const DesktopGameLayout: React.FC<DesktopGameLayoutProps> = ({
  wordLength,
  maxAttempts,
  guesses,
  currentGuess,
  cursorIndex,
  editIndex,
  keyboardStatuses,
  hintRecord,
  isGameOver,
  isAlreadyPlayed,
  isShake,
  compact,
  gameplayType,
  targetWord = '',
  gameMessage,
  usedHint,
  canShowHint,
  isHintLocked,
  hideKeyboard,
  isBoardCollapsed,
  gridDimensions,
  showHelp,
  date,
  onChar,
  onDelete,
  onEnter,
  onSetCursor,
  onSetEditIndex,
  onHint,
  onToggleRules,
  onToggleBoardCollapse,
  onNavigate,
  onOpenFreePlay,
  activeDailyMarathons,
  isMarathonLoading,
  isMarathonError,
  setSelectedChallengeId,
  setIsChallengeOpen,
  containerRef,
  keyboardRef,
}) => {
  const isFinished = hideKeyboard && (isGameOver || isAlreadyPlayed);

  return (
    <div className="desktop-gameplay-layout flex-1 flex flex-col min-h-0 w-full px-4 sm:px-8 py-2">
      {/* 1. Active Playing Mode: Centered, uncrowded layout with independent vertical breathing room */}
      {!isFinished && (
        <div className="flex-1 flex flex-col justify-between items-center min-h-0 w-full gap-4 max-w-4xl mx-auto">
          <div
            ref={containerRef as any}
            className="flex-1 flex flex-col items-center justify-center min-h-0 w-full relative overflow-y-auto scrollbar-thin px-4"
          >
            <div className="relative grid-wrapper-parent shrink-0 py-2">
              <NewGrid
                wordLength={wordLength}
                maxAttempts={maxAttempts}
                guesses={guesses}
                currentGuess={currentGuess}
                cursorIndex={cursorIndex}
                editIndex={editIndex}
                hintRecord={hintRecord}
                isShake={isShake}
                compact={compact}
                gameplayType={gameplayType}
                onSetCursor={onSetCursor}
                onSetEditIndex={onSetEditIndex}
                maxGridWidth={gridDimensions.maxWidth}
                maxGridHeight={gridDimensions.maxHeight}
                onToggleRules={onToggleRules}
                showRules={showHelp}
                onHint={onHint}
                usedHint={usedHint}
                canShowHint={canShowHint}
                isHintLocked={isHintLocked}
                gameMessage={gameMessage}
                isBoardCollapsed={false}
              />
            </div>
          </div>

          {/* Desktop Keyboard */}
          <div ref={keyboardRef as any} className="w-full max-w-[560px] pb-2 shrink-0 px-2">
            <Keyboard
              onChar={onChar}
              onDelete={onDelete}
              onEnter={onEnter}
              letterStatuses={keyboardStatuses}
              gameplayType="regular"
              wordLength={wordLength}
            />
          </div>
        </div>
      )}

      {/* 2. Post-Game Completed Mode: Polished, Balanced Desktop Grid */}
      {isFinished && (
        <div
          ref={containerRef as any}
          className="flex-1 min-h-0 w-full max-w-5xl mx-auto overflow-y-auto scrollbar-thin px-4 py-3 flex flex-col items-center gap-6"
        >
          {/* Top Hero: Clean Victory Grid Showcase Card */}
          <div className="w-full flex flex-col items-center bg-slate-900/80 border border-white/10 rounded-3xl p-6 shadow-2xl backdrop-blur-xl relative overflow-hidden">
            {/* Header / Collapse Controls */}
            <div className="w-full flex items-center justify-between border-b border-white/10 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-black uppercase tracking-widest text-emerald-400">
                  {guesses.some((g) => g.length === wordLength && g.every((r) => r.status === 'correct'))
                    ? 'Puzzle Solved'
                    : 'Puzzle Complete'}
                </span>
              </div>

              {onToggleBoardCollapse && (
                <button
                  onClick={onToggleBoardCollapse}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-xs"
                >
                  {isBoardCollapsed ? 'View Full Board (6 rows)' : 'Compact Board'}
                </button>
              )}
            </div>

            {/* Grid */}
            <div className="relative grid-wrapper-parent shrink-0 py-2">
              <NewGrid
                wordLength={wordLength}
                maxAttempts={maxAttempts}
                guesses={guesses}
                currentGuess={currentGuess}
                cursorIndex={cursorIndex}
                editIndex={editIndex}
                hintRecord={hintRecord}
                isShake={isShake}
                compact={compact}
                gameplayType={gameplayType}
                onSetCursor={onSetCursor}
                onSetEditIndex={onSetEditIndex}
                maxGridWidth={null}
                maxGridHeight={null}
                onToggleRules={onToggleRules}
                showRules={showHelp}
                onHint={onHint}
                usedHint={usedHint}
                canShowHint={canShowHint}
                isHintLocked={isHintLocked}
                gameMessage={gameMessage}
                isBoardCollapsed={isBoardCollapsed}
                onToggleBoardCollapse={onToggleBoardCollapse}
              />
            </div>
          </div>

          {/* Bottom Dashboard: Engagement & Post-Game Hub */}
          <div className="w-full">
            <PostGameHub
              word={targetWord}
              guesses={guesses}
              maxAttempts={maxAttempts}
              isWon={guesses.some((g) => g.length === wordLength && g.every((r) => r.status === 'correct'))}
              usedHint={!!usedHint}
              gameMessage={gameMessage}
              date={date || new Date().toISOString().split('T')[0]}
              hintRecord={hintRecord}
              onNavigate={onNavigate || (() => {})}
              onOpenFreePlay={onOpenFreePlay}
              activeDailyMarathons={activeDailyMarathons}
              isMarathonLoading={isMarathonLoading}
              isMarathonError={isMarathonError}
              setSelectedChallengeId={setSelectedChallengeId}
              setIsChallengeOpen={setIsChallengeOpen}
            />
          </div>
        </div>
      )}
    </div>
  );
};
