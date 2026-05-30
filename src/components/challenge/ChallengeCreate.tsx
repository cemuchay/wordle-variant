/* eslint-disable @typescript-eslint/no-explicit-any */
import { Clock, Play, Plus, Search, X, ChevronUp, ChevronDown, HelpCircle, Settings2 } from 'lucide-react';
import { memo, useState, useMemo, useCallback, useEffect } from 'react';
import { useChallengeContext } from '../../context/ChallengeContext';
import { useConfirmation } from '../../hooks/useConfirmation';
import { useAdminStatus } from '../../hooks/useAdminStatus';

const OptionLabel = memo(({ label, tooltip, activeTooltip, setActiveTooltip, tooltipId, className = "" }: {
    label: string;
    tooltip: string;
    activeTooltip: string | null;
    setActiveTooltip: (id: string | null) => void;
    tooltipId: string;
    className?: string;
}) => {
    const isOpen = activeTooltip === tooltipId;
    return (
        <div className={`flex items-center gap-1.5 relative select-none ${className}`}>
            <span className="text-xs font-black uppercase tracking-widest text-white">
                {label}
            </span>
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    setActiveTooltip(isOpen ? null : tooltipId);
                }}
                className="text-white/80 hover:text-white p-0.5 rounded-full transition-colors flex items-center justify-center focus:outline-none animate-pulse hover:animate-none"
                title="What is this?"
            >
                <HelpCircle size={13} />
            </button>
            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40 pointer-events-auto"
                        onClick={(e) => {
                            e.stopPropagation();
                            setActiveTooltip(null);
                        }}
                    />
                    <div className="absolute left-0 top-6 z-50 bg-gray-950 border border-white/20 p-3.5 rounded-2xl shadow-2xl text-[11px] leading-relaxed text-white font-medium normal-case tracking-normal w-64 max-w-[85vw] animate-in fade-in zoom-in duration-150">
                        {tooltip}
                    </div>
                </>
            )}
        </div>
    );
});

const ModeSelector = memo(({ mode, setMode, activeTooltip, setActiveTooltip }: { 
    mode: 'LIVE' | 'ANYTIME', 
    setMode: (m: 'LIVE' | 'ANYTIME') => void,
    activeTooltip: string | null,
    setActiveTooltip: (id: string | null) => void
}) => (
    <div className="bg-white/5 border border-white/10 p-5 rounded-2xl space-y-4 hover:border-white/25 transition-all">
        <OptionLabel 
            label="Mode" 
            tooltip="Choose between 'Anytime' (play at your own pace within 24h, results updated async) and 'Live' (synchronous race against other players with a timer, and real-time audio chat)." 
            activeTooltip={activeTooltip} 
            setActiveTooltip={setActiveTooltip} 
            tooltipId="mode" 
        />
        <div className="grid grid-cols-2 gap-3">
            <button
                type="button"
                onClick={() => setMode('ANYTIME')}
                className={`p-4 rounded-2xl border transition-all text-left ${mode === 'ANYTIME' ? 'border-correct bg-correct/15 border-2 shadow-lg shadow-correct/5' : 'border-white/15 bg-white/5 hover:border-white/30 hover:bg-white/10'}`}
            >
                <div className="flex items-center justify-between mb-2">
                    <Clock className={mode === 'ANYTIME' ? 'text-correct' : 'text-white/80'} size={18} />
                    {mode === 'ANYTIME' && <div className="w-2 h-2 bg-correct rounded-full" />}
                </div>
                <p className="text-xs font-black uppercase text-white">Anytime</p>
                <p className="text-[9px] text-white/80 mt-0.5">24h async play</p>
            </button>
            <button
                type="button"
                onClick={() => setMode('LIVE')}
                className={`p-4 rounded-2xl border transition-all text-left ${mode === 'LIVE' ? 'border-red-500 bg-red-500/15 border-2 shadow-lg shadow-red-500/5' : 'border-white/15 bg-white/5 hover:border-white/30 hover:bg-white/10'}`}
            >
                <div className="flex items-center justify-between mb-2">
                    <Play className={mode === 'LIVE' ? 'text-red-500' : 'text-white/80'} size={18} />
                    {mode === 'LIVE' && <div className="w-2 h-2 bg-red-500 rounded-full" />}
                </div>
                <p className="text-xs font-black uppercase text-white">Live</p>
                <p className="text-[9px] text-white/80 mt-0.5">Timed race & voice</p>
            </button>
        </div>
    </div>
));

const LengthSelector = memo(({ length, setLength, activeTooltip, setActiveTooltip }: { 
    length: number, 
    setLength: (l: number) => void,
    activeTooltip: string | null,
    setActiveTooltip: (id: string | null) => void
}) => (
    <div className="bg-white/5 border border-white/10 p-5 rounded-2xl space-y-4 hover:border-white/25 transition-all">
        <OptionLabel 
            label="Word Length" 
            tooltip="Select word length for the challenge. Choose 'Random' for a surprise length, or 'Marathon' to compete across a sequence of multiple word lengths." 
            activeTooltip={activeTooltip} 
            setActiveTooltip={setActiveTooltip} 
            tooltipId="length" 
        />
        <div className="flex gap-2 flex-wrap">
            {[3, 4, 5, 6, 7].map((l) => (
                <button
                    key={l}
                    type="button"
                    onClick={() => setLength(l)}
                    className={`w-11 h-11 rounded-xl border font-black transition-all ${length === l ? 'border-correct bg-correct text-black border-2 shadow-lg shadow-correct/10 text-sm' : 'border-white/15 bg-white/5 text-white hover:border-white/30 hover:bg-white/10 text-xs'}`}
                >
                    {l}
                </button>
            ))}
            <button
                type="button"
                onClick={() => setLength(0)} // 0 for random
                className={`px-4 h-11 rounded-xl border font-black text-[10px] uppercase tracking-wider transition-all ${length === 0 ? 'border-correct bg-correct text-black border-2 shadow-lg shadow-correct/10' : 'border-white/15 bg-white/5 text-white hover:border-white/30 hover:bg-white/10'}`}
            >
                Random
            </button>
            <button
                type="button"
                onClick={() => setLength(1)} // 1 for marathon
                className={`px-4 h-11 rounded-xl border font-black text-[10px] uppercase tracking-wider transition-all ${length === 1 ? 'border-yellow-500 bg-yellow-500 text-black border-2 shadow-lg shadow-yellow-500/20' : 'border-white/15 bg-white/5 text-white hover:border-white/30 hover:bg-white/10'}`}
            >
                Marathon
            </button>
        </div>
    </div>
));

const TimeLimitSelector = memo(({ maxTime, setMaxTime, activeTooltip, setActiveTooltip }: { 
    maxTime: number | null, 
    setMaxTime: (t: number) => void,
    activeTooltip: string | null,
    setActiveTooltip: (id: string | null) => void
}) => (
    <div className="bg-white/5 border border-white/10 p-5 rounded-2xl space-y-4 hover:border-white/25 transition-all">
        <OptionLabel 
            label="Time Limit (Per Game)" 
            tooltip="The maximum duration allowed for each participant to guess the word (Only applies to Live mode)." 
            activeTooltip={activeTooltip} 
            setActiveTooltip={setActiveTooltip} 
            tooltipId="timeLimit" 
        />
        <div className="flex gap-3">
            {[3, 5, 10].map((t) => (
                <button
                    key={t}
                    type="button"
                    onClick={() => setMaxTime(t)}
                    className={`flex-1 p-3.5 rounded-xl border text-sm font-black transition-all ${maxTime === t ? 'border-2 border-red-500 bg-red-500/20 text-red-400 shadow-lg shadow-red-500/10' : 'border-white/15 bg-white/5 text-white hover:border-white/30 hover:bg-white/10'}`}
                >
                    {t}m
                </button>
            ))}
        </div>
    </div>
));

const ProfileInviteSystem = memo(({ availableProfiles, invitedIds, toggleInvite, activeTooltip, setActiveTooltip }: { 
    availableProfiles: any[], 
    invitedIds: string[], 
    toggleInvite: (id: string) => void,
    activeTooltip: string | null,
    setActiveTooltip: (id: string | null) => void
}) => {
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
        <div className="bg-indigo-950/20 border-2 border-indigo-500/30 p-5 rounded-2xl space-y-4 hover:border-indigo-400/50 shadow-[0_0_20px_rgba(99,102,241,0.1)] transition-all relative">
            <OptionLabel 
                label="Invite Friends" 
                tooltip="Search and invite other registered players to join this challenge lobby." 
                activeTooltip={activeTooltip} 
                setActiveTooltip={setActiveTooltip} 
                tooltipId="inviteFriends" 
            />
            
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
                        <Search className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${isDropdownOpen ? 'text-correct' : 'text-white/80'}`} size={16} />
                        <input
                            type="text"
                            placeholder="Search by username..."
                            value={profileSearch}
                            onFocus={() => setIsDropdownOpen(true)}
                            onChange={(e) => setProfileSearch(e.target.value)}
                            className="w-full bg-white/5 border border-white/15 rounded-2xl py-3.5 pl-11 pr-4 text-sm focus:outline-none focus:border-correct/60 focus:bg-white/10 focus:ring-1 focus:ring-correct/30 transition-all text-white placeholder-white/60"
                        />
                        {profileSearch && (
                            <button 
                                onClick={() => setProfileSearch('')}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white"
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
                                            <p className="text-[9px] text-white/80 uppercase font-bold">Available</p>
                                        </div>
                                        <Plus size={14} className="ml-auto text-white/80 group-hover:text-correct" />
                                    </button>
                                ))
                            ) : (
                                <div className="p-8 text-center">
                                    <p className="text-[10px] text-white/80 uppercase font-black">{profileSearch ? 'No users found' : 'Type to search users'}</p>
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


const validateCustomWord = (word: string, len: number) => {
    const trimmed = word.trim();
    if (!trimmed) return "Cannot be empty";
    if (trimmed.length !== len) return `Must be exactly ${len} letters`;
    const { valid } = getWordLists(len);
    if (!valid.has(trimmed.toUpperCase())) return `"${trimmed.toUpperCase()}" is not a valid word`;
    return null;
};

const resolveNewStarterInput = (newVal: string, prevVal: string) => {
    if (prevVal === '__MASKED__') {
        if (newVal.startsWith('__MASKED__')) {
            return newVal.substring(10).replace(/[^A-Za-z]/g, '');
        }
        if ('__MASKED__'.startsWith(newVal)) {
            return '';
        }
        return newVal.replace(/[^A-Za-z]/g, '');
    }
    return newVal.replace(/[^A-Za-z]/g, '');
};

export interface ChallengeCreateProps {
    onSuccess?: () => void;
    editingChallenge?: any;
}

export const ChallengeCreate = memo(function ChallengeCreate({ onSuccess, editingChallenge }: ChallengeCreateProps) {
    const {
        mode, setMode, length, setLength, maxTime, setMaxTime,
        availableProfiles, invitedIds, toggleInvite,
        joinId, setJoinId, handleViewChallenge, handleCreate, loading,
        handleEdit, setInvitedIds, effectiveUser
    } = useChallengeContext();
    const { ask } = useConfirmation();

    // Initialize edit fields
    useEffect(() => {
        if (editingChallenge) {
            setMode(editingChallenge.mode);
            setLength(editingChallenge.word_length);
            setMaxTime(editingChallenge.max_time);

            const invites = editingChallenge.participants
                ?.filter((p: any) => p.user_id !== editingChallenge.creator_id)
                .map((p: any) => p.user_id || p.guest_id || '')
                .filter(Boolean) || [];
            setInvitedIds(invites);

            setMarathonForceOrder(!!editingChallenge.marathon_force_order);
            setIsPublic(!!editingChallenge.is_public);
            if (editingChallenge.max_participants !== undefined && editingChallenge.max_participants !== null) {
                setMaxParticipants(editingChallenge.max_participants);
                setMaxParticipantsInput(String(editingChallenge.max_participants));
            }
            setIsCustomWord(!!editingChallenge.is_custom_word);
            setDisableHints(!!editingChallenge.disable_hints);

            const hasHandicap = !!editingChallenge.handicap_starter || !!editingChallenge.handicap_starters;
            setIsHandicap(hasHandicap);
            if (hasHandicap) {
                const isRandom = !!editingChallenge.handicap_starter_is_random;
                setHandicapMode(isRandom ? 'random' : 'custom');
                setHandicapEnforced(!!editingChallenge.handicap_enforced);

                if (!isRandom) {
                    const isCreatorPlayer = !editingChallenge.is_custom_word;
                    if (editingChallenge.word_length === 1 && Array.isArray(editingChallenge.handicap_starters)) {
                        setHandicapStartersArray(
                            isCreatorPlayer 
                                ? Array(editingChallenge.handicap_starters.length).fill('__MASKED__')
                                : editingChallenge.handicap_starters
                        );
                    } else if (editingChallenge.handicap_starter) {
                        setHandicapStarter(isCreatorPlayer ? '__MASKED__' : editingChallenge.handicap_starter);
                    }
                }
            }

            if (editingChallenge.word_length === 1) {
                try {
                    const parsed = JSON.parse(editingChallenge.target_word);
                    if (Array.isArray(parsed)) {
                        const lengths = parsed.map((g: any) => g.length);
                        setMarathonGames(lengths);
                        setMarathonType('custom');
                    }
                } catch (e) {
                    console.error('Failed to parse marathon sequence', e);
                }

                if (editingChallenge.marathon_timers) {
                    setTimerType('custom');
                    const timers = Object.values(editingChallenge.marathon_timers).map(Number);
                    setMarathonTimersArray(timers);
                    setMarathonTimersInput(timers.map(String));
                }
            }
        }
    }, [editingChallenge, setMode, setLength, setMaxTime, setInvitedIds]);

    // Tooltip & Rule States
    const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
    const [marathonForceOrder, setMarathonForceOrder] = useState(false);

    // Marathon Mode States
    const [marathonType, setMarathonType] = useState<'standard' | 'custom'>('standard');
    const [marathonGames, setMarathonGames] = useState<number[]>([3, 4, 5, 6, 7]);

    // Advanced UI States
    const [showAdvanced, setShowAdvanced] = useState(true);
    const [isPublic, setIsPublic] = useState(false);
    const [maxParticipants, setMaxParticipants] = useState<number>(10);
    const [maxParticipantsInput, setMaxParticipantsInput] = useState<string>("10");
    const [lifespanHours, setLifespanHours] = useState<number>(24);

    // Custom Target Word States
    const [isCustomWord, setIsCustomWord] = useState(false);
    const [customWord, setCustomWord] = useState('');
    const [customMarathonWords, setCustomMarathonWords] = useState<string[]>(() => Array(5).fill(''));

    // Marathon Custom Timer States
    const [timerType, setTimerType] = useState<'same' | 'custom'>('same');
    const [marathonTimersArray, setMarathonTimersArray] = useState<number[]>([3, 5, 5, 10, 10]);
    const [marathonTimersInput, setMarathonTimersInput] = useState<string[]>(['3', '5', '5', '10', '10']);

    // Handicap States
    const { isAdmin } = useAdminStatus(effectiveUser?.id);
    const [isBotMarathon, setIsBotMarathon] = useState(false);
    const [isHandicap, setIsHandicap] = useState(false);
    const [disableHints, setDisableHints] = useState(false);
    const [handicapMode, setHandicapMode] = useState<'random' | 'custom'>('random');
    const [handicapEnforced, setHandicapEnforced] = useState(false);
    const [handicapStarter, setHandicapStarter] = useState('');
    const [handicapStartersArray, setHandicapStartersArray] = useState<string[]>(() => Array(5).fill(''));

    // Handle lifespan options alignment based on challenge type
    useEffect(() => {
        if (isBotMarathon) {
            if (![24, 48, 72, 168].includes(lifespanHours)) {
                setLifespanHours(24);
            }
        } else {
            if (![1, 6, 12, 24].includes(lifespanHours)) {
                setLifespanHours(24);
            }
        }
    }, [isBotMarathon, lifespanHours, setLifespanHours]);

    const handleUpdateMarathonGames = useCallback((newGames: number[]) => {
        setMarathonGames(newGames);
        
        // Adjust custom target words
        setCustomMarathonWords(prev => {
            const next = [...prev];
            if (next.length < newGames.length) {
                while (next.length < newGames.length) next.push('');
            } else if (next.length > newGames.length) {
                next.length = newGames.length;
            }
            return next;
        });

        // Adjust handicap starters
        setHandicapStartersArray(prev => {
            const next = [...prev];
            if (next.length < newGames.length) {
                while (next.length < newGames.length) next.push('');
            } else if (next.length > newGames.length) {
                next.length = newGames.length;
            }
            return next;
        });

        // Adjust marathon timers
        setMarathonTimersArray(prev => {
            const next = [...prev];
            if (next.length < newGames.length) {
                while (next.length < newGames.length) {
                    const addedLen = newGames[next.length];
                    const defaultTime = addedLen === 3 ? 3 : addedLen === 4 ? 5 : addedLen === 5 ? 5 : 10;
                    next.push(defaultTime);
                }
            } else if (next.length > newGames.length) {
                next.length = newGames.length;
            }
            return next;
        });

        setMarathonTimersInput(prev => {
            const next = [...prev];
            if (next.length < newGames.length) {
                while (next.length < newGames.length) {
                    const addedLen = newGames[next.length];
                    const defaultTime = addedLen === 3 ? 3 : addedLen === 4 ? 5 : addedLen === 5 ? 5 : 10;
                    next.push(String(defaultTime));
                }
            } else if (next.length > newGames.length) {
                next.length = newGames.length;
            }
            return next;
        });
    }, []);

    const handleSetMarathonType = useCallback((type: 'standard' | 'custom') => {
        setMarathonType(type);
        if (type === 'standard') {
            handleUpdateMarathonGames([3, 4, 5, 6, 7]);
        }
    }, [handleUpdateMarathonGames]);

    const handleMoveGame = useCallback((idx: number, direction: 'up' | 'down') => {
        const next = [...marathonGames];
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= next.length) return;
        const temp = next[idx];
        next[idx] = next[targetIdx];
        next[targetIdx] = temp;
        handleUpdateMarathonGames(next);
    }, [marathonGames, handleUpdateMarathonGames]);

    // Inline errors
    const errors = useMemo(() => {
        const errs: string[] = [];
        const resolvedLength = length === 0 ? 5 : length;

        if (isCustomWord) {
            if (length === 1) {
                marathonGames.forEach((l, idx) => {
                    const w = customMarathonWords[idx];
                    if (!w) {
                        if (!editingChallenge) {
                            errs.push(`Game #${idx + 1} (${l}-letter): Target word is empty.`);
                        }
                    } else {
                        const valError = validateCustomWord(w, l);
                        if (valError) errs.push(`Game #${idx + 1} (${l}-letter): ${valError}`);
                    }
                });
            } else {
                if (!customWord) {
                    if (!editingChallenge) {
                        errs.push(`Target Word: Cannot be empty.`);
                    }
                } else {
                    const valError = validateCustomWord(customWord, resolvedLength);
                    if (valError) errs.push(`Target Word: ${valError}`);
                }
            }
        }

        if (isHandicap && handicapMode === 'custom') {
            if (length === 1) {
                marathonGames.forEach((l, idx) => {
                    const w = handicapStartersArray[idx];
                    if (!w) {
                        if (!editingChallenge) {
                            errs.push(`Game #${idx + 1} (${l}-letter): Starter word is empty.`);
                        }
                    } else if (w !== '__MASKED__') {
                        const valError = validateCustomWord(w, l);
                        if (valError) errs.push(`Game #${idx + 1} (${l}-letter): ${valError}`);
                        if (isCustomWord && customMarathonWords[idx] && w.toUpperCase() === customMarathonWords[idx].toUpperCase()) {
                            errs.push(`Game #${idx + 1} (${l}-letter): Starter word cannot match target word.`);
                        }
                    }
                });
            } else {
                if (!handicapStarter) {
                    if (!editingChallenge) {
                        errs.push(`Handicap Starter: Cannot be empty.`);
                    }
                } else if (handicapStarter !== '__MASKED__') {
                    const valError = validateCustomWord(handicapStarter, resolvedLength);
                    if (valError) errs.push(`Handicap Starter: ${valError}`);
                    if (isCustomWord && customWord && handicapStarter.toUpperCase() === customWord.toUpperCase()) {
                        errs.push(`Handicap starter cannot match target word.`);
                    }
                }
            }
        }

        if (length === 1 && marathonGames.length === 0) {
            errs.push("Marathon must have at least 1 game.");
        }

        if (isBotMarathon && lifespanHours > 168) {
            errs.push("Daily Bot Challenge lifespan cannot exceed 7 days (168 hours).");
        }

        return errs;
    }, [length, marathonGames, isCustomWord, customWord, customMarathonWords, isHandicap, handicapMode, handicapStarter, handicapStartersArray, editingChallenge]);

    const handleCreateTrigger = useCallback(async () => {
        if (errors.length > 0) return;

        if (!isPublic && invitedIds.length === 0) {
            const confirmed = await ask({
                title: 'No Friends Invited',
                message: 'You have not invited any friends and this challenge is not public. Are you sure you want to create a private challenge for just yourself?',
                confirmLabel: 'Create Anyway',
                type: 'info'
            });
            if (!confirmed) return;
        }

        const customParams: any = {
            isPublic,
            maxParticipants: isPublic ? maxParticipants : null,
            isCustomWord,
            lifespanHours,
            invitedIds,
            disableHints,
            is_bot_marathon: isBotMarathon
        };

        if (isCustomWord) {
            if (length === 1) {
                const wordsList = customMarathonWords.filter(Boolean);
                if (wordsList.length > 0) {
                    customParams.customWords = customMarathonWords;
                }
            } else {
                if (customWord) {
                    customParams.customWord = customWord;
                }
            }
        }

        customParams.isHandicap = isHandicap;
        if (isHandicap) {
            customParams.handicapEnforced = handicapEnforced;
            if (handicapMode === 'random') {
                customParams.handicapStarter = '__SYSTEM_RANDOM__';
            } else {
                if (length === 1) {
                    customParams.handicapStarters = handicapStartersArray;
                } else {
                    customParams.handicapStarter = handicapStarter;
                }
            }
        }

        if (length === 1) {
            customParams.marathonGames = marathonGames;
            customParams.marathonForceOrder = marathonForceOrder;
            if (mode === 'LIVE' && timerType === 'custom') {
                customParams.marathonTimers = marathonTimersArray;
            }
        }

        if (editingChallenge) {
            await handleEdit(editingChallenge.id, customParams);
        } else {
            await handleCreate(customParams, !onSuccess);
        }
        
        if (onSuccess) {
            onSuccess();
        }
    }, [errors, isPublic, maxParticipants, isCustomWord, customWord, customMarathonWords, isHandicap, handicapEnforced, handicapMode, handicapStarter, handicapStartersArray, lifespanHours, length, handleCreate, handleEdit, mode, timerType, marathonTimersArray, marathonGames, marathonForceOrder, onSuccess, editingChallenge, invitedIds, ask]);

    return (
        <div className="space-y-6">
            <ModeSelector mode={mode} setMode={setMode} activeTooltip={activeTooltip} setActiveTooltip={setActiveTooltip} />
            <LengthSelector length={length} setLength={setLength} activeTooltip={activeTooltip} setActiveTooltip={setActiveTooltip} />

            {length === 1 && (
                <div className="p-5 rounded-2xl border border-yellow-500/25 bg-yellow-500/5 space-y-4 animate-in fade-in duration-300">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-black uppercase text-white">Marathon Mode Setup</p>
                            <p className="text-[10px] text-white/80">Configure your marathon format</p>
                        </div>
                        
                        <div className="flex bg-black/40 rounded-lg p-1 border border-white/10">
                            <button
                                type="button"
                                onClick={() => handleSetMarathonType('standard')}
                                className={`px-3 py-1 rounded-md text-[9px] font-black uppercase transition-all ${marathonType === 'standard' ? 'bg-yellow-500 text-black font-extrabold' : 'text-white/80'}`}
                            >
                                Standard (3-7L)
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSetMarathonType('custom')}
                                className={`px-3 py-1 rounded-md text-[9px] font-black uppercase transition-all ${marathonType === 'custom' ? 'bg-yellow-500 text-black font-extrabold' : 'text-white/80'}`}
                            >
                                Custom
                            </button>
                        </div>
                    </div>

                    {marathonType === 'custom' && (
                        <div className="space-y-4 animate-in fade-in duration-200">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-wider text-white">
                                    Current Game Sequence ({marathonGames.length}/20 Games)
                                </label>
                                
                                {marathonGames.length === 0 ? (
                                    <div className="text-center py-6 border border-dashed border-white/10 rounded-xl bg-black/20">
                                        <p className="text-[10px] text-white/80 font-bold uppercase">No games added yet. Click lengths below to build your sequence.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2 p-3 bg-black/40 rounded-xl border border-white/10 max-h-[220px] overflow-y-auto">
                                        {marathonGames.map((l, idx) => (
                                            <div 
                                                key={idx} 
                                                className="flex items-center justify-between px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-black text-white transition-colors"
                                            >
                                                <span className="text-white">Game #{idx + 1}: <strong className="text-yellow-500 ml-1">{l}L Word</strong></span>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleMoveGame(idx, 'up')}
                                                        disabled={idx === 0}
                                                        className="p-1 text-white/80 hover:text-white disabled:opacity-30 disabled:hover:text-white/80 transition-colors"
                                                    >
                                                        <ChevronUp size={14} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleMoveGame(idx, 'down')}
                                                        disabled={idx === marathonGames.length - 1}
                                                        className="p-1 text-white/80 hover:text-white disabled:opacity-30 disabled:hover:text-white/80 transition-colors"
                                                    >
                                                        <ChevronDown size={14} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const next = [...marathonGames];
                                                            next.splice(idx, 1);
                                                            handleUpdateMarathonGames(next);
                                                        }}
                                                        className="p-1 text-white/80 hover:text-red-500 transition-colors ml-1"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-wider text-white">
                                    Add Game Length
                                </label>
                                <div className="flex gap-2">
                                    {[3, 4, 5, 6, 7].map((l) => (
                                        <button
                                            key={l}
                                            type="button"
                                            disabled={marathonGames.length >= 20}
                                            onClick={() => {
                                                if (marathonGames.length < 20) {
                                                    handleUpdateMarathonGames([...marathonGames, l]);
                                                }
                                            }}
                                            className="flex-1 py-2.5 rounded-xl border border-white/10 bg-black/20 hover:bg-white/5 text-xs font-black text-yellow-500 transition-all disabled:opacity-30 disabled:hover:bg-black/20"
                                        >
                                            +{l}L
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Force Game Order Option */}
                    <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-2">
                        <OptionLabel 
                            label="Force Game Order" 
                            tooltip="Forces players to play games sequentially. Game #N must be completed/failed to unlock Game #(N+1)." 
                            activeTooltip={activeTooltip} 
                            setActiveTooltip={setActiveTooltip} 
                            tooltipId="forceOrder" 
                        />
                        <input
                            type="checkbox"
                            checked={marathonForceOrder}
                            onChange={(e) => setMarathonForceOrder(e.target.checked)}
                            className="w-5 h-5 accent-yellow-500 cursor-pointer"
                        />
                    </div>
                </div>
            )}
            
            {mode === 'LIVE' && (
                <TimeLimitSelector maxTime={maxTime} setMaxTime={setMaxTime} activeTooltip={activeTooltip} setActiveTooltip={setActiveTooltip} />
            )}

            {/* Advanced Settings Button */}
            <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full py-3.5 px-4 bg-white/10 hover:bg-white/15 border border-white/20 rounded-2xl flex items-center justify-between text-xs font-black uppercase tracking-wider text-white transition-all shadow-md"
            >
                <span className="flex items-center gap-2"><Settings2 size={14} /> Advanced Settings</span>
                <span className="text-white/80">{showAdvanced ? 'Hide' : 'Show'}</span>
            </button>

            {showAdvanced && (
                <div className="p-5 rounded-2xl border border-white/15 bg-white/5 space-y-5 animate-in fade-in duration-300">
                    
                    {/* Daily Challenge Option (Admins Only) */}
                    {isAdmin && (
                        <div className="space-y-3 bg-indigo-950/20 p-4 rounded-xl border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.05)]">
                            <div className="flex items-center justify-between">
                                <OptionLabel 
                                    label="Daily Bot Challenge" 
                                    tooltip="If enabled, the challenge creator will be set to 'Variant Bot'. Anyone can join, and all game words are pre-salted and saved at creation time." 
                                    activeTooltip={activeTooltip} 
                                    setActiveTooltip={setActiveTooltip} 
                                    tooltipId="dailyBotChallenge" 
                                />
                                <input
                                    type="checkbox"
                                    checked={isBotMarathon}
                                    onChange={(e) => setIsBotMarathon(e.target.checked)}
                                    className="w-5 h-5 accent-indigo-500 cursor-pointer"
                                />
                            </div>
                        </div>
                    )}

                    {/* Disable Hints Option */}
                    <div className="space-y-3 bg-black/20 p-4 rounded-xl border border-white/5">
                        <div className="flex items-center justify-between">
                            <OptionLabel 
                                label="Disable Hints" 
                                tooltip="If enabled, players will not be allowed to use lightbulb hints during gameplay." 
                                activeTooltip={activeTooltip} 
                                setActiveTooltip={setActiveTooltip} 
                                tooltipId="disableHints" 
                            />
                            <input
                                type="checkbox"
                                checked={disableHints}
                                onChange={(e) => setDisableHints(e.target.checked)}
                                className="w-5 h-5 accent-correct cursor-pointer"
                            />
                        </div>
                    </div>

                    {/* Public Challenge Option */}
                    <div className="space-y-3 bg-black/20 p-4 rounded-xl border border-white/5">
                        <div className="flex items-center justify-between">
                            <OptionLabel 
                                label="Public Challenge" 
                                tooltip="When enabled, anyone with the challenge link can join. Otherwise, only explicitly invited players can enter." 
                                activeTooltip={activeTooltip} 
                                setActiveTooltip={setActiveTooltip} 
                                tooltipId="publicChallenge" 
                            />
                            <input
                                type="checkbox"
                                checked={isPublic}
                                onChange={(e) => setIsPublic(e.target.checked)}
                                className="w-5 h-5 accent-correct cursor-pointer"
                            />
                        </div>
                        {isPublic && (
                            <div className="space-y-2 pl-4 border-l border-white/10 animate-in slide-in-from-left duration-200">
                                <OptionLabel 
                                    label="Max Participants" 
                                    tooltip="Limit the total number of players allowed in this public lobby (between 2 and 100)." 
                                    activeTooltip={activeTooltip} 
                                    setActiveTooltip={setActiveTooltip} 
                                    tooltipId="maxParticipants" 
                                />
                                <input
                                    type="number"
                                    inputMode="numeric"
                                    min={2}
                                    max={100}
                                    value={maxParticipantsInput}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setMaxParticipantsInput(val);
                                        const num = Number(val);
                                        if (!isNaN(num) && num >= 2 && num <= 100) {
                                            setMaxParticipants(num);
                                        }
                                    }}
                                    onBlur={() => {
                                        let num = parseInt(maxParticipantsInput, 10);
                                        if (isNaN(num)) num = 10;
                                        else if (num < 2) num = 2;
                                        else if (num > 100) num = 100;
                                        setMaxParticipants(num);
                                        setMaxParticipantsInput(String(num));
                                    }}
                                    className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-2.5 text-sm focus:border-correct/60 focus:bg-black/60 outline-none text-white transition-all"
                                />
                            </div>
                        )}
                    </div>

                    {/* Lifespan Option */}
                    <div className="space-y-3 bg-black/20 p-4 rounded-xl border border-white/5">
                        <OptionLabel 
                            label="Challenge Lifespan" 
                            tooltip="The number of hours this challenge lobby will remain open before automatically expiring." 
                            activeTooltip={activeTooltip} 
                            setActiveTooltip={setActiveTooltip} 
                            tooltipId="lifespan" 
                        />
                        <div className="grid grid-cols-4 gap-2">
                            {(isBotMarathon ? [24, 48, 72, 168] : [1, 6, 12, 24]).map(h => (
                                <button
                                    key={h}
                                    type="button"
                                    onClick={() => setLifespanHours(h)}
                                    className={`py-2.5 rounded-xl border text-[10px] font-black uppercase transition-all ${lifespanHours === h ? 'border-correct bg-correct/10 text-correct' : 'border-white/10 bg-black/20 hover:border-white/20'}`}
                                >
                                    {h}h
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Custom target word option */}
                    <div className="space-y-3 bg-black/20 p-4 rounded-xl border border-white/5">
                        <div className="flex items-center justify-between">
                            <OptionLabel 
                                label="Custom Word Challenge" 
                                tooltip="Creator handpicks the target word(s) instead of system generating them. (Note: As creator, you cannot play in custom word challenges)." 
                                activeTooltip={activeTooltip} 
                                setActiveTooltip={setActiveTooltip} 
                                tooltipId="customWord" 
                            />
                            <input
                                type="checkbox"
                                checked={isCustomWord}
                                onChange={(e) => setIsCustomWord(e.target.checked)}
                                className="w-5 h-5 accent-correct cursor-pointer"
                            />
                        </div>
                        {isCustomWord && (
                            <div className="space-y-3 pl-4 border-l border-white/10 animate-in slide-in-from-left duration-200">
                                {length === 1 ? (
                                    <div className="space-y-2.5">
                                        {marathonGames.map((l, idx) => (
                                            <div key={idx} className="flex flex-col gap-1">
                                                <span className="text-[10px] font-black uppercase text-white">Game #{idx + 1} ({l}-letter Word):</span>
                                                <input
                                                    type="text"
                                                    maxLength={l}
                                                    placeholder={`Enter ${l}-letter word`}
                                                    value={customMarathonWords[idx] || ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value.replace(/[^A-Za-z]/g, '');
                                                        setCustomMarathonWords(prev => {
                                                            const next = [...prev];
                                                            next[idx] = val;
                                                            return next;
                                                        });
                                                    }}
                                                    className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs focus:border-correct/60 focus:bg-black/60 outline-none uppercase text-white transition-all"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-white">Target Word ({length === 0 ? '5-letter default' : `${length}-letter`}):</label>
                                        <input
                                            type="text"
                                            maxLength={length === 0 ? 5 : length}
                                            placeholder={`Enter ${length === 0 ? 5 : length}-letter word`}
                                            value={customWord}
                                            onChange={(e) => setCustomWord(e.target.value.replace(/[^A-Za-z]/g, ''))}
                                            className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-3 text-sm focus:border-correct/60 focus:bg-black/60 outline-none uppercase text-white transition-all"
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Handicap Options */}
                    <div className="space-y-3 bg-black/20 p-4 rounded-xl border border-white/5">
                        <div className="flex items-center justify-between">
                            <OptionLabel 
                                label="Handicap Challenge" 
                                tooltip="Set a designated starter word for all players, which limits their opening guesses." 
                                activeTooltip={activeTooltip} 
                                setActiveTooltip={setActiveTooltip} 
                                tooltipId="handicap" 
                            />
                            <input
                                type="checkbox"
                                checked={isHandicap}
                                onChange={(e) => setIsHandicap(e.target.checked)}
                                className="w-5 h-5 accent-correct cursor-pointer"
                            />
                        </div>
                        {isHandicap && (
                            <div className="space-y-3.5 pl-4 border-l border-white/10 animate-in slide-in-from-left duration-200">
                                <div className="space-y-2">
                                    <OptionLabel 
                                        label="Starter Type" 
                                        tooltip="Choose whether the starter word is selected randomly by the system or explicitly typed by the creator." 
                                        activeTooltip={activeTooltip} 
                                        setActiveTooltip={setActiveTooltip} 
                                        tooltipId="starterType" 
                                    />
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setHandicapMode('random')}
                                            className={`py-2.5 rounded-xl border text-[10px] font-black uppercase transition-all ${handicapMode === 'random' ? 'border-correct bg-correct/10 text-correct' : 'border-white/10 bg-black/20'}`}
                                        >
                                            System Random
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setHandicapMode('custom')}
                                            className={`py-2.5 rounded-xl border text-[10px] font-black uppercase transition-all ${handicapMode === 'custom' ? 'border-correct bg-correct/10 text-correct' : 'border-white/10 bg-black/20'}`}
                                        >
                                            Custom Word
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between border-t border-white/5 pt-3">
                                    <OptionLabel 
                                        label="Enforce Starter Word" 
                                        tooltip="If enabled, the starter word is automatically submitted as the player's first guess." 
                                        activeTooltip={activeTooltip} 
                                        setActiveTooltip={setActiveTooltip} 
                                        tooltipId="enforceStarter" 
                                    />
                                    <input
                                        type="checkbox"
                                        checked={handicapEnforced}
                                        onChange={(e) => setHandicapEnforced(e.target.checked)}
                                        className="w-5 h-5 accent-correct cursor-pointer"
                                    />
                                </div>

                                {handicapMode === 'custom' && (
                                    <div className="space-y-2.5 border-t border-white/5 pt-3">
                                        {length === 1 ? (
                                            marathonGames.map((l, idx) => (
                                                <div key={idx} className="flex flex-col gap-1">
                                                    <span className="text-[10px] font-black uppercase text-white">Game #{idx + 1} ({l}-letter Starter):</span>
                                                    <input
                                                        type={handicapStartersArray[idx] === '__MASKED__' ? "password" : "text"}
                                                        maxLength={handicapStartersArray[idx] === '__MASKED__' ? undefined : l}
                                                        placeholder={`Enter ${l}-letter starter`}
                                                        value={handicapStartersArray[idx] || ''}
                                                        onChange={(e) => {
                                                            const prev = handicapStartersArray[idx] || '';
                                                            const val = resolveNewStarterInput(e.target.value, prev);
                                                            setHandicapStartersArray(prevArr => {
                                                                const next = [...prevArr];
                                                                next[idx] = val;
                                                                return next;
                                                            });
                                                        }}
                                                        className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs focus:border-correct/60 focus:bg-black/60 outline-none uppercase text-white transition-all"
                                                    />
                                                </div>
                                            ))
                                        ) : (
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black uppercase text-white">Starter Word ({length === 0 ? '5-letter' : `${length}-letter`}):</label>
                                                <input
                                                    type={handicapStarter === '__MASKED__' ? "password" : "text"}
                                                    maxLength={handicapStarter === '__MASKED__' ? undefined : (length === 0 ? 5 : length)}
                                                    placeholder={`Enter starter word`}
                                                    value={handicapStarter}
                                                    onChange={(e) => {
                                                        const val = resolveNewStarterInput(e.target.value, handicapStarter);
                                                        setHandicapStarter(val);
                                                    }}
                                                    className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs focus:border-correct/60 focus:bg-black/60 outline-none uppercase text-white transition-all"
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Marathon Custom Timers */}
                    {length === 1 && mode === 'LIVE' && (
                        <div className="space-y-3 bg-black/20 p-4 rounded-xl border border-white/5">
                            <div className="flex items-center justify-between">
                                <OptionLabel 
                                    label="Per-Word Timers" 
                                    tooltip="Specify a different timer duration for each game in the Marathon mode sequence." 
                                    activeTooltip={activeTooltip} 
                                    setActiveTooltip={setActiveTooltip} 
                                    tooltipId="perWordTimers" 
                                />
                                <div className="flex bg-black/40 rounded-lg p-1 border border-white/10">
                                    <button
                                        type="button"
                                        onClick={() => setTimerType('same')}
                                        className={`px-3 py-1 rounded-md text-[9px] font-black uppercase transition-all ${timerType === 'same' ? 'bg-correct text-black' : 'text-white/80'}`}
                                    >
                                        Same
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTimerType('custom')}
                                        className={`px-3 py-1 rounded-md text-[9px] font-black uppercase transition-all ${timerType === 'custom' ? 'bg-correct text-black' : 'text-white/80'}`}
                                    >
                                        Custom
                                    </button>
                                </div>
                            </div>
                            {timerType === 'custom' && (
                                <div className="flex flex-wrap gap-2 pl-4 border-l border-white/10 animate-in slide-in-from-left duration-200">
                                    {marathonGames.map((l, idx) => (
                                        <div key={idx} className="space-y-1 min-w-[50px] flex-1">
                                            <p className="text-[8px] font-black uppercase text-white/80 text-center">#{idx + 1} ({l}L)</p>
                                            <input
                                                type="number"
                                                inputMode="numeric"
                                                min={1}
                                                max={60}
                                                value={marathonTimersInput[idx] || ''}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setMarathonTimersInput(prev => {
                                                        const next = [...prev];
                                                        next[idx] = val;
                                                        return next;
                                                    });
                                                    const num = Number(val);
                                                    if (!isNaN(num) && num >= 1 && num <= 60) {
                                                        setMarathonTimersArray(prev => {
                                                            const next = [...prev];
                                                            next[idx] = num;
                                                            return next;
                                                        });
                                                    }
                                                }}
                                                onBlur={() => {
                                                    let num = parseInt(marathonTimersInput[idx], 10);
                                                    if (isNaN(num)) num = 5;
                                                    else if (num < 1) num = 1;
                                                    else if (num > 60) num = 60;
                                                    
                                                    setMarathonTimersArray(prev => {
                                                        const next = [...prev];
                                                        next[idx] = num;
                                                        return next;
                                                    });
                                                    setMarathonTimersInput(prev => {
                                                        const next = [...prev];
                                                        next[idx] = String(num);
                                                        return next;
                                                    });
                                                }}
                                                className="w-full bg-black/40 border border-white/15 rounded-lg px-2 py-1.5 text-[10px] text-center focus:border-correct/60 focus:bg-black/60 outline-none text-white transition-all"
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
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

            <ProfileInviteSystem 
                availableProfiles={availableProfiles} 
                invitedIds={invitedIds} 
                toggleInvite={toggleInvite} 
                activeTooltip={activeTooltip}
                setActiveTooltip={setActiveTooltip}
            />

            <div className="pt-4 border-t border-white/5 space-y-4">
                {!editingChallenge && (
                    <div className="flex items-center gap-3">
                        <input
                            type="text"
                            placeholder="Or Enter Challenge ID..."
                            value={joinId}
                            onChange={(e) => setJoinId(e.target.value)}
                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-correct outline-none transition-colors text-white"
                        />
                        <button
                            type="button"
                            onClick={() => joinId && handleViewChallenge(joinId)}
                            disabled={!joinId}
                            className="bg-white text-black px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition-colors disabled:opacity-50"
                        >
                            Join
                        </button>
                    </div>
                )}

                <button
                    type="button"
                    onClick={handleCreateTrigger}
                    disabled={loading || errors.length > 0}
                    className="w-full bg-correct text-black py-5 rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-xl hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:brightness-50"
                >
                    {loading ? (editingChallenge ? 'Saving...' : 'Creating...') : (editingChallenge ? 'Save Changes' : <><Plus size={18} /> Create Challenge</>)}
                </button>
            </div>
        </div>
    );
});
