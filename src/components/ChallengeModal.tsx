/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Trophy, Plus, Users, Clock, Share2, Play, Eye, Lightbulb } from 'lucide-react';
import { useChallenge, type Challenge, type ChallengeParticipant } from '../hooks/useChallenge';
import { motion, AnimatePresence } from 'framer-motion';
import { Grid } from './Grid';
import { Keyboard } from './Keyboard';
import { checkGuess, getLetterStatuses, calculateSkillIndex, getHint } from '../lib/gameLogic';
import { getWordLists } from '../data/words';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabaseClient';
import GuessPreviewModal from './GuessPreviewModal';

interface ChallengeModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: any;
    onChallengeCreated?: (challenge: Challenge, invitedUsernames: string[], invitedIds: string[]) => void;
    initialChallengeId?: string | null;
}

export const ChallengeModal = ({ isOpen, onClose, user, onChallengeCreated, initialChallengeId }: ChallengeModalProps) => {
    const { triggerToast } = useApp();
    const [activeTab, setActiveTab] = useState<'create' | 'my' | 'join'>('create');
    const {
        createChallenge,
        fetchChallenge,
        joinChallenge,
        subscribeToParticipants,
        participants,
        fetchMyChallenges,
        fetchProfiles,
        loading,
        startChallenge,
        submitChallengeResult
    } = useChallenge(user);

    const [mode, setMode] = useState<'LIVE' | 'ANYTIME'>('ANYTIME');
    const [length, setLength] = useState(5);
    const [maxTime, setMaxTime] = useState(5);
    const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
    const [myParticipation, setMyParticipation] = useState<ChallengeParticipant | null>(null);
    const [myChallenges, setMyChallenges] = useState<any[]>([]);
    const [joinId, setJoinId] = useState('');
    const [previewParticipant, setPreviewParticipant] = useState<ChallengeParticipant | null>(null);

    // Keep myParticipation in sync with participants list
    useEffect(() => {
        if (user && participants.length > 0) {
            const current = participants.find(p => p.user_id === user.id);
            if (current) {
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setMyParticipation(current);
            }
        }
    }, [participants, user]);

    // Realtime subscription management
    const channelRef = useRef<any>(null);

    const cleanupSubscription = useCallback(() => {
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
        }
    }, []);

    // Gameplay state
    const [isPlaying, setIsPlaying] = useState(false);
    const [guesses, setGuesses] = useState<any[]>([]);
    const [currentGuess, setCurrentGuess] = useState("");
    const [letterStatuses, setLetterStatuses] = useState<any>({});
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [isGameOver, setIsGameOver] = useState(false);
    const [usedHint, setUsedHint] = useState(false);
    const [hintRecord, setHintRecord] = useState<{ letter: string, index: number, row?: number } | null>(null);
    const timerRef = useRef<number | null>(null);

    // Invitation State
    const [availableProfiles, setAvailableProfiles] = useState<any[]>([]);
    const [invitedIds, setInvitedIds] = useState<string[]>([]);

    const initialProcessed = useRef(false);

    const loadProfiles = useCallback(async () => {
        const profiles = await fetchProfiles();
        setAvailableProfiles(profiles.filter((p: any) => p.id !== user?.id));
    }, [fetchProfiles, user?.id]);

    const loadMyChallenges = useCallback(async () => {
        const data = await fetchMyChallenges();
        setMyChallenges(data);
    }, [fetchMyChallenges]);

    const handleViewChallenge = useCallback(async (id: string) => {
        const challenge = await fetchChallenge(id);
        if (challenge) {
            cleanupSubscription();
            setSelectedChallenge(challenge);
            const participation = await joinChallenge(challenge.id);
            setMyParticipation(participation);
            setActiveTab('join');
            channelRef.current = subscribeToParticipants(challenge.id);
        }
    }, [fetchChallenge, joinChallenge, subscribeToParticipants, cleanupSubscription]);

    const toggleInvite = (id: string) => {
        setInvitedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleCreate = useCallback(async () => {
        const challenge = await createChallenge(mode, length, mode === 'LIVE' ? maxTime : null, invitedIds);
        if (challenge) {
            const invitedUsernames = availableProfiles
                .filter(p => invitedIds.includes(p.id))
                .map(p => p.username);

            if (onChallengeCreated) {
                onChallengeCreated(challenge, invitedUsernames, invitedIds);
            }
            handleViewChallenge(challenge.id);
        }
    }, [createChallenge, mode, length, maxTime, invitedIds, availableProfiles, onChallengeCreated, handleViewChallenge]);

    const handleTimeExpired = useCallback(async () => {
        if (myParticipation && !isGameOver) {
            setIsGameOver(true);
            triggerToast("Time's up!", 3000);
            await submitChallengeResult(myParticipation.id, {
                status: 'timed_out',
                score: 0,
                attempts: guesses.length,
                guesses: guesses,
                hints_used: usedHint,
                hint_record: hintRecord
            });
            setIsPlaying(false); // Back to leaderboard
        }
    }, [myParticipation, isGameOver, guesses, submitChallengeResult, triggerToast, usedHint, hintRecord]);

    useEffect(() => {
        return () => {
            cleanupSubscription();
        };
    }, [cleanupSubscription]);

    useEffect(() => {
        if (timeLeft !== null && timeLeft > 0 && !isGameOver && isPlaying) {
            timerRef.current = window.setInterval(() => {
                setTimeLeft(prev => {
                    if (prev === null || prev <= 1) {
                        clearInterval(timerRef.current!);
                        handleTimeExpired();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [timeLeft, isGameOver, isPlaying, handleTimeExpired]);

    const handleStartGame = async () => {
        if (!selectedChallenge || !myParticipation) return;

        if (myParticipation.status === 'pending') {
            await startChallenge(myParticipation.id);
        }

        // Initialize gameplay state
        const initialGuesses = myParticipation.guesses || [];
        setGuesses(initialGuesses);
        setLetterStatuses(getLetterStatuses(initialGuesses));
        setCurrentGuess("");
        setUsedHint(myParticipation.hints_used || false);
        setHintRecord(myParticipation.hint_record || null);

        const isGameAlreadyOver = myParticipation.status === 'completed' || myParticipation.status === 'timed_out';
        setIsGameOver(isGameAlreadyOver);

        if (selectedChallenge.mode === 'LIVE' && selectedChallenge.max_time) {
            const startedAt = myParticipation.started_at ? new Date(myParticipation.started_at).getTime() : Date.now();
            const endTime = startedAt + selectedChallenge.max_time * 60 * 1000;
            const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
            setTimeLeft(remaining);
        } else {
            setTimeLeft(null);
        }

        setIsPlaying(true);
    };

    const handleHint = async () => {
        if (isGameOver || !selectedChallenge) return;

        if (usedHint && hintRecord) {
            triggerToast(`Reminder: "${hintRecord.letter}" is at position ${hintRecord.index + 1}.`, 3000);
            return;
        }

        if (guesses.length < 3) {
            triggerToast("Hint unlocks after 3 attempts.", 3000);
            return;
        }

        const hint = getHint(selectedChallenge.target_word, guesses);
        if (hint) {
            const hintWithRow = { ...hint, row: guesses.length };
            setUsedHint(true);
            setHintRecord(hintWithRow);
            triggerToast(`Hint: "${hint.letter}" at position ${hint.index + 1}.`, 5000);
        }
    };

    const onChar = useCallback((char: string) => {
        if (isGameOver || !selectedChallenge) return;
        setCurrentGuess(prev => (prev.length < selectedChallenge.word_length ? prev + char : prev));
    }, [selectedChallenge, isGameOver]);

    const onDelete = useCallback(() => {
        if (isGameOver) return;
        setCurrentGuess(prev => prev.slice(0, -1));
    }, [isGameOver]);

    const onEnter = useCallback(async () => {
        if (isGameOver || !selectedChallenge || !myParticipation || currentGuess.length !== selectedChallenge.word_length) return;

        const upperGuess = currentGuess.toUpperCase();
        const { valid } = getWordLists(selectedChallenge.word_length);

        if (!valid.has(upperGuess)) {
            triggerToast("Not in word list.");
            return;
        }

        const result = checkGuess(upperGuess, selectedChallenge.target_word);
        const newGuesses = [...guesses, result];
        const newStatuses = getLetterStatuses(newGuesses);

        setGuesses(newGuesses);
        setLetterStatuses(newStatuses);
        setCurrentGuess("");

        const won = upperGuess === selectedChallenge.target_word;
        const lost = newGuesses.length === 6; // Max 6 attempts

        if (won || lost) {
            setIsGameOver(true);
            const skillScore = calculateSkillIndex(newGuesses.length, 6, usedHint, newGuesses);
            await submitChallengeResult(myParticipation.id, {
                status: 'completed',
                score: skillScore,
                attempts: newGuesses.length,
                guesses: newGuesses,
                hints_used: usedHint,
                hint_record: hintRecord
            });

            setTimeout(() => {
                setIsPlaying(false);
                triggerToast(won ? "Challenge Completed! 🎉" : `The word was ${selectedChallenge.target_word}`, 5000);
            }, 2000);
        }
    }, [isGameOver, selectedChallenge, myParticipation, currentGuess, guesses, triggerToast, submitChallengeResult, usedHint, hintRecord]);

    // Physical Keyboard for Challenge
    useEffect(() => {
        if (!isPlaying || isGameOver) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey) return;
            const key = e.key.toUpperCase();
            if (key === 'ENTER') onEnter();
            else if (key === 'BACKSPACE') onDelete();
            else if (/^[A-Z]$/.test(key)) onChar(key);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isPlaying, isGameOver, onEnter, onDelete, onChar]);

    useEffect(() => {
        if (initialChallengeId && !initialProcessed.current) {
            initialProcessed.current = true;
            handleViewChallenge(initialChallengeId);
        } else if (isOpen) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            loadMyChallenges();
            loadProfiles();
        }
    }, [isOpen, initialChallengeId, handleViewChallenge, loadMyChallenges, loadProfiles]);

    const copyLink = (id: string) => {
        const url = `${window.location.origin}${window.location.pathname}?challenge=${id}`;
        navigator.clipboard.writeText(url);
        triggerToast('Challenge link copied!', 2000);
    };

    if (!isOpen) return null;

    const myHasFinished = myParticipation?.status === 'completed' || myParticipation?.status === 'timed_out';

    return (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-gray-900 border border-white/10 w-full max-w-xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-correct/20 p-2 rounded-xl">
                            <Trophy className="text-correct w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black uppercase tracking-tighter">
                                {isPlaying ? 'Challenge Gameplay' : 'Challenges'}
                            </h2>
                            <p className="text-gray-400 text-xs">
                                {isPlaying ? `vs ${selectedChallenge?.profiles?.username || 'Opponent'}` : 'Compete with friends'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {isPlaying && timeLeft !== null && (
                            <div className="flex items-center gap-2 bg-red-500/10 px-3 py-1.5 rounded-xl border border-red-500/20">
                                <Clock size={14} className="text-red-500 animate-pulse" />
                                <span className="text-xs font-black text-red-500 tabular-nums">
                                    {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                                </span>
                            </div>
                        )}
                        <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                </div>
                <div className="mt-4 flex items-center justify-center gap-6">
                    <button
                        onClick={() => setIsPlaying(false)}
                        className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-colors"
                    >
                        Go Back
                    </button>
                    {
                        (guesses.length >= 3 && !myHasFinished) && (
                            <button
                                onClick={handleHint}
                                className={`p-2 transition-all rounded-xl ${usedHint ? 'text-yellow-500/30' : 'text-yellow-500 bg-yellow-500/10 animate-pulse'}`}
                                title={usedHint ? "Hint Used" : "Get Hint"}
                            >
                                <Lightbulb size={18} fill={usedHint ? "none" : "currentColor"} />
                            </button>
                        )
                    }
                </div>

                <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
                    <AnimatePresence mode="wait">
                        {isPlaying ? (
                            <motion.div
                                key="gameplay"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="flex-1 flex flex-col p-4 gap-6"
                            >
                                <div className="flex-1 flex items-center justify-center min-h-0">
                                    <div className="scale-[0.8] sm:scale-100 origin-center">
                                        <Grid
                                            wordLength={selectedChallenge!.word_length}
                                            maxAttempts={6}
                                            guesses={guesses}
                                            currentGuess={currentGuess}
                                            hintRecord={hintRecord}
                                            isChallengeMode={true}
                                        />
                                    </div>
                                </div>

                                <div className="w-full max-w-lg mx-auto pb-1">
                                    <Keyboard
                                        onChar={onChar}
                                        onDelete={onDelete}
                                        onEnter={onEnter}
                                        letterStatuses={letterStatuses}
                                    />

                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="lobby"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="flex flex-col h-full"
                            >
                                {/* Tabs */}
                                {selectedChallenge ? null : (
                                    <div className="flex border-b border-white/5 shrink-0">
                                        <button
                                            onClick={() => setActiveTab('create')}
                                            className={`flex-1 py-4 text-xs font-black uppercase tracking-widest transition-colors ${activeTab === 'create' ? 'text-correct border-b-2 border-correct' : 'text-gray-500 hover:text-white'}`}
                                        >
                                            Create
                                        </button>
                                        <button
                                            onClick={() => { setActiveTab('my'); loadMyChallenges(); }}
                                            className={`flex-1 py-4 text-xs font-black uppercase tracking-widest transition-colors ${activeTab === 'my' ? 'text-correct border-b-2 border-correct' : 'text-gray-500 hover:text-white'}`}
                                        >
                                            My Challenges
                                        </button>
                                    </div>
                                )}

                                <div className="p-6">
                                    {selectedChallenge ? (
                                        /* Join/Lobby View */
                                        <div className="space-y-6">
                                            <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                                                <div className="flex items-center justify-between mb-4">
                                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${selectedChallenge.mode === 'LIVE' ? 'bg-red-500/20 text-red-500' : 'bg-blue-500/20 text-blue-500'}`}>
                                                        {selectedChallenge.mode} Mode
                                                    </span>
                                                    <button
                                                        onClick={() => copyLink(selectedChallenge.id)}
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
                                                                if (myHasFinished && (p.status === 'completed' || p.status === 'timed_out')) {
                                                                    setPreviewParticipant(p);
                                                                }
                                                            }}
                                                            className={`flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5 transition-all ${myHasFinished && (p.status === 'completed' || p.status === 'timed_out') ? 'cursor-pointer hover:bg-white/10 hover:border-white/20' : ''}`}
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
                                                                {myHasFinished && (p.status === 'completed' || p.status === 'timed_out') && (
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
                                    ) : activeTab === 'create' ? (
                                        /* Create View */
                                        <div className="space-y-6">
                                            <div className="space-y-4">
                                                <label className="text-xs font-black uppercase tracking-widest text-gray-500">Mode</label>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <button
                                                        onClick={() => setMode('ANYTIME')}
                                                        className={`p-4 rounded-2xl border transition-all text-left ${mode === 'ANYTIME' ? 'border-correct bg-correct/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}
                                                    >
                                                        <div className="flex items-center justify-between mb-2">
                                                            <Clock className={mode === 'ANYTIME' ? 'text-correct' : 'text-gray-400'} size={20} />
                                                            {mode === 'ANYTIME' && <div className="w-2 h-2 bg-correct rounded-full" />}
                                                        </div>
                                                        <p className="text-sm font-black uppercase">Anytime</p>
                                                        <p className="text-[10px] text-gray-500">24h asynchronous play</p>
                                                    </button>
                                                    <button
                                                        onClick={() => setMode('LIVE')}
                                                        className={`p-4 rounded-2xl border transition-all text-left ${mode === 'LIVE' ? 'border-red-500 bg-red-500/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}
                                                    >
                                                        <div className="flex items-center justify-between mb-2">
                                                            <Play className={mode === 'LIVE' ? 'text-red-500' : 'text-gray-400'} size={20} />
                                                            {mode === 'LIVE' && <div className="w-2 h-2 bg-red-500 rounded-full" />}
                                                        </div>
                                                        <p className="text-sm font-black uppercase">Live</p>
                                                        <p className="text-[10px] text-gray-500">Fast-paced timed play</p>
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
                                                            className={`w-12 h-12 rounded-xl border font-black transition-all ${length === l ? 'border-correct bg-correct text-black' : 'border-white/10 bg-white/5 hover:border-white/20'}`}
                                                        >
                                                            {l}
                                                        </button>
                                                    ))}
                                                    <button
                                                        onClick={() => setLength(0)} // 0 for random
                                                        className={`px-4 h-12 rounded-xl border font-black text-[10px] uppercase tracking-widest transition-all ${length === 0 ? 'border-correct bg-correct text-black' : 'border-white/10 bg-white/5 hover:border-white/20'}`}
                                                    >
                                                        Random
                                                    </button>
                                                </div>
                                            </div>

                                            {mode === 'LIVE' && (
                                                <div className="space-y-4">
                                                    <label className="text-xs font-black uppercase tracking-widest text-gray-500">Time Limit (Minutes)</label>
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
                                                <label className="text-xs font-black uppercase tracking-widest text-gray-500">Challenge Friends</label>
                                                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                                    {availableProfiles.length === 0 ? (
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
                                    ) : (
                                        /* My Challenges View */
                                        <div className="space-y-4">
                                            {myChallenges.length === 0 ? (
                                                <div className="py-12 text-center">
                                                    <Users size={48} className="mx-auto text-gray-700 mb-4" />
                                                    <p className="text-gray-400 text-sm">No challenges yet.</p>
                                                </div>
                                            ) : (
                                                myChallenges.map((item) => (
                                                    <button
                                                        key={item.id}
                                                        onClick={() => handleViewChallenge(item.challenge_id)}
                                                        className="w-full text-left bg-white/5 border border-white/5 p-4 rounded-2xl hover:border-white/20 transition-all group"
                                                    >
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`w-2 h-2 rounded-full ${item.status === 'completed' ? 'bg-gray-600' : 'bg-correct'}`} />
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                                                    {item.challenge.mode} • {item.challenge.word_length} Letters
                                                                </span>
                                                            </div>
                                                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-600">
                                                                {new Date(item.challenge.created_at).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <p className="font-bold">Challenge by {item.challenge.profiles?.username || 'User'}</p>
                                                                <p className="text-[10px] text-gray-500 uppercase font-black">{item.status}</p>
                                                            </div>
                                                            <div className="group-hover:translate-x-1 transition-transform">
                                                                <Trophy size={16} className={item.status === 'completed' ? 'text-correct' : 'text-gray-700'} />
                                                            </div>
                                                        </div>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>

            {/* Guess Preview Modal for Challenges */}
            {previewParticipant && (
                <GuessPreviewModal
                    entry={previewParticipant}
                    onClose={() => setPreviewParticipant(null)}
                    initialData={{
                        guesses: previewParticipant.guesses,
                        skill_score: previewParticipant.score,
                        hints_used: previewParticipant.hints_used,
                        hint_record: previewParticipant.hint_record
                    }}
                />
            )}
        </div>
    );
};
