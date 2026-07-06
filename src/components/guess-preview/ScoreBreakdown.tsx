/* eslint-disable @typescript-eslint/no-explicit-any */
import { memo } from 'react';
import { formatTime } from './types';

interface ScoreBreakdownProps {
    breakdown: any;
    gameData: any;
    isMarathon: boolean;
    marathonGameIndex: number;
    activeGame: any;
    canSeeDetails: boolean;
    onOpenScoringInfo: () => void;
}

export const ScoreBreakdown = memo(({
    breakdown,
    gameData,
    isMarathon,
    marathonGameIndex,
    activeGame,
    canSeeDetails,
    onOpenScoringInfo,
}: ScoreBreakdownProps) => {
    return (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-3 mb-4 space-y-2">
            <div className="flex justify-between text-[9px] uppercase font-bold text-gray-400">
                <span>Base Performance:</span>
                <span className="text-gray-100">{breakdown.base}</span>
            </div>
            {/* Hint Info */}
            {gameData?.hints_used && (
                <div className="pt-2 border-t border-gray-700/50">
                    <div className="flex justify-between text-[9px] uppercase font-bold text-yellow-500 mb-1">
                        <span>Hint Used:</span>
                        <span>{breakdown.hint}</span>
                    </div>
                    {gameData.hint_record && (
                        <div className="flex items-center gap-2 text-[8px] font-black uppercase text-gray-400 bg-yellow-500/10 p-1.5 rounded-lg border border-yellow-500/20">
                            <div className="w-5 h-5 rounded bg-yellow-500 text-black flex items-center justify-center text-[10px]">
                                {canSeeDetails ? gameData.hint_record.letter : "?"}
                            </div>
                            <span>
                                Revealed at Pos {gameData.hint_record.index + 1}
                                {gameData.hint_record.row !== undefined &&
                                    ` after row ${gameData.hint_record.row}`}
                            </span>
                        </div>
                    )}
                </div>
            )}
            <div className="flex justify-between text-[9px] uppercase font-bold text-gray-400 items-center">
                <span>Precision Bonus:</span>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onOpenScoringInfo}
                        className="text-[8px] bg-white/5 hover:bg-white/10 hover:text-white text-gray-400 px-1.5 py-0.5 rounded transition-colors flex items-center gap-0.5 cursor-pointer font-black border border-white/5 uppercase tracking-wider"
                    >
                        Rules
                    </button>
                    <span
                        className={
                            breakdown.bonus >= 0 ? "text-correct" : "text-red-400"
                        }
                    >
                        {breakdown.bonus > 0
                            ? `+${breakdown.bonus}`
                            : breakdown.bonus}
                    </span>
                </div>
            </div>

            {gameData?.time_taken !== null &&
                gameData?.time_taken !== undefined && (
                    <div className="flex justify-between text-[9px] uppercase font-bold text-gray-400">
                        <span>Time Taken:</span>
                        <span className="text-gray-100">
                            {formatTime(gameData.time_taken)}
                        </span>
                    </div>
                )}

            <div className="pt-2 mt-1 border-t border-gray-700 flex justify-between text-[11px] uppercase font-black text-gray-100">
                <span>
                    {isMarathon
                        ? `Game #${marathonGameIndex + 1} (${activeGame?.wordLength || 5}L) Score:`
                        : "Total Index:"}
                </span>
                <span className="text-white bg-correct px-2 rounded-full">
                    {gameData?.skill_score || 0}
                </span>
            </div>
        </div>
    );
});
