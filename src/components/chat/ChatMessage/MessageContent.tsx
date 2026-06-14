/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from 'react';
import type { JSX } from "react";
import { calculateSkillIndex } from '../../../lib/game-logic';
import { MENTION_COLORS, URL_REGEX } from './constants';

interface MessageContentProps {
    content: string;
    isMe: boolean;
    users: { username: string; avatar_url: string; id: string }[];
    dailyGuesses?: any[];
    currentUserId: string;
}

export const MessageContent = ({ content, isMe, users, dailyGuesses, currentUserId }: MessageContentProps) => {
    return useMemo(() => {
        if (!content) return null;

        // Render Guess tag inline
        const guessMatch = content.match(/\[guess:([a-zA-Z0-9-_]+)\]/);
        if (guessMatch && dailyGuesses) {
            const guessIdentifier = guessMatch[1];
            // Find by user_id OR profiles.username (case-insensitive)
            const guessData = dailyGuesses.find(dg =>
                dg.user_id === guessIdentifier ||
                dg.profiles?.username?.toLowerCase() === guessIdentifier.toLowerCase()
            );
            if (guessData) {
                const username = guessData.profiles?.username || "Player";
                const won = guessData.status === "won";
                const attempts = won ? guessData.guesses.length : "X";

                // Security check: only show letters/points if it's our own board, OR we have played today's game
                const isOwner = guessData.user_id === currentUserId;
                const viewerGuess = dailyGuesses.find(dg => dg.user_id === currentUserId);
                const viewerHasPlayed = viewerGuess?.status === "won" || viewerGuess?.status === "lost";
                const showDetails = isOwner || viewerHasPlayed;

                if (showDetails) {
                    const breakdown = calculateSkillIndex({
                        attempts: guessData.guesses.length || 0,
                        maxAttempts: 6,
                        guesses: guessData.guesses || [],
                        usedHint: guessData.hint_record !== null,
                        hintRecord: guessData.hint_record || null,
                    });

                    const grid = guessData.guesses.map((row: any[], rIdx: number) => {
                        const rowScore = breakdown.rows[rIdx];
                        return (
                            <div key={rIdx} className="flex gap-3 items-center justify-between w-full">
                                <div className="flex gap-1">
                                    {row.map((cell: any, cIdx: number) => (
                                        <div
                                            key={cIdx}
                                            className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black uppercase shadow-inner ${cell.status === "correct"
                                                ? "bg-correct text-white"
                                                : cell.status === "present"
                                                    ? "bg-present text-white"
                                                    : "bg-gray-800 text-gray-400 border border-gray-700"
                                                }`}
                                        >
                                            {cell.letter}
                                        </div>
                                    ))}
                                </div>
                                <div
                                    className={`text-[9px] font-mono font-black px-1.5 py-0.5 rounded-full shrink-0 ${rowScore >= 0 ? "bg-correct/20 text-correct" : "bg-red-500/20 text-red-400"}`}
                                >
                                    {rowScore > 0 ? `+${rowScore}` : rowScore}
                                </div>
                            </div>
                        );
                    });

                    return (
                        <div className="bg-black/40 border border-white/10 rounded-2xl p-4 my-2 text-center shadow-inner max-w-full w-[260px] mx-auto">
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-[10px] font-black uppercase text-correct tracking-wider">
                                    🎯 {username}'s Guess Board
                                </span>
                                <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-correct text-black rounded-full select-none">
                                    Score: {guessData.skill_score || 0}
                                </span>
                            </div>
                            <div className="flex flex-col gap-1.5 bg-black/20 p-2.5 rounded-xl">
                                {grid}
                            </div>
                        </div>
                    );
                } else {
                    // Hide letters/points to prevent peeking
                    const grid = guessData.guesses.map((row: any[], rIdx: number) => (
                        <div key={rIdx} className="flex gap-0.5 justify-center">
                            {row.map((cell: any, cIdx: number) => (
                                <div
                                    key={cIdx}
                                    className={`w-3.5 h-3.5 rounded-sm ${cell.status === "correct"
                                        ? "bg-correct"
                                        : cell.status === "present"
                                            ? "bg-present"
                                            : "bg-gray-700/50"
                                        }`}
                                />
                            ))}
                        </div>
                    ));

                    return (
                        <div className="bg-black/40 border border-white/10 rounded-2xl p-4 my-2 text-center shadow-inner max-w-full">
                            <p className="text-[10px] font-black uppercase text-correct tracking-wider mb-3">
                                🎯 {username}'s Guess Board ({attempts}/6)
                            </p>
                            <div className="flex flex-col gap-0.5 bg-black/20 p-3 rounded-xl inline-block">
                                {grid}
                            </div>
                            <p className="text-[9px] font-bold text-white/40 mt-2">
                                🔒 Play daily to reveal letters & points
                            </p>
                        </div>
                    );
                }
            }
        }

        const sortedUsers = [...users].sort((a, b) => b.username.length - a.username.length);
        let parts: (string | JSX.Element)[] = [content];

        // Handle Mentions
        sortedUsers.forEach((user) => {
            const userIndex = users.findIndex(u => u.username === user.username);
            const color = MENTION_COLORS[userIndex % MENTION_COLORS.length];
            const mention = `@${user.username}`;

            const newParts: (string | JSX.Element)[] = [];
            parts.forEach((part, pIdx) => {
                if (typeof part !== 'string') {
                    newParts.push(part);
                    return;
                }

                const subParts = part.split(new RegExp(`(${mention}(?:\\s|$))`, 'g'));
                subParts.forEach((subPart, sIdx) => {
                    if (subPart.startsWith(mention)) {
                        const endsWithSpace = subPart.endsWith(' ');
                        const cleanMention = endsWithSpace ? subPart.slice(0, -1) : subPart;

                        newParts.push(
                            <span
                                key={`mention-${user.username}-${pIdx}-${sIdx}`}
                                className={`inline-block px-1.5 py-0.5 rounded-md text-[12px] font-black transition-all`}
                                style={{
                                    backgroundColor: `${color}33`,
                                    color: isMe ? '#fff' : color,
                                    border: `1px solid ${color}20`
                                }}
                            >
                                {cleanMention}
                            </span>
                        );
                        if (endsWithSpace) newParts.push(' ');
                    } else if (subPart !== '') {
                        newParts.push(subPart);
                    }
                });
            });
            parts = newParts;
        });

        // Handle URLs
        const finalParts: (string | JSX.Element)[] = [];
        parts.forEach((part, pIdx) => {
            if (typeof part !== 'string') {
                finalParts.push(part);
                return;
            }

            const subParts = part.split(URL_REGEX);
            subParts.forEach((subPart, sIdx) => {
                if (URL_REGEX.test(subPart)) {
                    finalParts.push(
                        <a
                            key={`url-${pIdx}-${sIdx}`}
                            href={subPart}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`underline break-all transition-colors ${isMe ? 'text-white hover:text-white/80' : 'text-correct hover:text-correct/80'}`}
                        >
                            {subPart}
                        </a>
                    );
                } else if (subPart !== '') {
                    finalParts.push(subPart);
                }
            });
        });

        return finalParts;
    }, [content, users, isMe, dailyGuesses, currentUserId]);
};
