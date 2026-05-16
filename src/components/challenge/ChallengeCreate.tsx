/* eslint-disable @typescript-eslint/no-explicit-any */
import { Clock, Play, Plus } from 'lucide-react';
import { memo } from 'react';
import { useChallengeContext } from '../../context/ChallengeContext';

export const ChallengeCreate = memo(() => {
    const {
        mode, setMode, length, setLength, maxTime, setMaxTime,
        availableProfiles, invitedIds, toggleInvite,
        joinId, setJoinId, handleViewChallenge, handleCreate, loading
    } = useChallengeContext();

    return (
        <div className="space-y-6">
            <div className="space-y-4">
                <label className="text-xs font-black uppercase tracking-widest text-gray-500">Mode</label>
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={() => setMode('ANYTIME')}
                        className={`p-3 rounded-2xl border transition-all text-left ${mode === 'ANYTIME' ? 'border-correct bg-correct/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <Clock className={mode === 'ANYTIME' ? 'text-correct' : 'text-gray-400'} size={18} />
                            {mode === 'ANYTIME' && <div className="w-2 h-2 bg-correct rounded-full" />}
                        </div>
                        <p className="text-[10px] font-black uppercase">Anytime</p>
                        <p className="text-[8px] text-gray-500">24h async</p>
                    </button>
                    <button
                        onClick={() => setMode('LIVE')}
                        className={`p-3 rounded-2xl border transition-all text-left ${mode === 'LIVE' ? 'border-red-500 bg-red-500/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <Play className={mode === 'LIVE' ? 'text-red-500' : 'text-gray-400'} size={18} />
                            {mode === 'LIVE' && <div className="w-2 h-2 bg-red-500 rounded-full" />}
                        </div>
                        <p className="text-[10px] font-black uppercase">Live</p>
                        <p className="text-[8px] text-gray-500">Timed play</p>
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                <label className="text-xs font-black uppercase tracking-widest text-gray-500">Word Length</label>
                <div className="flex gap-2 flex-wrap">
                    {[3, 4, 5, 6, 7].map((l) => (
                        <button
                            key={l}
                            onClick={() => setLength(l)}
                            className={`w-10 h-10 rounded-xl border font-black text-xs transition-all ${length === l ? 'border-correct bg-correct text-black' : 'border-white/10 bg-white/5 hover:border-white/20'}`}
                        >
                            {l}
                        </button>
                    ))}
                    <button
                        onClick={() => setLength(0)} // 0 for random
                        className={`px-3 h-10 rounded-xl border font-black text-[9px] uppercase tracking-widest transition-all ${length === 0 ? 'border-correct bg-correct text-black' : 'border-white/10 bg-white/5 hover:border-white/20'}`}
                    >
                        Random
                    </button>
                    <button
                        onClick={() => setLength(1)} // 1 for marathon
                        className={`px-3 h-10 rounded-xl border font-black text-[9px] uppercase tracking-widest transition-all ${length === 1 ? 'border-yellow-500 bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'border-white/10 bg-white/5 hover:border-white/20'}`}
                    >
                        Marathon
                    </button>
                </div>
            </div>

            {mode === 'LIVE' && (
                <div className="space-y-4">
                    <label className="text-xs font-black uppercase tracking-widest text-gray-500">
                        Time Limit (Per Game)
                    </label>
                    <div className="flex gap-3">
                        {[3, 5, 10].map((t) => (
                            <button
                                key={t}
                                onClick={() => setMaxTime(t)}
                                className={`flex-1 p-3 rounded-xl border text-sm font-black transition-all ${maxTime === t ? 'border-red-500 bg-red-500 text-white' : 'border-white/10 bg-white/5'}`}
                            >
                                {t}m
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="space-y-4">
                <label className="text-xs font-black uppercase tracking-widest text-gray-500">Invite Friends</label>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {loading && availableProfiles.length === 0 ? (
                        [1, 2, 3].map(i => (
                            <div key={i} className="shrink-0 w-20 h-24 bg-white/5 rounded-2xl animate-pulse" />
                        ))
                    ) : availableProfiles.length === 0 ? (
                        <p className="text-[10px] text-gray-600 uppercase font-black">No other users found</p>
                    ) : (
                        availableProfiles.map((p) => (
                            <button
                                key={p.id}
                                onClick={() => toggleInvite(p.id)}
                                className={`shrink-0 flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${invitedIds.includes(p.id) ? 'border-correct bg-correct/10' : 'border-white/5 bg-white/5 hover:border-white/10'}`}
                            >
                                <div className="relative">
                                    <img src={p.avatar_url || 'https://via.placeholder.com/40'} className="w-10 h-10 rounded-full border border-white/10" alt="" />
                                    {invitedIds.includes(p.id) && (
                                        <div className="absolute -top-1 -right-1 bg-correct text-black rounded-full p-0.5 border-2 border-gray-900">
                                            <Plus size={8} className="rotate-45" />
                                        </div>
                                    )}
                                </div>
                                <span className="text-[10px] font-bold max-w-[60px] truncate">{p.username}</span>
                            </button>
                        ))
                    )}
                </div>
            </div>

            <div className="pt-4 border-t border-white/5 space-y-4">
                <div className="flex items-center gap-3">
                    <input
                        type="text"
                        placeholder="Or Enter Challenge ID..."
                        value={joinId}
                        onChange={(e) => setJoinId(e.target.value)}
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-correct outline-none transition-colors"
                    />
                    <button
                        onClick={() => joinId && handleViewChallenge(joinId)}
                        disabled={!joinId}
                        className="bg-white text-black px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                        Join
                    </button>
                </div>

                <button
                    onClick={handleCreate}
                    disabled={loading}
                    className="w-full bg-correct text-black py-5 rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-xl hover:brightness-110 transition-all flex items-center justify-center gap-2"
                >
                    {loading ? 'Creating...' : <><Plus size={18} /> Create Challenge</>}
                </button>
            </div>
        </div>
    );
});
