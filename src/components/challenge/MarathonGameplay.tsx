/* eslint-disable @typescript-eslint/no-explicit-any */
import { memo, useState, useCallback, useMemo, useEffect } from 'react';
import { Clock, Lock } from 'lucide-react';
import { RegularGameplay } from './RegularGameplay';
import { formatTime } from './lib';
import { useChallengeContext } from '../../context/ChallengeContext';
import { MAX_ATTEMPTS } from '../../constants/game';
import { parseMarathonGames, getMarathonTimer, type MarathonGame } from '../../utils/marathon';
import { supabase } from '../../lib/supabaseClient';
import { deobfuscateWord } from '../../lib/game-logic';

interface MarathonGameplayProps {
    challenge: any;
    participation: any;
    triggerToast: (msg: string, duration?: number) => void;
    submitChallengeResult: (result: any, wordLength?: number, gameIndex?: number) => Promise<boolean>;
    onFinish: () => void;
}

const FinisherAvatar = memo(function FinisherAvatar({ p, index, onPreview }: { p: any, index: number, onPreview: (p: any, index: number) => void }) {
    return (
        <button
            onClick={() => onPreview(p, index)}
            className="w-6 h-6 rounded-full border-2 border-gray-900 bg-gray-800 overflow-hidden hover:scale-110 hover:z-10 transition-transform relative group"
        >
            {p.profiles?.avatar_url ? (
                <img src={p.profiles.avatar_url} alt={p.profiles.username} className="w-full h-full object-cover" />
            ) : (
                <div className="w-full h-full flex items-center justify-center text-[8px] font-black uppercase text-gray-400">
                    {p.profiles?.username?.[0] || '?'}
                </div>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <div className="w-1 h-1 bg-white rounded-full" />
            </div>
        </button>
    );
});

interface MarathonLengthItemProps {
    game: MarathonGame;
    index: number;
    prog: any;
    challenge: any;
    finishers: any[];
    onSelect: (index: number, isFinished: boolean) => void;
    onPreview: (p: any, index: number) => void;
    isUnlocked: boolean;
    lockReason?: string;
}

const MarathonLengthItem = memo(function MarathonLengthItem({
    game, index, prog, challenge, finishers, onSelect, onPreview, isUnlocked, lockReason
}: MarathonLengthItemProps) {
    const isCompleted = prog?.status === 'completed';
    const isFailed = prog?.status === 'timed_out' || (prog?.attempts >= MAX_ATTEMPTS && !isCompleted);
    const isFinished = isCompleted || isFailed;

    return (
        <div className="flex flex-col gap-2">
            <button
                disabled={!isUnlocked}
                onClick={() => onSelect(index, isFinished)}
                className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${!isUnlocked ? 'bg-white/2 border-white/5 opacity-40 cursor-not-allowed' : isFinished ? 'bg-white/5 border-white/10 hover:border-correct/50 hover:bg-correct/5' : 'bg-white/5 border-white/10 hover:border-yellow-500 hover:bg-yellow-500/5'}`}
            >
                <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${!isUnlocked ? 'bg-white/5 text-gray-600' : isCompleted ? 'bg-correct text-black' : isFailed ? 'bg-red-500 text-white' : prog ? 'bg-yellow-500 text-black' : 'bg-white/10 text-white'}`}>
                        {!isUnlocked ? <Lock size={16} /> : game.wordLength}
                    </div>
                    <div className="text-left">
                        <p className="text-xs font-black uppercase">Game #{index + 1} ({game.wordLength}L)</p>
                        <p className="text-[10px] text-gray-500">
                            {!isUnlocked 
                                ? (lockReason || 'Locked (Play games in order)')
                                : isFinished
                                    ? (isCompleted ? 'Completed (View Results)' : 'Failed (View Results)')
                                    : (prog ? 'In Progress' : 'Not Started')}
                        </p>
                    </div>
                </div>
                {isUnlocked && !isFinished && challenge.mode === 'LIVE' && (
                    <div className="text-right">
                        <p className="text-[9px] font-black text-gray-500 uppercase flex items-center gap-1 justify-end">
                            <Clock size={10} className="text-red-500/50" /> {getMarathonTimer(challenge, index, game.wordLength)}m
                        </p>
                    </div>
                )}
                {isUnlocked && prog && (
                    <div className="text-right">
                        <p className="text-[10px] font-black uppercase text-gray-400">{prog.attempts}/{MAX_ATTEMPTS} Tries</p>
                        {challenge.mode === 'LIVE' && prog.time_taken && (
                            <p className="text-[9px] font-black text-white/30">{formatTime(prog.time_taken)}</p>
                        )}
                    </div>
                )}
            </button>

            {isFinished && finishers.length > 0 && (
                <div className="flex items-center justify-between px-2">
                    <p className="text-[9px] font-black uppercase text-gray-600">Compare Results:</p>
                    <div className="flex -space-x-2">
                        {finishers.map(p => (
                            <FinisherAvatar key={p.id} p={p} index={index} onPreview={onPreview} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
});

export const MarathonGameplay = memo(function MarathonGameplay({
    challenge, participation, triggerToast, submitChallengeResult, onFinish
}: MarathonGameplayProps) {
    const { participants, setPreviewParticipant, setPreviewMarathonGameIndex } = useChallengeContext();
    const [selectedGameIndex, setSelectedGameIndex] = useState<number | null>(null);

    const onBack = useCallback(() => setSelectedGameIndex(null), []);

    const handleSelect = useCallback((index: number, isFinished: boolean) => {
        if (isFinished) {
            setPreviewMarathonGameIndex(index);
            setPreviewParticipant(participation);
        } else {
            setSelectedGameIndex(index);
        }
    }, [participation, setPreviewMarathonGameIndex, setPreviewParticipant]);

    const handlePreview = useCallback((p: any, index: number) => {
        setPreviewMarathonGameIndex(index);
        setPreviewParticipant(p);
    }, [setPreviewMarathonGameIndex, setPreviewParticipant]);

    const [botDailyWords, setBotDailyWords] = useState<Record<number, { word: string; salt: string }>>({});

    const fetchBotDailyWords = useCallback(async () => {
        if (!challenge.is_bot_marathon || challenge.target_word !== 'MARATHON') return;
        try {
            const today = new Intl.DateTimeFormat("en-CA", {
                timeZone: "Africa/Lagos",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
            }).format(new Date());

            const { data, error } = await supabase
                .from("bot_marathon_daily_words")
                .select("*")
                .eq("play_date", today);

            if (error) throw error;

            if (data) {
                const wordsMap: Record<number, { word: string; salt: string }> = {};
                data.forEach((row: any) => {
                    wordsMap[row.word_length] = {
                        word: row.target_word,
                        salt: row.salt,
                    };
                });
                setBotDailyWords(wordsMap);
            }
        } catch (err: any) {
            console.error("Failed to fetch bot daily words:", err);
            triggerToast("Failed to fetch today's words.", 4000);
        }
    }, [challenge.is_bot_marathon, challenge.target_word, triggerToast]);

    useEffect(() => {
        if (challenge.is_bot_marathon && challenge.target_word === 'MARATHON') {
            fetchBotDailyWords();
        }
    }, [challenge.is_bot_marathon, challenge.target_word, fetchBotDailyWords]);

    const marathonGames = useMemo(() => {
        if (challenge.is_bot_marathon && challenge.target_word === 'MARATHON') {
            // For legacy bot marathon, we always show 3-7 sequence
            return [3, 4, 5, 6, 7].map((len, idx) => {
                const botData = botDailyWords[len];
                return {
                    wordLength: len,
                    gameIndex: idx,
                    word: botData ? deobfuscateWord(botData.word, botData.salt) : ""
                };
            });
        }
        return parseMarathonGames(challenge.target_word, challenge.salt);
    }, [challenge.target_word, challenge.salt, challenge.is_bot_marathon, botDailyWords]);

    // Pre-calculate finishers for each game index in a single pass O(P)
    const finishersByGameIndex = useMemo(() => {
        const map: Record<number, any[]> = {};
        marathonGames.forEach((_, idx) => {
            map[idx] = [];
        });
        if (!participants) return map;

        for (const p of participants) {
            if (p.user_id === participation.user_id) continue;
            if (!p.marathon_progress) continue;

            for (const mp of p.marathon_progress) {
                if (mp.status === 'completed' || mp.status === 'timed_out') {
                    const idx = mp.game_index;
                    if (map[idx]) {
                        map[idx].push(p);
                    }
                }
            }
        }
        return map;
    }, [participants, participation.user_id, marathonGames]);

    const numDays = useMemo(() => {
        const created = new Date(challenge.created_at).getTime();
        const expires = new Date(challenge.expires_at).getTime();
        const diffHours = (expires - created) / (1000 * 60 * 60);
        return Math.max(1, Math.round(diffHours / 24));
    }, [challenge.created_at, challenge.expires_at]);

    const currentDay = useMemo(() => {
        const created = new Date(challenge.created_at).getTime();
        const elapsedHours = (Date.now() - created) / (1000 * 60 * 60);
        return Math.floor(elapsedHours / 24) + 1;
    }, [challenge.created_at]);

    if (selectedGameIndex !== null) {
        return (
            <RegularGameplay
                challenge={challenge}
                participation={participation}
                triggerToast={triggerToast}
                submitChallengeResult={submitChallengeResult}
                onFinish={onFinish}
                gameIndex={selectedGameIndex}
                onBack={onBack}
            />
        );
    }

    return (
        <div className="flex-1 p-4 sm:p-5 flex flex-col gap-4 sm:gap-6 overflow-y-auto">
            <div className="text-center space-y-1.5 shrink-0">
                <h3 className="text-xl font-black uppercase tracking-tighter">Marathon Mode</h3>
                <p className="text-gray-500 text-xs">Complete all lengths to finish the challenge.</p>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
                {marathonGames.map((game, idx) => {
                    const prog = participation.marathon_progress?.find((p: any) => p.game_index === idx);
                    
                    let isUnlocked = true;
                    let lockReason = '';

                    if (challenge.is_bot_marathon) {
                        const baseSequenceLength = Math.max(1, Math.floor(marathonGames.length / numDays));
                        const gameDay = Math.floor(idx / baseSequenceLength) + 1;
                        if (gameDay > currentDay) {
                            isUnlocked = false;
                            lockReason = `Locked until Day ${gameDay}`;
                        }
                    }
                    
                    if (isUnlocked && challenge.marathon_force_order && idx > 0) {
                        const prevProg = participation.marathon_progress?.find((p: any) => p.game_index === idx - 1);
                        if (!prevProg) {
                            isUnlocked = false;
                            lockReason = 'Locked (Play games in order)';
                        } else {
                            const prevCompleted = prevProg.status === 'completed';
                            const prevFailed = prevProg.status === 'timed_out' || (prevProg.attempts >= MAX_ATTEMPTS && !prevCompleted);
                            if (!prevCompleted && !prevFailed) {
                                isUnlocked = false;
                                lockReason = 'Locked (Play games in order)';
                            }
                        }
                    }

                    return (
                        <MarathonLengthItem
                            key={idx}
                            game={game}
                            index={idx}
                            prog={prog}
                            challenge={challenge}
                            finishers={finishersByGameIndex[idx] || []}
                            onSelect={handleSelect}
                            onPreview={handlePreview}
                            isUnlocked={isUnlocked}
                            lockReason={lockReason}
                        />
                    );
                })}
            </div>

            <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between shrink-0">
                <div>
                    <p className="text-[10px] text-gray-500 uppercase font-black">Total Score</p>
                    <p className="text-2xl font-black text-correct">{participation.score || 0}</p>
                </div>
                <button
                    onClick={onFinish}
                    className="bg-white/5 border border-white/10 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-colors"
                >
                    Exit to Lobby
                </button>
            </div>
        </div>
    );
});
