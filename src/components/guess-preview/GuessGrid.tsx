/* eslint-disable @typescript-eslint/no-explicit-any */
import { memo } from 'react';
import { getTileSizeClass } from './types';
import { GuessReactionsComments } from './GuessReactionsComments';

interface GuessGridProps {
    guesses: any[];
    breakdown: any;
    canSeeDetails: boolean;
    targetWordLength: number;
    targetUserId: string;
    gameDate: string;
    commentsDisabledByTarget: boolean;
}

export const GuessGrid = memo(({
    guesses,
    breakdown,
    canSeeDetails,
    targetWordLength,
    targetUserId,
    gameDate,
    commentsDisabledByTarget,
}: GuessGridProps) => {
    return (
        <div className="grid gap-4 mb-6 justify-center w-full">
            {guesses.map((row: any[], i: number) => {
                const rowScore = breakdown.rows[i];
                const rowDecisions = breakdown?.decisions?.[i]?.decisions;

                if (!rowDecisions) {
                    return (
                        <div key={i}>
                            <h4>Row {i + 1}</h4>
                            <p>{rowScore}</p>
                            <p>No breakdown available</p>
                        </div>
                    );
                }

                return (
                    <div
                        key={i}
                        className="flex flex-col gap-2 p-3 bg-white/5 rounded-xl border border-white/10 w-full max-w-xs mx-auto"
                    >
                        <div className="flex items-center gap-3 justify-between">
                            <div className="flex gap-1">
                                {row.map((cell: any, j: number) => (
                                    <div
                                        key={j}
                                        className={`flex items-center justify-center font-black uppercase shadow-inner ${getTileSizeClass(targetWordLength)} ${cell.status === "correct"
                                            ? "bg-correct text-white"
                                            : cell.status === "present"
                                                ? "bg-present text-white"
                                                : "bg-gray-800 text-white border border-gray-700"
                                            }`}
                                    >
                                        {canSeeDetails ? cell.letter : ""}
                                    </div>
                                ))}
                            </div>
                            <div
                                className={`text-[12px] font-mono font-black px-2 py-0.5 rounded-full ${rowScore >= 0 ? "bg-correct/20 text-correct" : "bg-red-500/20 text-red-400"}`}
                            >
                                {rowScore > 0 ? `+${rowScore}` : rowScore}
                            </div>
                        </div>

                        {rowDecisions && rowDecisions.length > 0 && (
                            <div className="grid grid-cols-1 gap-1 pt-2 border-t border-white/5">
                                {rowDecisions.map((dec: any, idx: number) => (
                                    <div
                                        key={idx}
                                        className="flex justify-between items-center text-[7px] sm:text-[8px] font-bold uppercase tracking-tighter italic"
                                    >
                                        <span className="text-slate-200">
                                            Letter{" "}
                                            <span className="text-slate-200">
                                                {canSeeDetails ? dec.letter : "?"}
                                            </span>
                                            : {dec.status}
                                        </span>
                                        {dec.pointDeduction !== 0 && (
                                            <span
                                                className={
                                                    dec.pointDeduction > 0
                                                        ? "text-correct"
                                                        : "text-red-400"
                                                }
                                            >
                                                {dec.pointDeduction > 0
                                                    ? `+${dec.pointDeduction}`
                                                    : dec.pointDeduction}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Guess reactions and comments section */}
                        {targetUserId && gameDate && (
                            <div className="pt-2 border-t border-white/5 w-full">
                                <GuessReactionsComments
                                    targetUserId={targetUserId}
                                    gameDate={gameDate}
                                    guessIndex={i}
                                    commentsDisabledByTarget={commentsDisabledByTarget}
                                />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
});