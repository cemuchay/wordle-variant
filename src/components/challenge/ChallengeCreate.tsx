/* eslint-disable @typescript-eslint/no-explicit-any */
import { Clock, Play, Plus, Search, X, UserPlus } from 'lucide-react';
import { memo, useState, useMemo } from 'react';
import { useChallengeContext } from '../../context/ChallengeContext';

export const ChallengeCreate = memo(() => {
    const {
        mode, setMode, length, setLength, maxTime, setMaxTime,
        availableProfiles, invitedIds, toggleInvite,
        joinId, setJoinId, handleViewChallenge, handleCreate, loading
    } = useChallengeContext();

    const [profileSearch, setProfileSearch] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const filteredProfiles = useMemo(() => {
        return availableProfiles.filter(p => 
            !invitedIds.includes(p.id) && 
            p.username.toLowerCase().includes(profileSearch.toLowerCase())
        );
    }, [availableProfiles, invitedIds, profileSearch]);

    const invitedProfiles = useMemo(() => {
        return availableProfiles.filter(p => invitedIds.includes(p.id));
    }, [availableProfiles, invitedIds]);

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

            {/* Redesigned Invite System */}
            <div className="space-y-4 relative">
                <label className="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
                    <UserPlus size={14} /> Invite Friends
                </label>
                
                <div className="space-y-3">
                    {/* Selected Users Chips */}
                    {invitedProfiles.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {invitedProfiles.map(p => (
                                <div key={p.id} className="bg-correct/20 border border-correct/30 px-3 py-1.5 rounded-full flex items-center gap-2 animate-in fade-in zoom-in duration-200">
                                    <img src={p.avatar_url || `https://ui-avatars.com/api/?name=${p.username}`} className="w-4 h-4 rounded-full" alt="" />
                                    <span className="text-[10px] font-black uppercase text-correct">{p.username}</span>
                                    <button onClick={() => toggleInvite(p.id)} className="text-correct hover:text-white transition-colors">
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Search Input & Dropdown */}
                    <div className="relative">
                        <div className="relative group">
                            <Search className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${isDropdownOpen ? 'text-correct' : 'text-gray-500'}`} size={16} />
                            <input
                                type="text"
                                placeholder="Search by username..."
                                value={profileSearch}
                                onFocus={() => setIsDropdownOpen(true)}
                                onChange={(e) => {
                                    setProfileSearch(e.target.value);
                                    setIsDropdownOpen(true);
                                }}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-11 pr-4 text-sm focus:outline-none focus:border-correct/50 focus:bg-white/10 transition-all"
                            />
                            {profileSearch && (
                                <button 
                                    onClick={() => setProfileSearch('')}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        {/* Dropdown Menu */}
                        {isDropdownOpen && (
                            <div className="absolute z-50 w-full mt-2 bg-gray-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                                {filteredProfiles.length > 0 ? (
                                    filteredProfiles.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => {
                                                toggleInvite(p.id);
                                                setProfileSearch('');
                                                setIsDropdownOpen(false);
                                            }}
                                            className="w-full flex items-center gap-3 p-3 hover:bg-white/5 transition-colors text-left"
                                        >
                                            <img src={p.avatar_url || `https://ui-avatars.com/api/?name=${p.username}`} className="w-8 h-8 rounded-full border border-white/10" alt="" />
                                            <div>
                                                <p className="text-xs font-black text-white">{p.username}</p>
                                                <p className="text-[9px] text-gray-500 uppercase font-bold">Available</p>
                                            </div>
                                            <Plus size={14} className="ml-auto text-gray-500 group-hover:text-correct" />
                                        </button>
                                    ))
                                ) : (
                                    <div className="p-8 text-center">
                                        <p className="text-[10px] text-gray-500 uppercase font-black">No users found</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Click outside to close dropdown backdrop */}
                {isDropdownOpen && (
                    <div 
                        className="fixed inset-0 z-40 pointer-events-auto" 
                        onClick={() => setIsDropdownOpen(false)}
                    />
                )}
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
