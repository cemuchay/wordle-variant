/* eslint-disable @typescript-eslint/no-explicit-any */
import { memo, useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';

export const ChallengeSkeleton = memo(() => (
    <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map(i => (
            <div key={i} className="bg-white/5 border border-white/5 p-4 rounded-2xl h-24" />
        ))}
    </div>
));

export const ErrorFallback = memo(({ message, onRetry }: { message: string, onRetry: () => void }) => (
    <div className="py-12 text-center">
        <div className="bg-red-500/10 text-red-500 p-4 rounded-2xl border border-red-500/20 mb-4 mx-6">
            <p className="text-sm font-bold">{message}</p>
        </div>
        <button
            onClick={onRetry}
            className="bg-white text-black px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition-colors"
        >
            Try Again
        </button>
    </div>
));

export const ExpirationTimer = memo(({ expiresAt, createdAt }: { expiresAt: string, createdAt: string }) => {
    const [timeLeft, setTimeLeft] = useState<number>(0);

    useEffect(() => {
        const calculate = () => {
            const now = new Date().getTime();
            const end = new Date(expiresAt).getTime();
            setTimeLeft(Math.max(0, end - now));
        };
        calculate();
        const interval = setInterval(calculate, 60000); // Update every minute
        return () => clearInterval(interval);
    }, [expiresAt]);

    if (timeLeft <= 0) return <span className="text-red-500 text-[10px] font-black uppercase">Expired</span>;

    const totalDuration = new Date(expiresAt).getTime() - new Date(createdAt).getTime();
    const percent = (timeLeft / totalDuration) * 100;

    let colorClass = 'bg-correct'; // Green
    let textClass = 'text-correct';
    if (percent < 25) {
        colorClass = 'bg-red-500';
        textClass = 'text-red-500';
    } else if (percent < 50) {
        colorClass = 'bg-yellow-500';
        textClass = 'text-yellow-500';
    }

    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

    return (
        <div className="flex flex-col items-end gap-1">
            <span className={`${textClass} text-[10px] font-black uppercase tracking-widest flex items-center gap-1`}>
                <span className={`w-1.5 h-1.5 rounded-full ${colorClass} animate-pulse`} />
                {hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`} left
            </span>
            <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percent}%` }}
                    className={`h-full ${colorClass}`}
                />
            </div>
        </div>
    );
});

export const ChallengeItem = memo(({ item, user, onSelect }: { item: any, user: any, onSelect: (id: string) => void }) => {
    const isExpired = useMemo(() => new Date(item.challenge.expires_at) < new Date(), [item.challenge.expires_at]);
    const isFinished = useMemo(() => item.status === 'completed' || item.status === 'timed_out' || item.status === 'declined', [item.status]);
    const hasActiveParticipants = useMemo(() =>
        item.challenge.participants?.some((p: any) => p.status === 'pending' || p.status === 'playing'),
        [item.challenge.participants]
    );

    return (
        <button
            onClick={() => onSelect(item.challenge_id)}
            className="w-full text-left bg-white/5 border border-white/5 p-4 rounded-2xl hover:border-white/20 transition-all group"
        >
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${(isFinished || isExpired) ? 'bg-gray-600' : 'bg-correct pulse'}`} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                        {item.challenge.mode} • {item.challenge.word_length === 1 ? 'Marathon' : item.challenge.word_length + ' Letters'}
                    </span>
                </div>
                {!isExpired && hasActiveParticipants && (
                    <ExpirationTimer expiresAt={item.challenge.expires_at} createdAt={item.challenge.created_at} />
                )}
                {isExpired && <span className="text-red-500 text-[10px] font-black uppercase">Expired</span>}
            </div>
            <div className="flex items-end justify-between">
                <div>
                    <div className="font-bold text-sm flex flex-wrap items-center gap-1.5">
                        <div className="flex items-center gap-1">
                            <span>Me</span>
                            {item.status !== 'pending' && <span className="text-correct text-[10px] font-black">({item.score})</span>}
                        </div>
                        <span className="text-[10px] text-gray-500 uppercase font-black">vs</span>
                        <div className="flex flex-wrap items-center gap-1">
                            {item.challenge.participants?.filter((p: any) => p.user_id !== user?.id).length > 0 ? (
                                item.challenge.participants
                                    .filter((p: any) => p.user_id !== user?.id)
                                    .map((p: any, idx: number, arr: any[]) => {
                                        const isCreator = p.user_id === item.challenge.creator_id;
                                        const hasScore = p.status !== 'pending';
                                        return (
                                            <span key={p.id} className={`${isCreator ? "text-correct" : "text-white"} flex items-center gap-1`}>
                                                {p.profiles?.username || 'Unknown'}
                                                {hasScore && <span className="text-[10px] opacity-70 font-black">({p.score})</span>}
                                                {idx < arr.length - 1 ? ', ' : ''}
                                            </span>
                                        );
                                    })
                            ) : (
                                <span className="text-white">Waiting for players...</span>
                            )}
                        </div>
                    </div>
                    <p className="text-[10px] text-gray-500 uppercase font-black mt-0.5">{item.status}</p>
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest text-gray-700">
                    {new Date(item.challenge.created_at).toLocaleDateString()}
                </span>
            </div>
        </button>
    );
});
