/* eslint-disable @typescript-eslint/no-explicit-any */
import { Eye, Play, Share2, Clock } from 'lucide-react';
import { memo } from 'react';
import { useChallengeContext } from '../../context/ChallengeContext';
import { formatTime } from './lib';

export const ChallengeLobby = memo(() => {
    const {
        selectedChallenge, myParticipation, participants,
        copyLink, setPreviewParticipant, handleStartGame, setSelectedChallenge,
        loading
    } = useChallengeContext();

    if (!selectedChallenge) return null;

    const isMarathon = selectedChallenge.word_length === 1;
    const myHasFinished = myParticipation?.status === 'completed' || myParticipation?.status === 'timed_out';

    return (
        <div className="space-y-6">
            <div className="bg-white/5 p-6 rounded-2xl border border-white/10 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-correct/5 blur-3xl -mr-16 -mt-16 pointer-events-none" />

                <div className="flex items-center justify-between mb-4">
                    <div className="flex gap-2">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${selectedChallenge.mode === 'LIVE' ? 'bg-red-500/20 text-red-500' : 'bg-blue-500/20 text-blue-500'}`}>
                            {selectedChallenge.mode} Mode
                        </span>
                        {isMarathon && (
                            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-yellow-500/20 text-yellow-500">
                                Marathon
                            </span>
                        )}
                    </div>
                    <button
                        onClick={() => copyLink(selectedChallenge)}
                        className="text-gray-400 hover:text-white flex items-center gap-2 text-[10px] font-bold uppercase"
                    >
                        <Share2 size={14} /> Share Link
                    </button>
                </div>
                <h3 className="text-2xl font-black mb-1">
                    {isMarathon ? 'The Marathon' : `${selectedChallenge.word_length} Letter Word`}
                </h3>
                <p className="text-gray-400 text-sm mb-4">
                    {isMarathon
                        ? `Solve all lengths (3-7). ${selectedChallenge.mode === 'LIVE' ? `You have ${selectedChallenge.max_time} minutes total!` : 'Take your time, async play.'}`
                        : selectedChallenge.mode === 'LIVE'
                            ? `Fastest wins! You have ${selectedChallenge.max_time} minutes.`
                            : "Play anytime within 24 hours. Highest skill score wins!"}
                </p>

                {selectedChallenge.max_time && selectedChallenge.mode === 'LIVE' && (
                    <div className="inline-flex items-center gap-2 bg-red-500/10 px-3 py-1 rounded-lg border border-red-500/20">
                        <Clock size={12} className="text-red-500" />
                        <span className="text-[10px] font-black text-red-500 uppercase">{selectedChallenge.max_time}m Limit</span>
                    </div>
                )}
            </div>

            <div className="space-y-3">
                <div className="flex items-center justify-between px-2">
                    <h4 className="text-xs font-black uppercase tracking-widest text-gray-500">Participants ({participants.length})</h4>
                </div>
                <div className="space-y-2">
                    {loading ? (
                        [1, 2].map(i => (
                            <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse border border-white/5" />
                        ))
                    ) : (
                        participants.map((p) => {
                            const pIsFinished = p.status === 'completed' || p.status === 'timed_out';
                            const marathonCompletedCount = isMarathon ? (p.marathon_progress?.filter(mp => mp.status === 'completed' || mp.status === 'timed_out').length || 0) : 0;

                            return (
                                <div
                                    key={p.id}
                                    onClick={() => {
                                        if (myHasFinished && !isMarathon) {
                                            setPreviewParticipant(p);
                                        }
                                    }}
                                    className={`flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5 transition-all ${(myHasFinished && !isMarathon) ? 'cursor-pointer hover:bg-white/10 hover:border-white/20' : ''}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full border-2 border-white/10 overflow-hidden bg-gray-800">
                                            {p.profiles?.avatar_url ? (
                                                <img src={p.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-[10px] font-black uppercase">
                                                    {p.profiles?.username?.substring(0, 2) || '??'}
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold">{p.profiles?.username || 'Player'}</p>
                                            <p className={`text-[9px] font-black uppercase ${pIsFinished ? 'text-gray-500' : 'text-yellow-500'}`}>
                                                {isMarathon && p.status === 'playing' ? `${marathonCompletedCount}/5 Lengths` : p.status}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {(pIsFinished || (isMarathon && p.score > 0)) && (
                                            <div className="text-right">
                                                <p className="text-correct font-black text-lg">{p.score}</p>
                                                <div className="flex flex-col items-end">
                                                    {!isMarathon && <p className="text-[9px] text-gray-500 font-bold uppercase">{p.attempts} Tries</p>}
                                                    {selectedChallenge.mode === 'LIVE' && p.time_taken && (
                                                        <div className="flex items-center gap-1 text-[8px] font-black text-white/30">
                                                            <Clock size={8} />
                                                            <span>{formatTime(p.time_taken)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        {myHasFinished && !isMarathon && (
                                            <div className="text-gray-500">
                                                <Eye size={16} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            <div className="pt-6 flex flex-col gap-3">
                {!myHasFinished ? (
                    <button
                        onClick={handleStartGame}
                        disabled={loading}
                        className="w-full bg-correct text-black py-4 rounded-2xl font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        <Play size={18} fill="currentColor" /> {myParticipation?.status === 'playing' ? 'Continue Challenge' : 'Start Challenge'}
                    </button>
                ) : (
                    <div className="w-full bg-white/5 border border-white/10 text-correct py-4 rounded-2xl text-xs font-black uppercase tracking-widest text-center">
                        Challenge Completed 🎉
                    </div>
                )}

                <button
                    onClick={() => setSelectedChallenge(null)}
                    className="w-full bg-white/5 border border-white/10 text-white/50 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all"
                >
                    Back to List
                </button>
            </div>
        </div>
    );
});
