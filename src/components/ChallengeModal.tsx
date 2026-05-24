/* eslint-disable @typescript-eslint/no-explicit-any */
import { memo, useState } from 'react';
import { X, Trophy, Search, ArrowLeft, SlidersHorizontal, Plus, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { type Challenge } from '../hooks/useChallenge';
import { ChallengeProvider, useChallengeContext } from '../context/ChallengeContext';
import GuessPreviewModal from './GuessPreviewModal';
import { AudioChatControls } from './challenge/AudioChatControls';
import { Z_INDEX, ANIMATION_DURATION } from '../constants/ui';

import { useChallengeStore } from '../store/useChallengeStore';

// Sub-components
import { ChallengeCreate } from './challenge/ChallengeCreate';
import { ChallengeLobby } from './challenge/ChallengeLobby';
import { ChallengeGameplayContainer } from './challenge/ChallengeGameplayContainer';
import { ChallengeSkeleton, ErrorFallback, ChallengeItem } from './challenge/ChallengeUIElements';
import { WORD_LENGTHS } from '../constants/game';

interface ChallengeModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: any;
    onChallengeCreated?: (challenge: Challenge, invitedUsernames: string[], invitedIds: string[]) => void;
    initialChallengeId?: string | null;
}

const GameplayTimer = memo(() => {
    const timeLeft = useChallengeStore(s => s.timeLeft);
    if (timeLeft === null) return null;
    return (
        <div className="flex items-center gap-2 bg-red-500/10 px-2 py-0.5 rounded-lg border border-red-500/20">
            <span className="text-[10px] font-black text-red-500 tabular-nums">
                {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
            </span>
        </div>
    );
});

const GuestChallengeView = memo(({ onClose }: { onClose: () => void }) => {
    return (
        <div className="fixed inset-0 bg-black flex flex-col" style={{ zIndex: Z_INDEX.MODAL_BACKDROP }}>
            <div className="flex flex-col h-full w-full overflow-hidden bg-background">
                <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-correct/20 p-2 rounded-xl">
                            <Trophy className="text-correct w-6 h-6" />
                        </div>
                        <h2 className="text-xl font-black uppercase tracking-tighter">
                            Challenges
                        </h2>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/5 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6 overflow-y-auto">
                    <div className="bg-correct/10 p-6 rounded-3xl border border-correct/20">
                        <Trophy className="w-12 h-12 text-correct mx-auto" />
                    </div>

                    <div className="space-y-2 max-w-xs">
                        <h3 className="text-xl font-black uppercase tracking-tighter">
                            Authentication Required
                        </h3>

                        <p className="text-gray-400 text-xs leading-relaxed">
                            Sign in to challenge friends, track your global ranking,
                            and sync your progress across all your devices.
                        </p>
                    </div>

                    <div className="w-full max-w-sm space-y-3">
                        <button
                            onClick={() => {
                                onClose();
                                window.dispatchEvent(
                                    new CustomEvent('open-auth-modal')
                                );
                            }}
                            className="w-full bg-correct text-black font-black uppercase py-4 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-correct/20"
                        >
                            Sign In to Play
                        </button>

                        <button
                            onClick={onClose}
                            className="w-full bg-white/5 text-gray-400 font-black uppercase py-4 rounded-2xl hover:bg-white/10 transition-all"
                        >
                            Maybe Later
                        </button>
                    </div>

                    <div className="pt-4 grid grid-cols-2 gap-4 w-full max-w-sm">
                        <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                            <p className="text-[10px] font-black uppercase text-correct">
                                Social
                            </p>
                            <p className="text-[9px] text-gray-500">
                                Play with friends
                            </p>
                        </div>

                        <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                            <p className="text-[10px] font-black uppercase text-correct">
                                Global
                            </p>
                            <p className="text-[9px] text-gray-500">
                                Ranked Matchmaking
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

const AuthenticatedChallengeContent = memo(({ onClose, user }: { onClose: () => void, user: any }) => {
    const [showFilters, setShowFilters] = useState(false);
    const [isCreatingChallenge, setIsCreatingChallenge] = useState(false);
    const [isHelpOpen, setIsHelpOpen] = useState(false);
    const {
        setActiveTab,
        isPlaying, setIsPlaying,
        selectedChallenge,
        myParticipation,
        filteredChallenges,
        myChallenges,
        handleViewChallenge,
        loadMyChallenges,
        loading,
        error,
        searchQuery, setSearchQuery,
        statusFilter, setStatusFilter,
        modeFilter, setModeFilter,
        lengthFilter, setLengthFilter,
        clearFilters,
        previewParticipant, setPreviewParticipant,
        setPreviewMarathonLength,
        previewMarathonGameIndex, setPreviewMarathonGameIndex,
        backAction
    } = useChallengeContext();

    const toggleFilters = () => {
        if (showFilters) clearFilters();
        setShowFilters(!showFilters);
    };

    return (
        <div className="flex flex-col h-full overflow-hidden relative">
            <div className={`border-b border-white/5 flex items-center justify-between shrink-0 transition-all ${isPlaying ? 'p-3 sm:p-4' : 'p-6'}`}>
                <div className="flex items-center gap-3">
                    <div className="bg-correct/20 p-2 rounded-xl">
                        <Trophy className="text-correct w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black uppercase tracking-tighter">
                            Challenges
                        </h2>
                        <div className="flex items-center gap-2 min-h-5">
                            {isPlaying ? (
                                <>
                                    <button
                                        onClick={() => backAction ? backAction() : setIsPlaying(false)}
                                        className="p-1 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                                    >
                                        <ArrowLeft size={16} />
                                    </button>
                                    <GameplayTimer />
                                    {selectedChallenge && myParticipation && (
                                        <AudioChatControls
                                            challengeId={selectedChallenge.id}
                                            userId={myParticipation.user_id || myParticipation.guest_id || ""}
                                        />
                                    )}
                                </>
                            ) : (
                                <p className="text-gray-400 text-xs">
                                    Compete with friends
                                </p>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {!isPlaying && !selectedChallenge && (
                        <button
                            onClick={() => {
                                setActiveTab('my');
                                setIsCreatingChallenge(true);
                            }}
                            className="bg-correct hover:bg-correct/90 text-black px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1 transition-all hover:scale-[1.02] active:scale-[0.98] mr-2"
                        >
                            <Plus size={14} strokeWidth={3} />
                            Create
                        </button>
                    )}
                    <button
                        onClick={() => setIsHelpOpen(true)}
                        className="p-2 hover:bg-white/5 rounded-full transition-colors text-gray-400 hover:text-white"
                        title="Challenge Guide"
                    >
                        <HelpCircle size={20} />
                    </button>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={isPlaying ? "gameplay" : "lobby"}
                        initial={{ opacity: 0, x: isPlaying ? 20 : -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: isPlaying ? -20 : 20 }}
                        transition={{ duration: ANIMATION_DURATION.NORMAL / 1000 }}
                        className="flex flex-col h-full overflow-hidden"
                    >
                        {isPlaying ? (
                            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                                <ChallengeGameplayContainer />
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10">
                                {error ? (
                                    <ErrorFallback
                                        message={error}
                                        onRetry={() => {
                                            if (selectedChallenge) handleViewChallenge(selectedChallenge.id);
                                            else loadMyChallenges();
                                        }}
                                    />
                                ) : selectedChallenge ? (
                                    <ChallengeLobby />
                                ) : (
                                    <div className="space-y-6">
                                        {/* Search and Filters Toggle */}
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2">
                                                <div className="relative flex-1 group">
                                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-correct transition-colors" size={18} />
                                                    <input
                                                        type="text"
                                                        placeholder="Search by opponent..."
                                                        value={searchQuery}
                                                        onChange={(e) => setSearchQuery(e.target.value)}
                                                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-correct/50 focus:bg-white/10 transition-all"
                                                    />
                                                </div>
                                                <button
                                                    onClick={toggleFilters}
                                                    className={`p-3 rounded-2xl border transition-all ${showFilters ? 'bg-correct text-black border-correct shadow-lg shadow-correct/20' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'}`}
                                                >
                                                    <SlidersHorizontal size={20} />
                                                </button>
                                            </div>

                                            <AnimatePresence>
                                                {showFilters && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        className="overflow-hidden space-y-4 pt-1"
                                                    >
                                                        <div className="space-y-4 bg-white/2 p-4 rounded-2xl border border-white/5 relative">
                                                            <button
                                                                onClick={clearFilters}
                                                                className="absolute top-4 right-4 text-[9px] font-black uppercase text-correct hover:text-white transition-colors"
                                                            >
                                                                Clear All
                                                            </button>

                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className="text-[9px] font-black uppercase text-gray-500 w-10 shrink-0">Status</span>
                                                                {(['ALL', 'ACTIVE', 'COMPLETED'] as const).map((f) => (
                                                                    <button
                                                                        key={f}
                                                                        onClick={() => setStatusFilter(f)}
                                                                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${statusFilter === f ? 'bg-correct text-black' : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-white'}`}
                                                                    >
                                                                        {f}
                                                                    </button>
                                                                ))}
                                                            </div>

                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className="text-[9px] font-black uppercase text-gray-500 w-10 shrink-0">Mode</span>
                                                                {(['ALL', 'LIVE', 'ANYTIME'] as const).map((m) => (
                                                                    <button
                                                                        key={m}
                                                                        onClick={() => setModeFilter(m)}
                                                                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${modeFilter === m ? 'bg-correct text-black' : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-white'}`}
                                                                    >
                                                                        {m}
                                                                    </button>
                                                                ))}
                                                            </div>

                                                            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                                                                <span className="text-[9px] font-black uppercase text-gray-500 w-10 shrink-0">Length</span>
                                                                <button
                                                                    onClick={() => setLengthFilter('ALL')}
                                                                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${lengthFilter === 'ALL' ? 'bg-correct text-black' : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-white'}`}
                                                                >
                                                                    ALL
                                                                </button>
                                                                <button
                                                                    onClick={() => setLengthFilter(1)}
                                                                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${lengthFilter === 1 ? 'bg-correct text-black' : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-white'}`}
                                                                >
                                                                    Marathon
                                                                </button>
                                                                {WORD_LENGTHS.map((l) => (
                                                                    <button
                                                                        key={l}
                                                                        onClick={() => setLengthFilter(l)}
                                                                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${lengthFilter === l ? 'bg-correct text-black' : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-white'}`}
                                                                    >
                                                                        {l}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>

                                        <div className="space-y-4">
                                            {loading ? (
                                                <ChallengeSkeleton />
                                            ) : filteredChallenges.length === 0 ? (
                                                <div className="py-12 text-center text-gray-500">
                                                    {myChallenges.length === 0 ? "No challenges yet." : "No matching challenges found."}
                                                </div>
                                            ) : (
                                                filteredChallenges.map((item) => (
                                                    <ChallengeItem
                                                        key={item.id}
                                                        item={item}
                                                        user={user}
                                                        onSelect={handleViewChallenge}
                                                    />
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Create Challenge Modal Sheet overlay */}
            <AnimatePresence>
                {isCreatingChallenge && (
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 15 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-0 bg-gray-950/98 backdrop-blur-md z-50 flex flex-col"
                    >
                        <div className="p-4 sm:p-6 border-b border-white/5 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="bg-correct/20 p-2 rounded-xl text-correct flex items-center justify-center">
                                    <Plus size={20} strokeWidth={3} />
                                </div>
                                <h3 className="text-lg font-black uppercase tracking-tighter">
                                    Create Challenge
                                </h3>
                            </div>
                            <button
                                onClick={() => setIsCreatingChallenge(false)}
                                className="p-2 hover:bg-white/5 rounded-full transition-colors text-gray-400 hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-thin scrollbar-thumb-white/10">
                            <ChallengeCreate onSuccess={() => setIsCreatingChallenge(false)} />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Help/Guide Modal Sheet overlay */}
            <AnimatePresence>
                {isHelpOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 15 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-0 bg-gray-950/98 backdrop-blur-md z-[60] flex flex-col"
                    >
                        <div className="p-4 sm:p-6 border-b border-white/5 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="bg-correct/20 p-2 rounded-xl text-correct flex items-center justify-center">
                                    <HelpCircle size={20} />
                                </div>
                                <h3 className="text-lg font-black uppercase tracking-tighter text-white">
                                    Challenge Mode Guide
                                </h3>
                            </div>
                            <button
                                onClick={() => setIsHelpOpen(false)}
                                className="p-2 hover:bg-white/5 rounded-full transition-colors text-gray-400 hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-thin scrollbar-thumb-white/10 space-y-6 text-sm text-gray-300">
                            <section className="space-y-2">
                                <h4 className="text-sm font-black uppercase text-white tracking-wide">🏆 What is Challenge Mode?</h4>
                                <p className="text-xs leading-relaxed text-gray-400">
                                    Challenge Mode allows you to create custom Wordle games and compete directly against friends or players globally. You can play live in real-time or asynchronously at your own pace.
                                </p>
                            </section>

                            <section className="space-y-3">
                                <h4 className="text-sm font-black uppercase text-white tracking-wide">🎮 Game Modes</h4>
                                <div className="grid gap-3">
                                    <div className="bg-white/5 border border-white/5 p-3.5 rounded-2xl">
                                        <h5 className="text-xs font-black uppercase text-correct">Anytime (Asynchronous)</h5>
                                        <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                                            Create a challenge that remains open for up to 24 hours. Participants play at their own leisure. The leaderboard updates in real-time as scores are submitted.
                                        </p>
                                    </div>
                                    <div className="bg-white/5 border border-white/5 p-3.5 rounded-2xl">
                                        <h5 className="text-xs font-black uppercase text-red-500">Live (Real-time Race)</h5>
                                        <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                                            A synchronous race against time. All players compete concurrently. Has a strict time limit per game. Includes high-fidelity built-in audio chat for in-game banter!
                                        </p>
                                    </div>
                                </div>
                            </section>

                            <section className="space-y-2">
                                <h4 className="text-sm font-black uppercase text-white tracking-wide">⚡ Marathon Mode</h4>
                                <p className="text-xs leading-relaxed text-gray-400">
                                    Instead of a single word, compete over a sequence of words of different lengths (e.g. 3-letter up to 7-letter words). 
                                </p>
                                <ul className="list-disc pl-4 space-y-2 text-xs text-gray-400">
                                    <li><strong className="text-yellow-500">Sequence Customization:</strong> Reorder games to build custom progressions (e.g., 5L {"->"} 3L {"->"} 7L).</li>
                                    <li><strong className="text-yellow-500">Force Game Order:</strong> Force sequential unlocking. Players must play game #1 to unlock game #2, and so on.</li>
                                    <li><strong className="text-yellow-500">Per-Word Timers:</strong> Set unique duration limits for each individual word length in Live mode.</li>
                                </ul>
                            </section>

                            <section className="space-y-3">
                                <h4 className="text-sm font-black uppercase text-white tracking-wide">🛠️ Advanced Rules</h4>
                                <div className="space-y-2 text-xs text-gray-400">
                                    <p>
                                        <strong className="text-white">Custom Word Challenges:</strong> Create hand-crafted challenges with words of your own choice. (Note: Creators of custom-word challenges cannot play).
                                    </p>
                                    <p>
                                        <strong className="text-white">Handicap Starters:</strong> Pre-assign starter words to restrict players' first guesses. Can be randomly chosen by the system or hardcoded by the creator. You can enforce these starter words so they are automatically entered as the first guess.
                                    </p>
                                    <p>
                                        <strong className="text-white">Public Challenges:</strong> Open the lobby to anyone with the shareable link and customize the maximum player limit (up to 100 participants).
                                    </p>
                                </div>
                            </section>
                            
                            <div className="pt-2">
                                <button
                                    onClick={() => setIsHelpOpen(false)}
                                    className="w-full bg-correct text-black font-black uppercase py-4 rounded-2xl text-xs hover:brightness-110 transition-all font-extrabold"
                                >
                                    Got It, Let's Play!
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {previewParticipant && (
                <GuessPreviewModal
                    entry={previewParticipant}
                    onClose={() => {
                        setPreviewParticipant(null);
                        setPreviewMarathonLength(null);
                        setPreviewMarathonGameIndex(null);
                    }}
                    myParticipation={myParticipation}
                    initialMarathonGameIndex={previewMarathonGameIndex ?? undefined}
                    initialData={{
                        guesses: previewParticipant.guesses,
                        skill_score: previewParticipant.score,
                        hints_used: previewParticipant.hints_used,
                        hint_record: previewParticipant.hint_record,
                        time_taken: previewParticipant.time_taken
                    }}
                    targetWord={selectedChallenge?.target_word}
                    salt={selectedChallenge?.salt}
                    lengthOfWord={selectedChallenge?.word_length}
                    isCreator={selectedChallenge?.creator_id === user?.id && !!selectedChallenge?.is_custom_word}
                />
            )}
        </div>
    );
});

const hasRecentChallenges = (): boolean => {
    try {
        const stored = localStorage.getItem('wordle_recent_challenges');
        if (stored) {
            const parsed = JSON.parse(stored);
            return Array.isArray(parsed) && parsed.length > 0;
        }
    } catch (e) {
        console.error('Failed to read recent challenges', e);
    }
    return false;
};

const ChallengeModalContent = memo(({ onClose, user }: { onClose: () => void, user: any }) => {
    const { effectiveUser, selectedChallenge, loading } = useChallengeContext();
    if (!user && !effectiveUser && !selectedChallenge && !loading && !hasRecentChallenges()) {
        return <GuestChallengeView onClose={onClose} />;
    }
    return <AuthenticatedChallengeContent onClose={onClose} user={effectiveUser || user} />;
});

export const ChallengeModal = ({ isOpen, onClose, user, onChallengeCreated, initialChallengeId }: ChallengeModalProps) => {
    if (!isOpen) return null;

    if (!user && !initialChallengeId && !hasRecentChallenges()) {
        const id = localStorage.getItem('wordle_anon_id');
        const username = localStorage.getItem('wordle_anon_username');
        if (!id || !username) {
            return <GuestChallengeView onClose={onClose} />;
        }
    }

    return (
        <ChallengeProvider user={user} onChallengeCreated={onChallengeCreated} initialChallengeId={initialChallengeId}>
            <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" style={{ zIndex: Z_INDEX.MODAL_CONTENT }}>
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: ANIMATION_DURATION.FAST / 1000 }}
                    className="bg-gray-900 border border-white/10 w-full max-w-xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh]"
                >
                    <ChallengeModalContent onClose={onClose} user={user} />
                </motion.div>
            </div>
        </ChallengeProvider>
    );
};
