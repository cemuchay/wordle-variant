/* eslint-disable @typescript-eslint/no-explicit-any */
import { memo, useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';
import { formatTime } from './lib';

export const ChallengeSkeleton = memo(function ChallengeSkeleton() {
    return (
        <div className="space-y-4 animate-pulse">
            {[1, 2, 3].map(i => (
                <div key={i} className="h-40 bg-white/5 rounded-4xl" />
            ))}
        </div>
    );
});


export const ErrorFallback = memo(function ErrorFallback({ message, onRetry }: { message: string, onRetry: () => void }) {
    return (
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
    );
});

export const ExpirationTimer = memo(function ExpirationTimer({ expiresAt, createdAt }: { expiresAt: string, createdAt: string }) {
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

export const ChallengeItem = memo(function ChallengeItem({ item, user, onSelect }: { item: any, user: any, onSelect: (id: string) => void }) {
    const { challenge, status, score, time_taken, challenge_id } = item;
    const { expires_at, created_at, mode, word_length, participants: rawParticipants } = challenge;

    const isExpired = useMemo(() => new Date(expires_at) < new Date(), [expires_at]);
    const isFinished = useMemo(() => status === 'completed' || status === 'timed_out' || status === 'declined', [status]);

    const participants = useMemo(() => rawParticipants || [], [rawParticipants]);

    const maxScore = useMemo(() => {
        let max = 0;
        for (let i = 0; i < participants.length; i++) {
            const p = participants[i];
            if (p.status !== 'pending') {
                const s = p.score || 0;
                if (s > max) max = s;
            }
        }
        return max;
    }, [participants]);

    const myScore = score || 0;
    const isLeader = myScore === maxScore && myScore > 0;
    const hasStarted = status !== 'pending';

    const handleSelect = useCallback(() => {
        onSelect(challenge_id);
    }, [onSelect, challenge_id]);

    const opponents = useMemo(() =>
        participants.filter((p: any) => p.user_id !== user?.id),
        [participants, user?.id]);

    const formattedDate = useMemo(() => {
        const d = new Date(created_at);
        return `${d.toLocaleDateString()} - ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    }, [created_at]);

    return (
        <button
            onClick={handleSelect}
            className={`w-full text-left bg-linear-to-br from-white/3 to-transparent border ${isLeader && !isExpired ? 'border-correct/20' : 'border-white/5'} p-5 rounded-4xl hover:border-white/20 transition-all group relative overflow-hidden`}
        >
            {/* Background Glow for Leader */}
            {isLeader && !isExpired && (
                <div className="absolute top-0 right-0 w-32 h-32 bg-correct/5 blur-2xl -mr-16 -mt-16 pointer-events-none" />
            )}

            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter ${mode === 'LIVE' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-correct/10 text-correct border border-correct/20'}`}>
                        {mode}
                    </div>
                    <div className="bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
                        <span className="text-[9px] font-black uppercase tracking-tighter text-white/50">
                            {word_length === 1 ? 'Marathon' : `${word_length} Letters`}
                        </span>
                    </div>
                </div>
                {!isExpired && !isFinished && (
                    <ExpirationTimer expiresAt={expires_at} createdAt={created_at} />
                )}
                {isExpired && <span className="text-red-500 text-[10px] font-black uppercase tracking-widest">Expired</span>}
            </div>

            <div className="grid grid-cols-1 gap-4">
                {/* Me / Host Row */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-black text-xs ${isLeader ? 'border-correct bg-correct text-black' : 'border-white/10 text-white'}`}>
                            {status === 'host' ? '👑' : 'Me'}
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-gray-500">{status === 'host' ? 'My Role' : 'My Progress'}</p>
                            <p className={`text-xs font-black uppercase ${status === 'completed' || status === 'host' ? 'text-correct' : status === 'playing' ? 'text-yellow-500' : 'text-gray-400'}`}>
                                {status}
                            </p>
                        </div>
                    </div>
                    {status !== 'host' && (
                        <div className="text-right">
                            <p className="text-[10px] font-black uppercase text-gray-500">Score</p>
                            <div className="flex flex-col items-end">
                                <p className={`text-xl font-black ${isLeader ? 'text-correct' : hasStarted ? 'text-red-500' : 'text-white'}`}>
                                    {hasStarted ? myScore : '--'}
                                </p>
                                {hasStarted && mode === 'LIVE' && time_taken && (
                                    <div className="flex items-center gap-1 text-[9px] font-bold text-white/40">
                                        <Clock size={8} />
                                        <span>{formatTime(time_taken)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="h-px bg-white/5 w-full" />

                {/* Opponents Section */}
                <div className="space-y-3">
                    {opponents.length > 0 ? (
                        opponents.map((p: any) => {
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
                                        <div className="flex flex-col items-end">
                                            <p className={`text-base font-black ${isPLeader ? 'text-correct' : pStarted ? 'text-red-500' : 'text-white/20'}`}>
                                                {pStarted ? pScore : '--'}
                                            </p>
                                            {pStarted && mode === 'LIVE' && p.time_taken && (
                                                <div className="flex items-center gap-1 text-[8px] font-bold text-white/30">
                                                    <Clock size={7} />
                                                    <span>{formatTime(p.time_taken)}</span>
                                                </div>
                                            )}
                                        </div>
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
                    {formattedDate}
                </span>
            </div>
        </button>
    );
});

export const NetworkLog = memo(function NetworkLog({ logs }: { logs: Array<{ id: string, msg: string, duration?: number }> }) {
    if (logs.length === 0) return null;
    return (
        <div className="absolute top-2 right-2 z-110 flex flex-col items-end gap-1 pointer-events-none max-w-[200px] hidden">
            {logs.slice(-5).map((log, index) => (
                <div key={log.id} className="bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10 text-[8px] font-mono text-white uppercase tracking-tighter animate-in fade-in slide-in-from-right-2">
                    {index + 1}. {log.msg} {log.duration !== undefined && <span className="text-correct">({log.duration}ms)</span>}
                </div>
            ))}
        </div>
    );
});
