/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { memo } from 'react';
import { Share2, Eye, Play } from 'lucide-react';
import type { Challenge, ChallengeParticipant } from '../../hooks/useChallenge';

interface ChallengeLobbyProps {
    selectedChallenge: Challenge;
    myParticipation: ChallengeParticipant | null;
    participants: ChallengeParticipant[];
    myHasFinished: boolean;
    user: any;
    copyLink: (challenge: Challenge) => void;
    setPreviewParticipant: (p: ChallengeParticipant) => void;
    handleStartGame: () => void;
    setSelectedChallenge: (c: Challenge | null) => void;
}

export const ChallengeLobby = memo(({
    selectedChallenge, myParticipation, participants, myHasFinished, user,
    copyLink, setPreviewParticipant, handleStartGame, setSelectedChallenge
}: ChallengeLobbyProps) => {
    return (
        <div className="space-y-6">
            <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                <div className="flex items-center justify-between mb-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${selectedChallenge.mode === 'LIVE' ? 'bg-red-500/20 text-red-500' : 'bg-blue-500/20 text-blue-500'}`}>
                        {selectedChallenge.mode} Mode
                    </span>
                    <button
                        onClick={() => copyLink(selectedChallenge)}
                        className="text-gray-400 hover:text-white flex items-center gap-2 text-[10px] font-bold uppercase"
                    >
                        <Share2 size={14} /> Share Link
                    </button>
                </div>
                <h3 className="text-2xl font-black mb-1">{selectedChallenge.word_length} Letter Word</h3>
                <p className="text-gray-400 text-sm">
                    {selectedChallenge.mode === 'LIVE'
                        ? `Fastest wins! You have ${selectedChallenge.max_time} minutes.`
                        : "Play anytime within 24 hours. Highest skill score wins!"}
                </p>
            </div>

            <div className="space-y-3">
                <div className="flex items-center justify-between px-2">
                    <h4 className="text-xs font-black uppercase tracking-widest text-gray-500">Participants ({participants.length})</h4>
                </div>
                <div className="space-y-2">
                    {participants.map((p) => (
                        <div
                            key={p.id}
                            onClick={() => {
                                if (myHasFinished) {
                                    setPreviewParticipant(p);
                                }
                            }}
                            className={`flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5 transition-all ${myHasFinished ? 'cursor-pointer hover:bg-white/10 hover:border-white/20' : ''}`}
                        >
                            <div className="flex items-center gap-3">
                                <img src={p.profiles?.avatar_url || 'https://via.placeholder.com/32'} className="w-8 h-8 rounded-full border border-white/10" alt="" />
                                <div>
                                    <p className="text-sm font-bold">{p.profiles?.username || 'Player'}</p>
                                    <p className="text-[10px] text-gray-500 uppercase font-black">{p.status}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                {p.status === 'completed' && (
                                    <div className="text-right">
                                        <p className="text-correct font-black">{p.score}</p>
                                        <p className="text-[10px] text-gray-500">{p.attempts} attempts</p>
                                    </div>
                                )}
                                {myHasFinished && (
                                    <div className="text-gray-500 group-hover:text-white transition-colors">
                                        <Eye size={16} />
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="pt-4 flex gap-3">
                <button
                    onClick={() => setSelectedChallenge(null)}
                    className="flex-1 py-4 rounded-2xl border border-white/10 text-xs font-black uppercase tracking-widest hover:bg-white/5 transition-colors"
                >
                    Back
                </button>
                {myParticipation?.status === 'pending' || myParticipation?.status === 'playing' ? (
                    <button
                        onClick={handleStartGame}
                        className="flex-2 bg-correct text-black py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center justify-center gap-2"
                    >
                        <Play size={16} fill="currentColor" /> {myParticipation.status === 'playing' ? 'Continue' : 'Start Now'}
                    </button>
                ) : (
                    <div className="flex-2 bg-white/5 text-gray-500 py-4 rounded-2xl text-xs font-black uppercase tracking-widest text-center">
                        Challenge Completed
                    </div>
                )}
            </div>
        </div>
    );
});
