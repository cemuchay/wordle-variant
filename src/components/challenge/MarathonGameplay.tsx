/* eslint-disable @typescript-eslint/no-explicit-any */
import { memo, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Clock, Lock, Play } from 'lucide-react';
import { ProtectedAvatar } from '../chat/ProtectedAvatar';
import { RegularGameplay } from './RegularGameplay';
import { formatTime } from './lib';
import { useChallengeContext } from '../../context/ChallengeContext';
import { useApp } from '../../context/AppContext';
import { MAX_ATTEMPTS, SHAPESHIFTER_MAX_ATTEMPTS, BOT_MARATHON_WORD_LENGTHS } from '../../constants/game';
import { DAILY_CONFIG } from '../../constants/marathon';
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
                <ProtectedAvatar userId={p.user_id || p.guest_id || p.profiles?.id} src={p.profiles.avatar_url} username={p.profiles.username} className="w-full h-full object-cover" />
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
    dayTheme?: (typeof DAILY_CONFIG)[number] | null;
}

const MarathonLengthItem = memo(function MarathonLengthItem({
    game, index, prog, challenge, finishers, onSelect, onPreview, isUnlocked, lockReason, dayTheme
}: MarathonLengthItemProps) {
    const effectiveMaxAttempts = challenge.is_shapeshifter ? 20 : MAX_ATTEMPTS;
    const isCompleted = prog?.status === 'completed';
    const isFailed = prog?.status === 'timed_out' || (prog?.attempts >= effectiveMaxAttempts && !isCompleted);
    const isFinished = isCompleted || isFailed;

    const itemHoverFinished = dayTheme ? `${dayTheme.hoverBorder} ${dayTheme.glow.replace('bg-', 'hover:bg-')}` : 'hover:border-correct/50 hover:bg-correct/5';
    const itemHoverUnfinished = dayTheme ? `${dayTheme.hoverBorder} ${dayTheme.glow.replace('bg-', 'hover:bg-')}` : 'hover:border-yellow-500 hover:bg-yellow-500/5';

    return (
        <div className="flex flex-col gap-2">
            <button
                disabled={!isUnlocked}
                onClick={() => onSelect(index, isFinished)}
                className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${!isUnlocked ? 'bg-white/2 border-white/5 opacity-40 cursor-not-allowed' : isFinished ? `bg-white/5 border-white/10 ${itemHoverFinished}` : `bg-white/5 border-white/10 ${itemHoverUnfinished}`}`}
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
                        <p className="text-[10px] font-black uppercase text-gray-400">{prog.attempts}/{effectiveMaxAttempts} Tries</p>
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
    const { date: appDate } = useApp();
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
            return [...BOT_MARATHON_WORD_LENGTHS].map((len, idx) => {
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
        if (!appDate) return 1;
        try {
            // Parse challenge creation date formatted to Africa/Lagos timezone (YYYY-MM-DD)
            const createdLagos = new Intl.DateTimeFormat("en-CA", {
                timeZone: "Africa/Lagos",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
            }).format(new Date(challenge.created_at));

            const createdDate = new Date(createdLagos + "T00:00:00");
            const currentDate = new Date(appDate + "T00:00:00");
            const diffMs = currentDate.getTime() - createdDate.getTime();
            return Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1);
        } catch (e) {
            console.error("Failed to compute calendar currentDay", e);
            const created = new Date(challenge.created_at).getTime();
            const elapsedHours = (Date.now() - created) / (1000 * 60 * 60);
            return Math.floor(elapsedHours / 24) + 1;
        }
    }, [challenge.created_at, appDate]);

    // Active day tab state for daily bot challenges (Day 1, Day 2 etc., or 'all')
    const [activeDayTab, setActiveDayTab] = useState<'all' | number>(() => {
        if (challenge.is_bot_marathon) {
            if (appDate) {
                try {
                    const createdLagos = new Intl.DateTimeFormat("en-CA", {
                        timeZone: "Africa/Lagos",
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                    }).format(new Date(challenge.created_at));

                    const createdDate = new Date(createdLagos + "T00:00:00");
                    const currentDate = new Date(appDate + "T00:00:00");
                    const diffMs = currentDate.getTime() - createdDate.getTime();
                    const day = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1);

                    const created = new Date(challenge.created_at).getTime();
                    const expires = new Date(challenge.expires_at).getTime();
                    const diffHours = (expires - created) / (1000 * 60 * 60);
                    const totalDays = Math.max(1, Math.round(diffHours / 24));

                    return Math.min(day, totalDays);
                } catch (e) {
                    console.error("Failed to compute calendar currentDay inside initializer", e);
                }
            }
            return 1;
        }
        return 'all';
    });

    const dayTheme = useMemo(() => challenge.is_bot_marathon ? DAILY_CONFIG[new Date().getDay()] : null, []);

    // Sub-filtering tabs state (All, Unplayed, Played)
    const [subFilter, setSubFilter] = useState<'all' | 'unplayed' | 'played'>('all');

    const hasInitializedTabRef = useRef(false);

    useEffect(() => {
        if (!challenge.is_bot_marathon || marathonGames.length === 0 || hasInitializedTabRef.current) return;

        const baseSequenceLength = Math.max(1, Math.floor(marathonGames.length / numDays));
        
        for (let d = 1; d <= currentDay; d++) {
            const dayGamesRangeStart = (d - 1) * baseSequenceLength;
            const dayGamesRangeEnd = Math.min(marathonGames.length, d * baseSequenceLength);
            
            let hasUnfinished = false;
            for (let idx = dayGamesRangeStart; idx < dayGamesRangeEnd; idx++) {
                const prog = participation.marathon_progress?.find((p: any) => p.game_index === idx);
    const effectiveMaxAttempts = challenge.is_shapeshifter ? SHAPESHIFTER_MAX_ATTEMPTS : MAX_ATTEMPTS;
                const isCompleted = prog?.status === 'completed';
                const isFailed = prog?.attempts >= effectiveMaxAttempts && !isCompleted;
                const isFinished = isCompleted || isFailed || prog?.status === 'timed_out';
                
                if (!isFinished) {
                    hasUnfinished = true;
                    break;
                }
            }
            if (hasUnfinished) {
                setActiveDayTab(d);
                hasInitializedTabRef.current = true;
                return;
            }
        }
        
        setActiveDayTab(currentDay);
        hasInitializedTabRef.current = true;
    }, [challenge.is_bot_marathon, marathonGames, participation.marathon_progress, numDays, currentDay, challenge.is_shapeshifter]);

    // Compute basic statuses sequentially to build an enhanced list of games
    const gamesWithMetadata = useMemo(() => {
        const results: any[] = [];
        for (let idx = 0; idx < marathonGames.length; idx++) {
            const game = marathonGames[idx];
            const prog = participation.marathon_progress?.find((p: any) => p.game_index === idx);
    const effectiveMaxAttempts = challenge.is_shapeshifter ? SHAPESHIFTER_MAX_ATTEMPTS : MAX_ATTEMPTS;
            const isCompleted = prog?.status === 'completed';
            const isFailed = prog?.status === 'timed_out' || (prog?.attempts >= effectiveMaxAttempts && !isCompleted);
            const isFinished = isCompleted || isFailed;

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
                const prev = results[idx - 1];
                if (!prev || !prev.isFinished) {
                    isUnlocked = false;
                    lockReason = 'Locked (Play games in order)';
                }
            }

            results.push({
                ...game,
                idx,
                prog,
                isCompleted,
                isFailed,
                isFinished,
                isUnlocked,
                lockReason
            });
        }
        return results;
    }, [marathonGames, participation.marathon_progress, challenge.is_bot_marathon, challenge.marathon_force_order, numDays, currentDay]);

    // Compute stats/counts for sub-filters dynamically based on active day tab selection
    const counts = useMemo(() => {
        let list = gamesWithMetadata;
        if (challenge.is_bot_marathon && activeDayTab !== 'all') {
            const baseSequenceLength = Math.max(1, Math.floor(marathonGames.length / numDays));
            list = list.filter(g => {
                const gameDay = Math.floor(g.idx / baseSequenceLength) + 1;
                return gameDay === activeDayTab;
            });
        }
        const total = list.length;
        const unplayed = list.filter(g => !g.isFinished).length;
        const played = list.filter(g => g.isFinished).length;
        return { total, unplayed, played };
    }, [gamesWithMetadata, challenge.is_bot_marathon, activeDayTab, marathonGames.length, numDays]);

    // Apply Day filters and sub-filters to get current games view
    const filteredGames = useMemo(() => {
        let list = gamesWithMetadata;

        // 1. Day filter (only for daily challenges)
        if (challenge.is_bot_marathon && activeDayTab !== 'all') {
            const baseSequenceLength = Math.max(1, Math.floor(marathonGames.length / numDays));
            list = list.filter(g => {
                const gameDay = Math.floor(g.idx / baseSequenceLength) + 1;
                return gameDay === activeDayTab;
            });
        }

        // 2. Sub-filter
        if (subFilter === 'unplayed') {
            list = list.filter(g => !g.isFinished);
        } else if (subFilter === 'played') {
            list = list.filter(g => g.isFinished);
        }

        return list;
    }, [gamesWithMetadata, challenge.is_bot_marathon, activeDayTab, subFilter, marathonGames.length, numDays]);

    // Split games into Featured ("Next Up" unplayed game), remaining queue (unplayed), and completed/timed out (played)
    const { featuredGame, remainingUnplayed, playedGames } = useMemo(() => {
        let featuredGame: any = null;
        const remainingUnplayed: any[] = [];
        const playedGames: any[] = [];

        // Global next up eligible unplayed game
        const globalNextUp = gamesWithMetadata.find(g => g.isUnlocked && !g.isFinished);

        filteredGames.forEach(g => {
            if (g.isFinished) {
                playedGames.push(g);
            } else {
                if (globalNextUp && g.idx === globalNextUp.idx) {
                    featuredGame = g;
                } else {
                    remainingUnplayed.push(g);
                }
            }
        });

        return { featuredGame, remainingUnplayed, playedGames };
    }, [filteredGames, gamesWithMetadata]);

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
                <h3 className={`text-xl font-black uppercase tracking-tighter ${dayTheme ? dayTheme.textAccent : 'text-white'}`}>{dayTheme ? dayTheme.title : 'Marathon Mode'}</h3>
                <p className="text-gray-500 text-xs">{dayTheme ? dayTheme.description : 'Complete all lengths to finish the challenge.'}</p>
            </div>

            {/* Daily Challenge - Day Tabs Navigation */}
            {challenge.is_bot_marathon && (
                <div className="flex flex-wrap bg-white/5 p-1 rounded-xl border border-white/10 gap-1 shrink-0">
                    <button
                        onClick={() => {
                            setActiveDayTab('all');
                            setSubFilter('all');
                        }}
                        className={`px-3 py-1.5 text-center text-[10px] font-black uppercase tracking-widest rounded-lg transition-all cursor-pointer ${activeDayTab === 'all'
                            ? `${dayTheme ? dayTheme.accent : 'bg-correct'} text-black font-extrabold shadow-md`
                            : "text-white/70 hover:text-white hover:bg-white/5"
                            }`}
                    >
                        All Days
                    </button>
                    {Array.from({ length: numDays }, (_, i) => i + 1).map((dayNum) => (
                        <button
                            key={dayNum}
                            onClick={() => {
                                setActiveDayTab(dayNum);
                                setSubFilter('all');
                            }}
                            className={`px-3 py-1.5 text-center text-[10px] font-black uppercase tracking-widest rounded-lg transition-all cursor-pointer ${activeDayTab === dayNum
                                ? `${dayTheme ? dayTheme.accent : 'bg-correct'} text-black font-extrabold shadow-md`
                                : "text-white/70 hover:text-white hover:bg-white/5"
                                }`}
                        >
                            Day {dayNum} {dayNum === currentDay && "•"}
                        </button>
                    ))}
                </div>
            )}

            {/* Sub-Filters Tabs: All, Unplayed, Played */}
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 gap-1 shrink-0">
                {(['all', 'unplayed', 'played'] as const).map((filter) => {
                    const count = filter === 'all' ? counts.total : filter === 'unplayed' ? counts.unplayed : counts.played;
                    return (
                        <button
                            key={filter}
                            onClick={() => setSubFilter(filter)}
                            className={`flex-1 py-1.5 text-center text-[10px] font-black uppercase tracking-widest rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${subFilter === filter
                                ? "bg-white/10 text-white font-extrabold border border-white/5"
                                : "text-white/60 hover:text-white hover:bg-white/5"
                                }`}
                        >
                            <span>{filter}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full shrink-0 font-bold">
                                {"("} {count}{")"}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Games Listing Container */}
            <div className="flex flex-col gap-4">
                {/* 1. Featured Next Up Game */}
                {(subFilter === 'all' || subFilter === 'unplayed') && featuredGame && (
                    <div className="space-y-2 mb-4 animate-in fade-in duration-200">
                        <h4 className={`text-[9px] font-black uppercase tracking-wider ${dayTheme ? dayTheme.textAccent : 'text-yellow-500'} flex items-center gap-1.5 pl-1`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${dayTheme ? dayTheme.accent : 'bg-yellow-500'} animate-ping`} />
                            Next Playable Game
                        </h4>
                        <div className={`relative group overflow-hidden rounded-2xl border ${dayTheme ? dayTheme.border : 'border-yellow-500/30'} ${dayTheme ? `bg-gradient-to-br ${dayTheme.bg}` : 'bg-linear-to-r from-yellow-500/10 to-transparent'} p-4 sm:p-5 transition-all ${dayTheme ? dayTheme.hoverBorder : 'hover:border-yellow-500/50'}`}>
                            <div className={`absolute top-0 right-0 w-24 h-24 ${dayTheme ? dayTheme.glow : 'bg-yellow-500/5'} blur-2xl -mr-8 -mt-8 pointer-events-none`} />
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black ${dayTheme ? dayTheme.accent : 'bg-yellow-500'} text-black text-lg shadow-lg ${dayTheme ? dayTheme.shadowAccent : 'shadow-yellow-500/20'}`}>
                                        {featuredGame.wordLength}
                                    </div>
                                    <div className="text-left">
                                        <p className="text-sm font-black uppercase text-white tracking-tight">Game #{featuredGame.idx + 1} ({featuredGame.wordLength}L)</p>
                                        <p className={`text-[10px] ${dayTheme ? dayTheme.textAccent + '/80' : 'text-yellow-500/80'} font-black uppercase tracking-wider`}>
                                            {featuredGame.prog ? 'In Progress' : 'Ready to Play'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleSelect(featuredGame.idx, false)}
                                    className={`${dayTheme ? dayTheme.accent : 'bg-yellow-500'} ${dayTheme ? dayTheme.accentHover : 'hover:bg-yellow-600'} text-black px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-lg ${dayTheme ? dayTheme.shadowAccent : 'shadow-yellow-500/20'}`}
                                >
                                    Play <Play size={12} fill="currentColor" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. Unplayed Queue / Other games */}
                <div className="grid grid-cols-1 gap-2.5">
                    {remainingUnplayed.length > 0 && (
                        <>
                            {subFilter === 'all' && featuredGame && (
                                <div className="flex items-center gap-4 my-1.5">
                                    <span className="text-[9px] font-black uppercase tracking-wider text-gray-500 whitespace-nowrap pl-1">
                                        Locked & Remaining Games
                                    </span>
                                    <div className="h-px bg-white/5 flex-1" />
                                </div>
                            )}
                            {remainingUnplayed.map((g) => (
                                <MarathonLengthItem
                                    key={g.idx}
                                    game={g}
                                    index={g.idx}
                                    prog={g.prog}
                                    challenge={challenge}
                                    finishers={finishersByGameIndex[g.idx] || []}
                                    onSelect={handleSelect}
                                    onPreview={handlePreview}
                                    isUnlocked={g.isUnlocked}
                                    lockReason={g.lockReason}
                                    dayTheme={dayTheme}
                                />
                            ))}
                        </>
                    )}

                    {/* 3. Played/Timed Out Divider & Items */}
                    {playedGames.length > 0 && (
                        <>
                            {(subFilter === 'all' || remainingUnplayed.length > 0 || featuredGame) && (
                                <div className="flex items-center gap-4 mt-3 mb-1.5">
                                    <span className="text-[9px] font-black uppercase tracking-wider text-gray-500 whitespace-nowrap pl-1">
                                        Completed & Timed Out
                                    </span>
                                    <div className="h-px bg-white/5 flex-1" />
                                </div>
                            )}
                            {playedGames.map((g) => (
                                <MarathonLengthItem
                                    key={g.idx}
                                    game={g}
                                    index={g.idx}
                                    prog={g.prog}
                                    challenge={challenge}
                                    finishers={finishersByGameIndex[g.idx] || []}
                                    onSelect={handleSelect}
                                    onPreview={handlePreview}
                                    isUnlocked={g.isUnlocked}
                                    lockReason={g.lockReason}
                                    dayTheme={dayTheme}
                                />
                            ))}
                        </>
                    )}

                    {/* Empty State */}
                    {filteredGames.length === 0 && (
                        <div className="py-12 text-center text-white/40 text-xs font-black uppercase tracking-wider">
                            No games match this filter.
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between shrink-0">
                <div>
                    <p className="text-[10px] text-gray-500 uppercase font-black">Total Score</p>
                    <p className="text-2xl font-black text-correct">{participation.score || 0}</p>
                </div>
                <button
                    onClick={onFinish}
                    className="bg-white/5 border border-white/10 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-colors cursor-pointer"
                >
                    Exit to Lobby
                </button>
            </div>
        </div>
    );
});
