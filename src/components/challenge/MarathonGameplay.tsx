/* eslint-disable @typescript-eslint/no-explicit-any */
import { memo, useState, useCallback, useMemo } from 'react';
import { RegularGameplay } from './RegularGameplay';
import { formatTime } from './lib';
import { useChallengeContext } from '../../context/ChallengeContext';
import { CHALLENGE_CONFIG } from '../../constants/challenge';
import { MAX_ATTEMPTS } from '../../constants/game';

interface MarathonGameplayProps {
    challenge: any;
    participation: any;
    triggerToast: (msg: string, duration?: number) => void;
    submitChallengeResult: (result: any, wordLength?: number) => Promise<boolean>;
    onFinish: () => void;
}

const FinisherAvatar = memo(function FinisherAvatar({ p, length, onPreview }: { p: any, length: number, onPreview: (p: any, l: number) => void }) {
    return (
        <button
            onClick={() => onPreview(p, length)}
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

const MarathonLengthItem = memo(function MarathonLengthItem({
    l, prog, challenge, finishers, onSelect, onPreview
}: {
    l: number, prog: any, challenge: any, finishers: any[],
    onSelect: (l: number, isFinished: boolean) => void,
    onPreview: (p: any, l: number) => void
}) {
    const isCompleted = prog?.status === 'completed';
    const isFailed = prog?.status === 'timed_out' || (prog?.attempts >= MAX_ATTEMPTS && !isCompleted);
    const isFinished = isCompleted || isFailed;

    return (
        <div className="flex flex-col gap-2">
            <button
                onClick={() => onSelect(l, isFinished)}
                className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${isFinished ? 'bg-white/5 border-white/10 hover:border-correct/50 hover:bg-correct/5' : 'bg-white/5 border-white/10 hover:border-yellow-500 hover:bg-yellow-500/5'}`}
            >
                <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${isCompleted ? 'bg-correct text-black' : isFailed ? 'bg-red-500 text-white' : prog ? 'bg-yellow-500 text-black' : 'bg-white/10 text-white'}`}>
                        {l}
                    </div>
                    <div className="text-left">
                        <p className="text-xs font-black uppercase">{l} Letters</p>
                        <p className="text-[10px] text-gray-500">
                            {isFinished
                                ? (isCompleted ? 'Completed (View Results)' : 'Failed (View Results)')
                                : (prog ? 'In Progress' : 'Not Started')}
                        </p>
                    </div>
                </div>
                {prog && (
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
                            <FinisherAvatar key={p.id} p={p} length={l} onPreview={onPreview} />
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
    const { participants, setPreviewParticipant, setPreviewMarathonLength } = useChallengeContext();
    const [selectedLength, setSelectedLength] = useState<number | null>(null);

    const onBack = useCallback(() => setSelectedLength(null), []);

    const handleSelect = useCallback((l: number, isFinished: boolean) => {
        if (isFinished) {
            setPreviewMarathonLength(l);
            setPreviewParticipant(participation);
        } else {
            setSelectedLength(l);
        }
    }, [participation, setPreviewMarathonLength, setPreviewParticipant]);

    const handlePreview = useCallback((p: any, l: number) => {
        setPreviewMarathonLength(l);
        setPreviewParticipant(p);
    }, [setPreviewMarathonLength, setPreviewParticipant]);

    // Pre-calculate finishers for each length in a single pass O(P) instead of O(L*P)
    const finishersByLength = useMemo(() => {
        const map: Record<number, any[]> = { 3: [], 4: [], 5: [], 6: [], 7: [] };
        if (!participants) return map;

        for (const p of participants) {
            if (p.user_id === participation.user_id) continue;
            if (!p.marathon_progress) continue;

            for (const mp of p.marathon_progress) {
                if (mp.status === 'completed' || mp.status === 'timed_out') {
                    if (map[mp.word_length]) {
                        map[mp.word_length].push(p);
                    }
                }
            }
        }
        return map;
    }, [participants, participation.user_id]);

    if (selectedLength) {
        return (
            <RegularGameplay
                challenge={challenge}
                participation={participation}
                triggerToast={triggerToast}
                submitChallengeResult={submitChallengeResult}
                onFinish={onFinish}
                selectedLength={selectedLength}
                onBack={onBack}
            />
        );
    }

    const allLengths = CHALLENGE_CONFIG.MARATHON_LENGTHS;

    return (
        <div className="flex-1 p-6 flex flex-col gap-8">
            <div className="text-center space-y-2">
                <h3 className="text-xl font-black uppercase tracking-tighter">Marathon Mode</h3>
                <p className="text-gray-500 text-xs">Complete all lengths to finish the challenge.</p>
            </div>

            <div className="grid grid-cols-1 gap-3">
                {allLengths.map(l => {
                    const prog = participation.marathon_progress?.find((p: any) => p.word_length === l);
                    return (
                        <MarathonLengthItem
                            key={l}
                            l={l}
                            prog={prog}
                            challenge={challenge}
                            finishers={finishersByLength[l]}
                            onSelect={handleSelect}
                            onPreview={handlePreview}
                        />
                    );
                })}
            </div>

            <div className="mt-auto pt-6 border-t border-white/5 flex items-center justify-between">
                <div>
                    <p className="text-[10px] text-gray-500 uppercase font-black">Total Score</p>
                    <p className="text-2xl font-black text-correct">{participation.score || 0}</p>
                </div>
                <button
                    onClick={onFinish}
                    className="bg-white/5 border border-white/10 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-colors"
                >
                    Exit to Lobby
                </button>
            </div>
        </div>
    );
});
