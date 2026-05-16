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

    // Find the current high score among participants who have actually finished/played
    const participants = item.challenge.participants || [];
    const maxScore = useMemo(() => {
        const scores = participants
            .filter((p: any) => p.status !== 'pending')
            .map((p: any) => p.score || 0);
        return scores.length > 0 ? Math.max(...scores) : 0;
    }, [participants]);

    const myScore = item.score || 0;
    const isLeader = myScore === maxScore && myScore > 0;
    const hasStarted = item.status !== 'pending';

    return (
        <button
            onClick={() => onSelect(item.challenge_id)}
            className={`w-full text-left bg-gradient-to-br from-white/[0.03] to-transparent border ${isLeader && !isExpired ? 'border-correct/20' : 'border-white/5'} p-5 rounded-[2rem] hover:border-white/20 transition-all group relative overflow-hidden`}
        >
            {/* Background Glow for Leader */}
            {isLeader && !isExpired && (
                <div className="absolute top-0 right-0 w-32 h-32 bg-correct/5 blur-[40px] -mr-16 -mt-16 pointer-events-none" />
            )}

            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter ${item.challenge.mode === 'LIVE' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-correct/10 text-correct border border-correct/20'}`}>
                        {item.challenge.mode}
                    </div>
                    <div className="bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
                        <span className="text-[9px] font-black uppercase tracking-tighter text-white/50">
                            {item.challenge.word_length === 1 ? 'Marathon' : `${item.challenge.word_length} Letters`}
                        </span>
                    </div>
                </div>
                {!isExpired && !isFinished && (
                    <ExpirationTimer expiresAt={item.challenge.expires_at} createdAt={item.challenge.created_at} />
                )}
                {isExpired && <span className="text-red-500 text-[10px] font-black uppercase tracking-widest">Expired</span>}
            </div>

            <div className="grid grid-cols-1 gap-4">
                {/* Me Row */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-black text-xs ${isLeader ? 'border-correct bg-correct text-black' : 'border-white/10 text-white'}`}>
                            Me
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-gray-500">My Progress</p>
                            <p className={`text-xs font-black uppercase ${item.status === 'completed' ? 'text-correct' : item.status === 'playing' ? 'text-yellow-500' : 'text-gray-400'}`}>
                                {item.status}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black uppercase text-gray-500">Score</p>
                        <p className={`text-xl font-black ${isLeader ? 'text-correct' : hasStarted ? 'text-red-500' : 'text-white'}`}>
                            {hasStarted ? myScore : '--'}
                        </p>
                    </div>
                </div>

                <div className="h-px bg-white/5 w-full" />

                {/* Opponents Section */}
                <div className="space-y-3">
                    {participants.filter((p: any) => p.user_id !== user?.id).length > 0 ? (
                        participants.filter((p: any) => p.user_id !== user?.id).map((p: any) => {
                            const pScore = p.score || 0;
                            const isPLeader = pScore === maxScore && pScore > 0;
                            const pStarted = p.status !== 'pending';

                            return (
                                <div key={p.id} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 opacity-80">
                                        <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 overflow-hidden">
                                            {p.profiles?.avatar_url ? (
                                                <img src={p.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-[10px] font-black">
                                                    {p.profiles?.username?.substring(0, 2).toUpperCase() || '??'}
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-black text-white truncate max-w-[100px]">
                                                {p.profiles?.username || 'Unknown'}
                                            </p>
                                            <p className={`text-[9px] font-black uppercase ${p.status === 'completed' ? 'text-correct/60' : 'text-gray-500'}`}>
                                                {p.status}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-base font-black ${isPLeader ? 'text-correct' : pStarted ? 'text-red-500' : 'text-white/20'}`}>
                                            {pStarted ? pScore : '--'}
                                        </p>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <p className="text-[10px] font-black uppercase text-gray-600 text-center py-2 italic">
                            Waiting for opponents...
                        </p>
                    )}
                </div>
            </div>

            {/* Footer Date */}
            <div className="mt-4 pt-3 border-t border-white/5 flex justify-end">
                <span className="text-[12px] font-black uppercase tracking-widest text-white">
                    {new Date(item.challenge.created_at).toLocaleDateString()} - {new Date(item.challenge.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </span>
            </div>
        </button>
    );
});
