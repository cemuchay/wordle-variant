import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { NewGrid } from '../../NewGrid';
import { Keyboard } from '../../Keyboard';
import { PostGameHub } from '../../postgame/PostGameHub';
import { ShareCard } from '../../postgame/ShareCard';
import type { GuessResult, LetterStatus } from '../../../types/game';

interface MobileGameLayoutProps {
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
  onClearRow?: () => void;
  onEnter: () => void;
  onSetCursor?: (index: number) => void;
  onSetEditIndex?: (index: number | null) => void;
  onHint?: () => void;
  onToggleRules: () => void;
  onToggleBoardCollapse: () => void;
  onNavigate?: (item: 'play' | 'chat' | 'leaderboard' | 'challenges' | 'wordup') => void;
  onOpenFreePlay?: (mode: 'guest' | 'archive') => void;
  onClose?: () => void;
  activeDailyMarathons?: any[];
  isMarathonLoading?: boolean;
  isMarathonError?: boolean;
  setSelectedChallengeId?: (id: string | null) => void;
  setIsChallengeOpen?: (open: boolean) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  keyboardRef: React.RefObject<HTMLDivElement | null>;
}

export const MobileGameLayout: React.FC<MobileGameLayoutProps> = ({
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
  onClearRow,
  onEnter,
  onSetCursor,
  onSetEditIndex,
  onHint,
  onToggleRules,
  onToggleBoardCollapse,
  onNavigate,
  onOpenFreePlay,
  onClose,
  activeDailyMarathons,
  isMarathonLoading,
  isMarathonError,
  setSelectedChallengeId,
  setIsChallengeOpen,
  containerRef,
  keyboardRef,
}) => {
  const isFinished = hideKeyboard && (isGameOver || isAlreadyPlayed);
  const [isPostGameBoardExpanded, setIsPostGameBoardExpanded] = useState(false);
  const isWon = guesses.some((g) => g.length === wordLength && g.every((r) => r.status === 'correct'));

  return (
    <div className="mobile-gameplay-layout flex-1 flex flex-col justify-between min-h-0 w-full px-1.5 pb-1 gap-1.5">
      {/* 1. Active Playing Mode */}
      {!isFinished && (
        <>
          <div
            ref={containerRef as any}
            className="flex-1 flex flex-col items-center justify-center min-h-0 w-full relative overflow-y-auto scrollbar-hide"
          >
            <div className="relative grid-wrapper-parent shrink-0 py-1">
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
                onClearRow={onClearRow}
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

          <div ref={keyboardRef as any} className="w-full max-w-[500px] mx-auto pb-0.5 shrink-0 px-1">
            <Keyboard
              onChar={onChar}
              onDelete={onDelete}
              onEnter={onEnter}
              letterStatuses={keyboardStatuses}
              gameplayType="regular"
              wordLength={wordLength}
            />
          </div>
        </>
      )}

      {/* 2. Post-Game Completed Mode (Scrollable Stream with Generous Overflow) */}
      {isFinished && (
        <div
          ref={containerRef as any}
          className="flex-1 min-h-0 w-full overflow-y-auto scrollbar-thin flex flex-col items-center justify-start gap-3 px-1 pt-1 pb-4"
        >
          {/* Collapsible Victory Board Card (Collapsed by default on mobile post-game) */}
          <div className="shrink-0 w-full max-w-sm flex flex-col items-center bg-slate-900/60 border border-white/10 rounded-2xl p-2.5 shadow-lg backdrop-blur-md">
            <button
              type="button"
              onClick={() => setIsPostGameBoardExpanded((prev) => !prev)}
              className="w-full flex items-center justify-between px-2 py-1 text-left"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${isWon ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                  {isWon ? `${guesses.length}/${maxAttempts}` : 'X/' + maxAttempts}
                </span>
                <span className="text-sm font-bold text-white uppercase tracking-wide truncate">
                  {targetWord}
                </span>
              </div>
              <span className="flex items-center gap-1 text-xs font-semibold text-gray-400 shrink-0">
                {isPostGameBoardExpanded ? 'Hide Grid' : 'View Grid'}
                {isPostGameBoardExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </span>
            </button>

            {isPostGameBoardExpanded && (
              <div className="mt-2 pt-2 border-t border-white/10 w-full flex flex-col items-center gap-3">
                <NewGrid
                  wordLength={wordLength}
                  maxAttempts={maxAttempts}
                  guesses={guesses}
                  currentGuess={currentGuess}
                  cursorIndex={cursorIndex}
                  editIndex={editIndex}
                  hintRecord={hintRecord}
                  isShake={isShake}
                  compact={true}
                  gameplayType={gameplayType}
                  onSetCursor={onSetCursor}
                  onSetEditIndex={onSetEditIndex}
                  maxGridWidth={Math.min(gridDimensions.maxWidth, 240)}
                  maxGridHeight={180}
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
                <div className="w-full">
                  <ShareCard
                    date={date || new Date().toISOString().split('T')[0]}
                    guesses={guesses}
                    maxAttempts={maxAttempts}
                    won={isWon}
                    usedHint={!!usedHint}
                    gameMessage={gameMessage}
                    wordLength={wordLength}
                    hintRecord={hintRecord}
                    isAuthenticated={gameplayType !== 'guest'}
                    showGrid={false}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Post-Game Hub Cards */}
          <div className="w-full max-w-sm">
            <PostGameHub
              word={targetWord}
              guesses={guesses}
              maxAttempts={maxAttempts}
              isWon={guesses.some((g) => g.length === wordLength && g.every((r) => r.status === 'correct'))}
              usedHint={!!usedHint}
              gameMessage={gameMessage}
              date={date || new Date().toISOString().split('T')[0]}
              hintRecord={hintRecord}
              onNavigate={onNavigate || (() => { })}
              onOpenFreePlay={onOpenFreePlay}
              activeDailyMarathons={activeDailyMarathons}
              isMarathonLoading={isMarathonLoading}
              isMarathonError={isMarathonError}
              setSelectedChallengeId={setSelectedChallengeId}
              setIsChallengeOpen={setIsChallengeOpen}
              gameplayType={gameplayType}
              onClose={onClose}
              hideShareCard={true}
            />
          </div>
        </div>
      )}
    </div>
  );
};