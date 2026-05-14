/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Trophy } from 'lucide-react';
import { useChallenge, type Challenge, type ChallengeParticipant } from '../hooks/useChallenge';
import { motion, AnimatePresence } from 'framer-motion';
import { deobfuscateWord } from '../lib/gameLogic';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabaseClient';
import GuessPreviewModal from './GuessPreviewModal';

// Sub-components
import { ChallengeCreate } from './challenge/ChallengeCreate';
import { ChallengeLobby } from './challenge/ChallengeLobby';
import { ChallengeGameplay } from './challenge/ChallengeGameplay';

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

    // Form/Lobby State
    const [mode, setMode] = useState<'LIVE' | 'ANYTIME'>('ANYTIME');
    const [length, setLength] = useState(5);
    const [maxTime, setMaxTime] = useState(5);
    const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
    const [myParticipation, setMyParticipation] = useState<ChallengeParticipant | null>(null);
    const [myChallenges, setMyChallenges] = useState<any[]>([]);
    const [joinId, setJoinId] = useState('');
    const [previewParticipant, setPreviewParticipant] = useState<ChallengeParticipant | null>(null);
    const [availableProfiles, setAvailableProfiles] = useState<any[]>([]);
    const [invitedIds, setInvitedIds] = useState<string[]>([]);
    const [isPlaying, setIsPlaying] = useState(false);

    const initialProcessed = useRef(false);
    const channelRef = useRef<any>(null);

    // Sync state from participants array
    useEffect(() => {
        if (participants.length > 0) {
            if (user) {
                const current = participants.find(p => p.user_id === user.id);
                if (current) setMyParticipation(current);
            }
            if (previewParticipant) {
                const updated = participants.find(p => p.id === previewParticipant.id);
                if (updated) setPreviewParticipant(updated);
            }
        }
    }, [participants]);

    const cleanupSubscription = useCallback(() => {
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
        }
    }, []);

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
            if (new Date(challenge.expires_at) < new Date()) {
                triggerToast("This challenge has expired.", 4000);
                return;
            }
            cleanupSubscription();
            setSelectedChallenge(challenge);
            const participation = await joinChallenge(challenge.id);
            setMyParticipation(participation);
            setActiveTab('join');
            channelRef.current = subscribeToParticipants(challenge.id);
        } else {
            triggerToast("Invalid challenge link or code.", 4000);
        }
    }, [cleanupSubscription, triggerToast]);

    const toggleInvite = useCallback((id: string) => {
        setInvitedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    }, []);

    const handleCreate = useCallback(async () => {
        const challenge = await createChallenge(mode, length, mode === 'LIVE' ? maxTime : null, invitedIds);
        if (challenge) {
            const invitedUsernames = availableProfiles
                .filter(p => invitedIds.includes(p.id))
                .map(p => p.username);
            if (onChallengeCreated) onChallengeCreated(challenge, invitedUsernames, invitedIds);
            handleViewChallenge(challenge.id);
        }
    }, [mode, length, maxTime, invitedIds, availableProfiles]);

    const handleStartGame = async () => {
        if (!selectedChallenge || !myParticipation) return;
        if (new Date(selectedChallenge.expires_at) < new Date()) {
            triggerToast("This challenge has expired.", 4000);
            return;
        }
        const plainWord = deobfuscateWord(selectedChallenge.target_word, selectedChallenge.salt);
        setSelectedChallenge({ ...selectedChallenge, target_word: plainWord });
        if (myParticipation.status === 'pending') await startChallenge(myParticipation.id);
        setIsPlaying(true);
    };

    useEffect(() => {
        if (initialChallengeId && !initialProcessed.current) {
            initialProcessed.current = true;
            handleViewChallenge(initialChallengeId);
        } else if (isOpen) {
            loadMyChallenges();
            loadProfiles();
        }
    }, [isOpen]);

    useEffect(() => { return () => cleanupSubscription(); }, [cleanupSubscription]);

    const copyLink = useCallback((challenge: Challenge) => {
        const url = `${window.location.origin}${window.location.pathname}?challenge=${challenge.id}`;
        const text = `Hey! I challenge you to a ${challenge.word_length}-letter Wordle match (${challenge.mode} mode)! 🏆\n\nJoin here: ${url}`;
        navigator.clipboard.writeText(text);
        triggerToast('Challenge link copied to clipboard!', 2000);
    }, [triggerToast]);

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
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
                    <AnimatePresence mode="wait">
                        {isPlaying ? (
                            <ChallengeGameplay
                                key="gameplay"
                                challenge={selectedChallenge}
                                participation={myParticipation}
                                triggerToast={triggerToast}
                                submitChallengeResult={submitChallengeResult}
                                onFinish={() => setIsPlaying(false)}
                            />
                        ) : (
                            <motion.div
                                key="lobby"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="flex flex-col h-full"
                            >
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
                                        <ChallengeLobby
                                            selectedChallenge={selectedChallenge}
                                            myParticipation={myParticipation}
                                            participants={participants}
                                            myHasFinished={myHasFinished}
                                            user={user}
                                            copyLink={copyLink}
                                            setPreviewParticipant={setPreviewParticipant}
                                            handleStartGame={handleStartGame}
                                            setSelectedChallenge={setSelectedChallenge}
                                        />
                                    ) : activeTab === 'create' ? (
                                        <ChallengeCreate
                                            mode={mode} setMode={setMode} length={length} setLength={setLength} maxTime={maxTime} setMaxTime={setMaxTime}
                                            availableProfiles={availableProfiles} invitedIds={invitedIds} toggleInvite={toggleInvite}
                                            joinId={joinId} setJoinId={setJoinId} handleViewChallenge={handleViewChallenge} handleCreate={handleCreate} loading={loading}
                                        />
                                    ) : (
                                        <div className="space-y-4">
                                            {myChallenges.length === 0 ? (
                                                <div className="py-12 text-center text-gray-500">No challenges yet.</div>
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
                                                        <p className="font-bold">Challenge by {item.challenge.profiles?.username || 'User'}</p>
                                                        <p className="text-[10px] text-gray-500 uppercase font-black">{item.status}</p>
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
