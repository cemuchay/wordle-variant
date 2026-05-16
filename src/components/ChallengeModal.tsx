/* eslint-disable @typescript-eslint/no-explicit-any */
import { memo } from 'react';
import { X, Trophy, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { type Challenge } from '../hooks/useChallenge';
import { ChallengeProvider, useChallengeContext } from '../context/ChallengeContext';
import GuessPreviewModal from './GuessPreviewModal';

// Sub-components
import { ChallengeCreate } from './challenge/ChallengeCreate';
import { ChallengeLobby } from './challenge/ChallengeLobby';
import { ChallengeGameplayContainer } from './challenge/ChallengeGameplayContainer';
import { ChallengeSkeleton, ErrorFallback, ChallengeItem } from './challenge/ChallengeUIElements';

interface ChallengeModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: any;
    onChallengeCreated?: (challenge: Challenge, invitedUsernames: string[], invitedIds: string[]) => void;
    initialChallengeId?: string | null;
}

const ChallengeModalContent = memo(({ user }: { onClose: () => void, user: any }) => {
    const {
        activeTab, setActiveTab,
        isPlaying,
        selectedChallenge,
        filteredChallenges,
        myChallenges,
        handleViewChallenge,
        loadMyChallenges,
        loading,
        error,
        searchQuery, setSearchQuery,
        statusFilter, setStatusFilter,
        previewParticipant, setPreviewParticipant,
        unplayedCount
    } = useChallengeContext();

    return (
        <motion.div
            key={isPlaying ? "gameplay" : "lobby"}
            initial={{ opacity: 0, x: isPlaying ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isPlaying ? -20 : 20 }}
            className="flex flex-col h-full overflow-hidden"
        >
            {isPlaying ? (
                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                    <ChallengeGameplayContainer />
                </div>
            ) : (
                <>
                    {selectedChallenge ? null : (
                        <div className="flex border-b border-white/5 shrink-0">
                            <button
                                onClick={() => { setActiveTab('my'); loadMyChallenges(); }}
                                className={`flex-1 py-4 text-xs font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 ${activeTab === 'my' ? 'text-correct border-b-2 border-correct' : 'text-gray-500 hover:text-white'}`}
                            >
                                My Challenges
                                {unplayedCount > 0 && (
                                    <span className="bg-correct text-black text-[9px] px-1.5 py-0.5 rounded-full min-w-[16px] text-center">
                                        {unplayedCount}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => setActiveTab('create')}
                                className={`flex-1 py-4 text-xs font-black uppercase tracking-widest transition-colors ${activeTab === 'create' ? 'text-correct border-b-2 border-correct' : 'text-gray-500 hover:text-white'}`}
                            >
                                Create
                            </button>
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10">
                        {error ? (
                            <ErrorFallback
                                message={error}
                                onRetry={() => {
                                    if (selectedChallenge) handleViewChallenge(selectedChallenge.id);
                                    else if (activeTab === 'my') loadMyChallenges();
                                }}
                            />
                        ) : selectedChallenge ? (
                            <ChallengeLobby />
                        ) : activeTab === 'create' ? (
                            <ChallengeCreate />
                        ) : (
                            <div className="space-y-6">
                                {/* Search and Filters */}
                                <div className="space-y-4">
                                    <div className="relative group">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-correct transition-colors" size={18} />
                                        <input
                                            type="text"
                                            placeholder="Search by opponent name..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-sm focus:outline-none focus:border-correct/50 focus:bg-white/10 transition-all"
                                        />
                                    </div>

                                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                                        {(['ALL', 'ACTIVE', 'COMPLETED'] as const).map((f) => (
                                            <button
                                                key={f}
                                                onClick={() => setStatusFilter(f)}
                                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${statusFilter === f ? 'bg-correct text-black shadow-lg shadow-correct/20' : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-white'}`}
                                            >
                                                {f}
                                            </button>
                                        ))}
                                    </div>
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
                </>
            )}

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
        </motion.div>
    );
});

export const ChallengeModal = ({ isOpen, onClose, user, onChallengeCreated, initialChallengeId }: ChallengeModalProps) => {
    if (!isOpen) return null;

    return (
        <ChallengeProvider user={user} onChallengeCreated={onChallengeCreated} initialChallengeId={initialChallengeId}>
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
                                    Challenges
                                </h2>
                                <p className="text-gray-400 text-xs">
                                    Compete with friends
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
                        <AnimatePresence mode="wait">
                            <ChallengeModalContent onClose={onClose} user={user} />
                        </AnimatePresence>
                    </div>
                </motion.div>
            </div>
        </ChallengeProvider>
    );
};

