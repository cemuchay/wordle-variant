import { Eye, Play, Share2, Clock, Copy, SlidersHorizontal, Shield, Sparkles, Globe, Lock, Hourglass } from 'lucide-react';
import { memo, useMemo, useCallback } from 'react';
import { useChallengeContext } from '../../context/ChallengeContext';
import { formatTime } from './lib';
import { type ChallengeParticipant } from '../../hooks/useChallenge';
import { parseMarathonGames, getMarathonTimer, getHandicapStarter } from '../../utils/marathon';

interface ParticipantItemProps {
    p: ChallengeParticipant;
    isMarathon: boolean;
    totalMarathonGames: number;
    myHasFinished: boolean;
    isLive: boolean;
    onPreview: (p: ChallengeParticipant) => void;
    canPreviewAll: boolean;
    isExpired: boolean;
}

const ParticipantItem = memo(function ParticipantItem({ 
    p, isMarathon, totalMarathonGames, myHasFinished, isLive, onPreview, canPreviewAll, isExpired 
}: ParticipantItemProps) {
    const pIsFinished = p.status === 'completed' || p.status === 'timed_out';
    
    const marathonCompletedCount = useMemo(() => {
        if (!isMarathon || !p.marathon_progress) return 0;
        let count = 0;
        for (let i = 0; i < p.marathon_progress.length; i++) {
            const status = p.marathon_progress[i].status;
            if (status === 'completed' || status === 'timed_out') count++;
        }
        return count;
    }, [isMarathon, p.marathon_progress]);

    const showScore = pIsFinished || (isMarathon && p.score > 0) || canPreviewAll || isExpired;
    const canClick = myHasFinished || isMarathon || canPreviewAll || isExpired;

    return (
        <div
            onClick={() => {
                if (canClick) onPreview(p);
            }}
            className={`flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5 transition-all ${canClick ? 'cursor-pointer hover:bg-white/10 hover:border-white/20' : ''}`}
        >
            <div className="flex items-center gap-3">
                <div 
                    className="w-10 h-10 rounded-full border-2 border-white/10 overflow-hidden bg-gray-800 cursor-pointer hover:scale-105 transition-transform"
                    onClick={(e) => {
                        if (p.user_id) {
                            e.stopPropagation();
                            window.dispatchEvent(new CustomEvent('open-user-profile', { detail: { userId: p.user_id } }));
                        }
                    }}
                >
                    {p.profiles?.avatar_url ? (
                        <img src={p.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] font-black uppercase">
                            {p.profiles?.username?.substring(0, 2) || '??'}
                        </div>
                    )}
                </div>
                <div>
                    <p 
                        className="text-sm font-bold cursor-pointer hover:underline"
                        onClick={(e) => {
                            if (p.user_id) {
                                e.stopPropagation();
                                window.dispatchEvent(new CustomEvent('open-user-profile', { detail: { userId: p.user_id } }));
                            }
                        }}
                    >
                        {p.profiles?.username || 'Player'}
                    </p>
                    <p className={`text-[9px] font-black uppercase ${pIsFinished ? 'text-gray-500' : 'text-yellow-500'}`}>
                        {isMarathon && p.status === 'playing' ? `${marathonCompletedCount}/${totalMarathonGames} Games` : p.status}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-4">
                {showScore && (
                    <div className="text-right">
                        <p className="text-correct font-black text-lg">{p.score}</p>
                        <div className="flex flex-col items-end">
                            {!isMarathon && <p className="text-[9px] text-gray-500 font-bold uppercase">{p.attempts} Tries</p>}
                            {isLive && p.time_taken && (
                                <div className="flex items-center gap-1 text-[8px] font-black text-white/30">
                                    <Clock size={8} />
                                    <span>{formatTime(p.time_taken)}</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {(myHasFinished || isMarathon || canPreviewAll) && (
                    <div className="text-gray-500">
                        <Eye size={16} />
                    </div>
                )}
            </div>
        </div>
    );
});

import { useState } from 'react';
import { useApp } from '../../context/AppContext';

export const ChallengeLobby = memo(function ChallengeLobby() {
    const {
        selectedChallenge, myParticipation, participants,
        copyLink, shareLink, setPreviewParticipant, handleStartGame, setSelectedChallenge,
        loading, registerAnonymousUser, effectiveUser
    } = useChallengeContext();
    const { triggerToast } = useApp();

    const [nicknameInput, setNicknameInput] = useState('');

    const handlePreview = useCallback((p: ChallengeParticipant) => {
        setPreviewParticipant(p);
    }, [setPreviewParticipant]);

    if (!selectedChallenge) return null;

    const isMarathon = selectedChallenge.word_length === 1;
    const isLive = selectedChallenge.mode === 'LIVE';
    const myHasFinished = myParticipation?.status === 'completed' || myParticipation?.status === 'timed_out';
    const isCreatorOfCustom = selectedChallenge.creator_id === effectiveUser?.id && selectedChallenge.is_custom_word;
    const isExpired = useMemo(() => new Date(selectedChallenge.expires_at) < new Date(), [selectedChallenge.expires_at]);

    const marathonGamesList = useMemo(() => {
        if (!isMarathon) return [];
        return parseMarathonGames(selectedChallenge.target_word, selectedChallenge.salt);
    }, [isMarathon, selectedChallenge.target_word, selectedChallenge.salt]);

    const maxParts = selectedChallenge.max_participants || 100;
    const currentParts = participants.length;
    const isFull = currentParts >= maxParts && !myParticipation && !isCreatorOfCustom;

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
                        {selectedChallenge.is_public && (
                            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-correct/20 text-correct">
                                Public
                            </span>
                        )}
                    </div>
                    <div className="flex gap-4">
                        <button
                            onClick={() => copyLink(selectedChallenge)}
                            className="text-gray-400 hover:text-white flex items-center gap-1.5 text-[10px] font-bold uppercase transition-colors"
                        >
                            <Copy size={12} /> Copy Link
                        </button>
                        <button
                            onClick={() => shareLink(selectedChallenge)}
                            className="text-gray-400 hover:text-white flex items-center gap-1.5 text-[10px] font-bold uppercase transition-colors"
                        >
                            <Share2 size={12} /> Share
                        </button>
                    </div>
                </div>
                <h3 className="text-2xl font-black mb-1">
                    {isMarathon ? `The Marathon (${marathonGamesList.length} Games)` : `${selectedChallenge.word_length} Letter Word`}
                </h3>
                <p className="text-gray-400 text-sm mb-4">
                    {isMarathon
                        ? `Solve sequence (${marathonGamesList.map(g => g.wordLength).join('-')}). ${selectedChallenge.mode === 'LIVE' ? `You have ${selectedChallenge.max_time} minutes per word!` : 'Take your time, async play.'}`
                        : selectedChallenge.mode === 'LIVE'
                            ? `Fastest wins! You have ${selectedChallenge.max_time} minutes.`
                            : "Play anytime within the lifespan. Highest skill score wins!"}
                </p>

                {selectedChallenge.max_time && selectedChallenge.mode === 'LIVE' && (
                    <div className="inline-flex items-center gap-2 bg-red-500/10 px-3 py-1 rounded-lg border border-red-500/20">
                        <Clock size={12} className="text-red-500" />
                        <span className="text-[10px] font-black text-red-500 uppercase">{selectedChallenge.max_time}m Limit</span>
                    </div>
                )}
            </div>

            {/* Challenge Configuration Details */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <h4 className="text-[10px] font-black uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                        <SlidersHorizontal size={12} className="text-correct" />
                        Challenge Configuration
                    </h4>
                    <span className="text-[8px] font-bold text-gray-500 uppercase">
                        Hosted by {selectedChallenge.profiles?.username || selectedChallenge.creator?.username || 'Host'}
                    </span>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                    {/* Mode / Time Limit */}
                    <div className="bg-white/3 p-3 rounded-xl border border-white/5 space-y-1">
                        <p className="text-[8px] font-black uppercase text-gray-500">Timing & Mode</p>
                        <div className="flex items-center gap-1.5">
                            <Clock size={12} className={selectedChallenge.mode === 'LIVE' ? 'text-red-500' : 'text-blue-500'} />
                            <span className="text-xs font-bold text-white">
                                {selectedChallenge.mode === 'LIVE' ? 'Live Race' : 'Anytime (Async)'}
                            </span>
                        </div>
                        {selectedChallenge.mode === 'LIVE' && (
                            <p className="text-[9px] text-gray-400">
                                {isMarathon && selectedChallenge.marathon_timers 
                                    ? 'Custom per-word timers' 
                                    : `${selectedChallenge.max_time}m per game limit`}
                            </p>
                        )}
                    </div>

                    {/* Word Info */}
                    <div className="bg-white/3 p-3 rounded-xl border border-white/5 space-y-1">
                        <p className="text-[8px] font-black uppercase text-gray-500">Word Rules</p>
                        <div className="flex items-center gap-1.5">
                            <Sparkles size={12} className="text-yellow-500" />
                            <span className="text-xs font-bold text-white">
                                {isMarathon ? `Marathon (${marathonGamesList.length} Games)` : `${selectedChallenge.word_length || 'Random'} Letters`}
                            </span>
                        </div>
                        <p className="text-[9px] text-gray-400">
                            {selectedChallenge.is_custom_word ? 'Host Custom Word' : 'System Generated'}
                        </p>
                    </div>

                    {/* Handicap Info */}
                    <div className="bg-white/3 p-3 rounded-xl border border-white/5 space-y-1 col-span-2">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-[8px] font-black uppercase text-gray-500">Handicap Starter</p>
                                <div className="flex items-center gap-1.5">
                                    <Shield size={12} className={selectedChallenge.handicap_starter || selectedChallenge.handicap_starters ? 'text-correct' : 'text-gray-400'} />
                                    <span className="text-xs font-bold text-white">
                                        {selectedChallenge.handicap_starter || selectedChallenge.handicap_starters ? 'Enabled' : 'Disabled'}
                                    </span>
                                </div>
                            </div>
                            {(selectedChallenge.handicap_starter || selectedChallenge.handicap_starters) && (
                                <div className="text-right">
                                    <span className="text-[9px] font-black bg-correct/10 text-correct border border-correct/20 px-2 py-0.5 rounded-md uppercase">
                                        {selectedChallenge.handicap_enforced ? 'Auto-Enforced' : 'Optional'}
                                    </span>
                                </div>
                            )}
                        </div>
                        {(selectedChallenge.handicap_starter || selectedChallenge.handicap_starters) && (
                            <div className="mt-2 text-[9px] text-gray-400 space-y-1 bg-black/20 p-2.5 rounded-lg border border-white/5">
                                {isMarathon && selectedChallenge.handicap_starters ? (
                                    <div className="flex flex-wrap gap-1 justify-center text-center font-black max-h-[100px] overflow-y-auto animate-in fade-in duration-200">
                                        {marathonGamesList.map((game, idx) => {
                                            const w = getHandicapStarter(selectedChallenge, idx, game.wordLength);
                                            const hasWord = !!w && w !== '__SYSTEM_RANDOM__';
                                            return (
                                                <div key={idx} className="bg-white/5 p-1 rounded min-w-[45px]">
                                                    <span className="text-[7px] text-gray-500 block">#{idx + 1} ({game.wordLength}L)</span>
                                                    <span className="text-white/60 uppercase text-[8px]">
                                                        {hasWord ? 'Hidden' : 'Rand'}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="font-bold">
                                        Starter Word:{' '}
                                        <span className="text-white/60 uppercase tracking-wider font-mono">
                                            {selectedChallenge.handicap_starter === '__SYSTEM_RANDOM__'
                                                ? 'Random (Hidden until start)'
                                                : 'Hidden until start'}
                                        </span>
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Lifespan & Participants */}
                    <div className="bg-white/3 p-3 rounded-xl border border-white/5 space-y-1">
                        <p className="text-[8px] font-black uppercase text-gray-500">Privacy & Limits</p>
                        <div className="flex items-center gap-1.5">
                            {selectedChallenge.is_public ? (
                                <Globe size={12} className="text-correct" />
                            ) : (
                                <Lock size={12} className="text-yellow-500" />
                            )}
                            <span className="text-xs font-bold text-white">
                                {selectedChallenge.is_public ? 'Public Room' : 'Invite Only'}
                            </span>
                        </div>
                        <p className="text-[9px] text-gray-400">
                            {selectedChallenge.is_public 
                                ? `Max ${selectedChallenge.max_participants || 100} players`
                                : 'Direct shares only'}
                        </p>
                    </div>

                    {/* Expiration Timer */}
                    <div className="bg-white/3 p-3 rounded-xl border border-white/5 space-y-1">
                        <p className="text-[8px] font-black uppercase text-gray-500">Room Lifespan</p>
                        <div className="flex items-center gap-1.5">
                            <Hourglass size={12} className="text-gray-400" />
                            <span className="text-xs font-bold text-white">Expires in</span>
                        </div>
                        <p className="text-[9px] text-gray-400 tabular-nums">
                            {new Date(selectedChallenge.expires_at).toLocaleString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                        </p>
                    </div>

                    {/* Custom Marathon Timers if active */}
                    {isMarathon && selectedChallenge.mode === 'LIVE' && selectedChallenge.marathon_timers && (
                        <div className="bg-white/3 p-3 rounded-xl border border-white/5 space-y-1 col-span-2">
                            <p className="text-[8px] font-black uppercase text-gray-500">Marathon Per-Length Time Limits</p>
                            <div className="flex flex-wrap gap-1.5 justify-center pt-1 max-h-[120px] overflow-y-auto animate-in fade-in duration-200">
                                {marathonGamesList.map((game, idx) => {
                                    const t = getMarathonTimer(selectedChallenge, idx, game.wordLength);
                                    return (
                                        <div key={idx} className="bg-black/30 p-1.5 rounded-lg border border-white/5 text-center min-w-[50px]">
                                            <p className="text-[8px] font-bold text-gray-500">#{idx + 1} ({game.wordLength}L)</p>
                                            <p className="text-[10px] font-black text-white">{t}m</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-3">
                <div className="flex items-center justify-between px-2">
                    <h4 className="text-xs font-black uppercase tracking-widest text-gray-500">
                        Participants ({currentParts} / {maxParts})
                    </h4>
                </div>
                <div className="space-y-2">
                    {loading && participants.length === 0 ? (
                        [1, 2].map(i => (
                            <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse border border-white/5" />
                        ))
                    ) : (
                        participants.map((p) => (
                            <ParticipantItem 
                                key={p.id}
                                p={p}
                                isMarathon={isMarathon}
                                totalMarathonGames={marathonGamesList.length}
                                myHasFinished={myHasFinished}
                                isLive={isLive}
                                onPreview={handlePreview}
                                canPreviewAll={selectedChallenge.creator_id === effectiveUser?.id && !!selectedChallenge.is_custom_word}
                                isExpired={isExpired}
                            />
                        ))
                    )}
                </div>
            </div>

            <div className="pt-6 flex flex-col gap-3">
                {isExpired ? (
                    <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl text-center space-y-1">
                        <p className="text-xs font-black uppercase text-red-500 flex items-center justify-center gap-1.5">
                            <Hourglass size={14} /> Challenge Expired ⌛
                        </p>
                        <p className="text-[10px] text-red-400/80 font-bold leading-relaxed">
                            This challenge has ended. You can view the final scores and details, but no more entries are allowed.
                        </p>
                    </div>
                ) : isCreatorOfCustom ? (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-2xl text-center space-y-1">
                        <p className="text-xs font-black uppercase text-yellow-500">Host Mode Active 👑</p>
                        <p className="text-[10px] text-yellow-500/80 font-bold">
                            You created this custom word challenge. Watch your friends compete on the leaderboard above!
                        </p>
                    </div>
                ) : isFull ? (
                    <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl text-center">
                        <p className="text-xs font-black uppercase text-red-500">Challenge Full 🚫</p>
                        <p className="text-[10px] text-red-400/80 font-bold mt-1">
                            This challenge has reached its maximum participant limit of {maxParts}.
                        </p>
                    </div>
                ) : !effectiveUser ? (
                    <div className="bg-white/5 border border-white/10 p-5 rounded-2xl space-y-4 animate-in fade-in duration-300">
                        <div className="text-center space-y-1">
                            <p className="text-xs font-black uppercase tracking-wider text-white">Join the Challenge</p>
                            <p className="text-[10px] text-gray-500">Choose a guest nickname to compete!</p>
                        </div>
                        <div className="space-y-3">
                            <input
                                type="text"
                                maxLength={15}
                                placeholder="Enter nickname..."
                                value={nicknameInput}
                                onChange={(e) => setNicknameInput(e.target.value.replace(/[^A-Za-z0-9_]/g, ''))}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-correct outline-none uppercase text-center font-black tracking-widest text-correct"
                            />
                            <button
                                onClick={async () => {
                                    const name = nicknameInput.trim();
                                    if (name.length < 3) {
                                        triggerToast("Nickname must be at least 3 characters.", 3000);
                                        return;
                                    }
                                    const user = await registerAnonymousUser(name);
                                    if (user) {
                                        // Join will be triggered by useEffect in ChallengeContext
                                        triggerToast("Guest profile created! Joining...", 2000);
                                    }
                                }}                                className="w-full bg-correct text-black py-3.5 rounded-xl text-xs font-black uppercase tracking-widest hover:brightness-110 transition-all"
                            >
                                Join Challenge
                            </button>
                        </div>
                    </div>
                ) : !myHasFinished ? (
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
