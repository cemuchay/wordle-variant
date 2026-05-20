/* eslint-disable @typescript-eslint/no-explicit-any */
import { Clock, Play, Plus, Search, X, UserPlus } from 'lucide-react';
import { memo, useState, useMemo, useCallback } from 'react';
import { useChallengeContext } from '../../context/ChallengeContext';

const ModeSelector = memo(({ mode, setMode }: { mode: 'LIVE' | 'ANYTIME', setMode: (m: 'LIVE' | 'ANYTIME') => void }) => (
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
));

const LengthSelector = memo(({ length, setLength }: { length: number, setLength: (l: number) => void }) => (
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
));

const TimeLimitSelector = memo(({ maxTime, setMaxTime }: { maxTime: number | null, setMaxTime: (t: number) => void }) => (
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
));

const ProfileInviteSystem = memo(({ availableProfiles, invitedIds, toggleInvite }: { availableProfiles: any[], invitedIds: string[], toggleInvite: (id: string) => void }) => {
    const [profileSearch, setProfileSearch] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const filteredProfiles = useMemo(() => {
        const query = profileSearch.toLowerCase();
        if (!query && !isDropdownOpen) return [];
        return availableProfiles.filter(p => 
            !invitedIds.includes(p.id) && 
            p.username.toLowerCase().includes(query)
        ).slice(0, 10); // Limit results for performance
    }, [availableProfiles, invitedIds, profileSearch, isDropdownOpen]);

    const invitedProfiles = useMemo(() => {
        return availableProfiles.filter(p => invitedIds.includes(p.id));
    }, [availableProfiles, invitedIds]);

    const handleToggle = useCallback((id: string) => {
        toggleInvite(id);
        setProfileSearch('');
        setIsDropdownOpen(false);
    }, [toggleInvite]);

    return (
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
                            onChange={(e) => setProfileSearch(e.target.value)}
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
                                        onClick={() => handleToggle(p.id)}
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
                                    <p className="text-[10px] text-gray-500 uppercase font-black">{profileSearch ? 'No users found' : 'Type to search users'}</p>
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
    );
});

import { getWordLists } from '../../data/words';
import { Shield, Sparkles, Settings2 } from 'lucide-react';

const validateCustomWord = (word: string, len: number) => {
    const trimmed = word.trim();
    if (!trimmed) return "Cannot be empty";
    if (trimmed.length !== len) return `Must be exactly ${len} letters`;
    const { valid } = getWordLists(len);
    if (!valid.has(trimmed.toUpperCase())) return `"${trimmed.toUpperCase()}" is not a valid word`;
    return null;
};

export const ChallengeCreate = memo(function ChallengeCreate() {
    const {
        mode, setMode, length, setLength, maxTime, setMaxTime,
        availableProfiles, invitedIds, toggleInvite,
        joinId, setJoinId, handleViewChallenge, handleCreate, loading
    } = useChallengeContext();

    // Advanced UI States
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [isPublic, setIsPublic] = useState(false);
    const [maxParticipants, setMaxParticipants] = useState<number>(10);
    const [lifespanHours, setLifespanHours] = useState<number>(24);

    // Custom Target Word States
    const [isCustomWord, setIsCustomWord] = useState(false);
    const [customWord, setCustomWord] = useState('');
    const [customWords, setCustomWords] = useState<Record<number, string>>({ 3: '', 4: '', 5: '', 6: '', 7: '' });

    // Marathon Custom Timer States
    const [timerType, setTimerType] = useState<'same' | 'custom'>('same');
    const [marathonTimers, setMarathonTimers] = useState<Record<number, number>>({ 3: 3, 4: 5, 5: 5, 6: 10, 7: 10 });

    // Handicap States
    const [isHandicap, setIsHandicap] = useState(false);
    const [handicapMode, setHandicapMode] = useState<'random' | 'custom'>('random');
    const [handicapEnforced, setHandicapEnforced] = useState(false);
    const [handicapStarter, setHandicapStarter] = useState('');
    const [handicapStarters, setHandicapStarters] = useState<Record<number, string>>({ 3: '', 4: '', 5: '', 6: '', 7: '' });

    // Inline errors
    const errors = useMemo(() => {
        const errs: string[] = [];
        const resolvedLength = length === 0 ? 5 : length;

        if (isCustomWord) {
            if (length === 1) {
                [3, 4, 5, 6, 7].forEach(l => {
                    const w = customWords[l];
                    if (!w) {
                        errs.push(`Marathon: ${l}-letter word is empty.`);
                    } else {
                        const valError = validateCustomWord(w, l);
                        if (valError) errs.push(`Marathon ${l}-letter: ${valError}`);
                    }
                });
            } else {
                const valError = validateCustomWord(customWord, resolvedLength);
                if (valError) errs.push(`Target Word: ${valError}`);
            }
        }

        if (isHandicap && handicapMode === 'custom') {
            if (length === 1) {
                [3, 4, 5, 6, 7].forEach(l => {
                    const w = handicapStarters[l];
                    if (!w) {
                        errs.push(`Handicap: ${l}-letter starter is empty.`);
                    } else {
                        const valError = validateCustomWord(w, l);
                        if (valError) errs.push(`Handicap ${l}-letter: ${valError}`);
                        if (isCustomWord && customWords[l] && w.toUpperCase() === customWords[l].toUpperCase()) {
                            errs.push(`Handicap ${l}-letter starter cannot match target word.`);
                        }
                    }
                });
            } else {
                const valError = validateCustomWord(handicapStarter, resolvedLength);
                if (valError) errs.push(`Handicap Starter: ${valError}`);
                if (isCustomWord && customWord && handicapStarter.toUpperCase() === customWord.toUpperCase()) {
                    errs.push(`Handicap starter cannot match target word.`);
                }
            }
        }

        return errs;
    }, [length, isCustomWord, customWord, customWords, isHandicap, handicapMode, handicapStarter, handicapStarters]);

    const handleCreateTrigger = useCallback(() => {
        if (errors.length > 0) return;

        const customParams: any = {
            isPublic,
            maxParticipants: isPublic ? maxParticipants : null,
            isCustomWord,
            lifespanHours
        };

        if (isCustomWord) {
            if (length === 1) {
                customParams.customWords = customWords;
            } else {
                customParams.customWord = customWord;
            }
        }

        if (isHandicap) {
            customParams.handicapEnforced = handicapEnforced;
            if (handicapMode === 'random') {
                customParams.handicapStarter = '__SYSTEM_RANDOM__';
            } else {
                if (length === 1) {
                    customParams.handicapStarters = handicapStarters;
                } else {
                    customParams.handicapStarter = handicapStarter;
                }
            }
        }

        handleCreate(customParams);
    }, [errors, isPublic, maxParticipants, isCustomWord, customWord, customWords, isHandicap, handicapEnforced, handicapMode, handicapStarter, handicapStarters, lifespanHours, length, handleCreate]);

    return (
        <div className="space-y-6">
            <ModeSelector mode={mode} setMode={setMode} />
            <LengthSelector length={length} setLength={setLength} />
            
            {mode === 'LIVE' && (
                <TimeLimitSelector maxTime={maxTime} setMaxTime={setMaxTime} />
            )}

            <ProfileInviteSystem 
                availableProfiles={availableProfiles} 
                invitedIds={invitedIds} 
                toggleInvite={toggleInvite} 
            />

            {/* Advanced Settings Button */}
            <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex items-center justify-between text-xs font-black uppercase tracking-wider text-gray-300 transition-all"
            >
                <span className="flex items-center gap-2"><Settings2 size={14} /> Advanced Settings</span>
                <span className="text-gray-500">{showAdvanced ? 'Hide' : 'Show'}</span>
            </button>

            {showAdvanced && (
                <div className="p-4 rounded-2xl border border-white/10 bg-white/5 space-y-5 animate-in fade-in duration-300">
                    
                    {/* Public Challenge Option */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-black uppercase text-white">Public Challenge</p>
                                <p className="text-[10px] text-gray-500">Anyone with the link can join</p>
                            </div>
                            <input
                                type="checkbox"
                                checked={isPublic}
                                onChange={(e) => setIsPublic(e.target.checked)}
                                className="w-4 h-4 accent-correct"
                            />
                        </div>
                        {isPublic && (
                            <div className="space-y-2 pl-4 border-l border-white/10">
                                <label className="text-[10px] font-black uppercase text-gray-400">Max Participants (2-100)</label>
                                <input
                                    type="number"
                                    min={2}
                                    max={100}
                                    value={maxParticipants}
                                    onChange={(e) => setMaxParticipants(Math.max(2, Math.min(100, Number(e.target.value))))}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm focus:border-correct outline-none"
                                />
                            </div>
                        )}
                    </div>

                    {/* Lifespan Option */}
                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase text-white flex items-center gap-1.5">
                            Challenge Lifespan
                        </label>
                        <div className="grid grid-cols-4 gap-1.5">
                            {[1, 6, 12, 24].map(h => (
                                <button
                                    key={h}
                                    onClick={() => setLifespanHours(h)}
                                    className={`py-2 rounded-xl border text-[10px] font-black uppercase transition-all ${lifespanHours === h ? 'border-correct bg-correct/10 text-correct' : 'border-white/10 bg-black/20 hover:border-white/20'}`}
                                >
                                    {h}h
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Custom target word option */}
                    <div className="space-y-3 border-t border-white/5 pt-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-black uppercase text-white flex items-center gap-1.5">
                                    <Sparkles size={12} className="text-yellow-500" /> Custom Word Challenge
                                </p>
                                <p className="text-[10px] text-gray-500">Pick target word. Creator cannot play.</p>
                            </div>
                            <input
                                type="checkbox"
                                checked={isCustomWord}
                                onChange={(e) => setIsCustomWord(e.target.checked)}
                                className="w-4 h-4 accent-correct"
                            />
                        </div>
                        {isCustomWord && (
                            <div className="space-y-3 pl-4 border-l border-white/10">
                                {length === 1 ? (
                                    <div className="space-y-2.5">
                                        {[3, 4, 5, 6, 7].map(l => (
                                            <div key={l} className="flex flex-col gap-1">
                                                <span className="text-[9px] font-black uppercase text-gray-400">{l}-letter Word:</span>
                                                <input
                                                    type="text"
                                                    maxLength={l}
                                                    placeholder={`Enter ${l}-letter word`}
                                                    value={customWords[l]}
                                                    onChange={(e) => setCustomWords({ ...customWords, [l]: e.target.value.replace(/[^A-Za-z]/g, '') })}
                                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs focus:border-correct outline-none uppercase"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-gray-400">Target Word ({length === 0 ? '5-letter default' : `${length}-letter`}):</label>
                                        <input
                                            type="text"
                                            maxLength={length === 0 ? 5 : length}
                                            placeholder={`Enter ${length === 0 ? 5 : length}-letter word`}
                                            value={customWord}
                                            onChange={(e) => setCustomWord(e.target.value.replace(/[^A-Za-z]/g, ''))}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm focus:border-correct outline-none uppercase"
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Handicap Options */}
                    <div className="space-y-3 border-t border-white/5 pt-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-black uppercase text-white flex items-center gap-1.5">
                                    <Shield size={12} className="text-yellow-500" /> Handicap Challenge
                                </p>
                                <p className="text-[10px] text-gray-500">Provide starter word(s) for players</p>
                            </div>
                            <input
                                type="checkbox"
                                checked={isHandicap}
                                onChange={(e) => setIsHandicap(e.target.checked)}
                                className="w-4 h-4 accent-correct"
                            />
                        </div>
                        {isHandicap && (
                            <div className="space-y-3.5 pl-4 border-l border-white/10">
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black uppercase text-gray-400">Starter Type:</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => setHandicapMode('random')}
                                            className={`py-2 rounded-xl border text-[10px] font-black uppercase transition-all ${handicapMode === 'random' ? 'border-correct bg-correct/10 text-correct' : 'border-white/10 bg-black/20'}`}
                                        >
                                            System Random
                                        </button>
                                        <button
                                            onClick={() => setHandicapMode('custom')}
                                            className={`py-2 rounded-xl border text-[10px] font-black uppercase transition-all ${handicapMode === 'custom' ? 'border-correct bg-correct/10 text-correct' : 'border-white/10 bg-black/20'}`}
                                        >
                                            Custom Word
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-gray-300">Enforce Starter Word</p>
                                        <p className="text-[8px] text-gray-500">True = automatically submitted first guess</p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={handicapEnforced}
                                        onChange={(e) => setHandicapEnforced(e.target.checked)}
                                        className="w-3.5 h-3.5 accent-correct"
                                    />
                                </div>

                                {handicapMode === 'custom' && (
                                    <div className="space-y-2.5">
                                        {length === 1 ? (
                                            [3, 4, 5, 6, 7].map(l => (
                                                <div key={l} className="flex flex-col gap-1">
                                                    <span className="text-[9px] font-black uppercase text-gray-400">{l}-letter Starter:</span>
                                                    <input
                                                        type="text"
                                                        maxLength={l}
                                                        placeholder={`Enter ${l}-letter starter`}
                                                        value={handicapStarters[l]}
                                                        onChange={(e) => setHandicapStarters({ ...handicapStarters, [l]: e.target.value.replace(/[^A-Za-z]/g, '') })}
                                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs focus:border-correct outline-none uppercase"
                                                    />
                                                </div>
                                            ))
                                        ) : (
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black uppercase text-gray-400">Starter Word ({length === 0 ? '5-letter' : `${length}-letter`}):</label>
                                                <input
                                                    type="text"
                                                    maxLength={length === 0 ? 5 : length}
                                                    placeholder={`Enter starter word`}
                                                    value={handicapStarter}
                                                    onChange={(e) => setHandicapStarter(e.target.value.replace(/[^A-Za-z]/g, ''))}
                                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs focus:border-correct outline-none uppercase"
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Inline Errors Display */}
            {errors.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 p-3.5 rounded-2xl space-y-1.5 animate-in fade-in duration-300">
                    <p className="text-[10px] font-black uppercase text-red-500">Please correct the following errors:</p>
                    <ul className="list-disc pl-4 text-[10px] text-red-400/90 font-bold space-y-1">
                        {errors.map((e, idx) => <li key={idx}>{e}</li>)}
                    </ul>
                </div>
            )}

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
                    onClick={handleCreateTrigger}
                    disabled={loading || errors.length > 0}
                    className="w-full bg-correct text-black py-5 rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-xl hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:brightness-50"
                >
                    {loading ? 'Creating...' : <><Plus size={18} /> Create Challenge</>}
                </button>
            </div>
        </div>
    );
});
