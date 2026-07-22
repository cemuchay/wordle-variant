/* eslint-disable @typescript-eslint/no-explicit-any */
import { memo, useState, useMemo, useEffect, useRef } from "react";
import {
  X,
  Trophy,
  Search,
  ArrowLeft,
  SlidersHorizontal,
  Plus,
  HelpCircle,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { type Challenge } from "../hooks/useChallenge";
import { ChallengeProvider } from "../context/ChallengeProvider";
import { useChallengeContext } from "../context/ChallengeContext";
import { useChallengeFilters } from "../context/ChallengeFiltersContext";
import { usePlayedChallenges, PLAYED_PAGE_SIZE } from "../hooks/queries/useChallengeQueries";
import GuessPreviewModal from "./guess-preview";
import { AudioChatControls } from "./challenge/AudioChatControls";
import { Z_INDEX, } from "../constants/ui";
import { safeLocalStorage, safeSessionStorage } from "../utils/storage";

import { useChallengeStore } from "../store/useChallengeStore";
import { useAppStore } from "../store/useAppStore";
import { useApp } from "../context/AppContext";

// Sub-components
import { ChallengeCreate } from "./challenge/ChallengeCreate";
import { ChallengeLobby } from "./challenge/ChallengeLobby";
import { ChallengeGameplayContainer } from "./challenge/ChallengeGameplayContainer";
import {
  ChallengeSkeleton,
  ErrorFallback,
  ChallengeItem,
} from "./challenge/ChallengeUIElements";
import { WORD_LENGTHS } from "../constants/game";
import { MarathonBanner } from "./common/MarathonBanner";

interface ChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onChallengeCreated?: (
    challenge: Challenge,
    invitedUsernames: string[],
    invitedIds: string[],
  ) => void;
  initialChallengeId?: string | null;
  inline?: boolean;
}

const GameplayTimer = memo(() => {
  const timeLeft = useChallengeStore((s) => s.timeLeft);
  if (timeLeft === null) return null;
  return (
    <div className="flex items-center gap-2 bg-red-500/10 px-2 py-0.5 rounded-lg border border-red-500/20">
      <span className="text-[10px] font-black text-red-500 tabular-nums">
        {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
      </span>
    </div>
  );
});

const GuestChallengeView = memo(({ onClose }: { onClose: () => void }) => {
  return (
    <div
      className="fixed inset-0 bg-black flex flex-col"
      style={{ zIndex: Z_INDEX.MODAL_BACKDROP }}
    >
      <div className="flex flex-col h-full w-full overflow-hidden bg-background">
        <div className="p-4 pt-[calc(2rem+env(safe-area-inset-top,0))] sm:p-6 border-b border-white/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="bg-correct/20 p-1.5 sm:p-2 rounded-lg sm:rounded-xl">
              <Trophy className="text-correct w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <h2 className="text-lg sm:text-xl font-black uppercase tracking-tighter">
              Challenges
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 hover:bg-white/5 rounded-full transition-colors text-gray-400 hover:text-white cursor-pointer"
          >
            <X className="w-[18px] h-[18px] sm:w-5 sm:h-5" />
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-8 pb-[calc(2rem+env(safe-area-inset-bottom,0))] text-center space-y-6 overflow-y-auto">
          <div className="bg-correct/10 p-6 rounded-3xl border border-correct/20">
            <Trophy className="w-12 h-12 text-correct mx-auto" />
          </div>

          <div className="space-y-2 max-w-xs">
            <h3 className="text-xl font-black uppercase tracking-tighter">
              Authentication Required
            </h3>

            <p className="text-gray-400 text-xs leading-relaxed">
              Sign in to challenge friends, track your global ranking, and sync
              your progress across all your devices.
            </p>
          </div>

          <div className="w-full max-w-sm space-y-3">
            <button
              onClick={() => {
                onClose();
                safeSessionStorage.setItem("auth_redirect_target", "challenge");
                window.dispatchEvent(new CustomEvent("open-auth-modal"));
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
              <p className="text-[9px] text-gray-500">Play with friends</p>
            </div>

            <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
              <p className="text-[10px] font-black uppercase text-correct">
                Global
              </p>
              <p className="text-[9px] text-gray-500">Ranked Matchmaking</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

const AuthenticatedChallengeContent = memo(
  ({ onClose, user }: { onClose: () => void; user: any }) => {
    const [showFilters, setShowFilters] = useState(false);
    const [isCreatingChallenge, setIsCreatingChallenge] = useState(false);
    const [isHelpOpen, setIsHelpOpen] = useState(false);

    const { isDynamicIslandVisible } = useApp();
    const pendingChallengeUserId = useAppStore(s => s.pendingChallengeUserId);

    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const {
      setActiveTab,
      isPlaying,
      setIsPlaying,
      selectedChallenge,
      setSelectedChallenge,
      myParticipation,
      myChallenges,
      handleViewChallenge,
      loadMyChallenges,
      loading,
      error,
      previewParticipant,
      setPreviewParticipant,
      setPreviewMarathonLength,
      previewMarathonGameIndex,
      setPreviewMarathonGameIndex,
      backAction,
      isEditingChallenge,
      setIsEditingChallenge,
      listColumn,
      setListColumn,
      isBackgroundFetching,
      dailyMarathonChallenges,
      initialChallengeId,
      activeGameLength,
      bootstrappingMessage,
    } = useChallengeContext();

    const {
      searchQuery,
      setSearchQuery,
      modeFilter,
      setModeFilter,
      lengthFilter,
      setLengthFilter,
      clearFilters,
      filteredChallenges,
      openChallengesCount,
    } = useChallengeFilters();

    const [playedPage, setPlayedPage] = useState(1);
    const { data: playedData, isFetching: isPlayedFetching } = usePlayedChallenges(
      listColumn === 'played' ? user?.id : undefined,
      playedPage,
    );

    // Reset scroll position to top whenever active challenge changes
    useEffect(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    }, [selectedChallenge?.id]);

    // Handle pre-selected user from DM
    useEffect(() => {
      if (pendingChallengeUserId) {
        setSelectedChallenge(null);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsCreatingChallenge(true);
      }
    }, [pendingChallengeUserId, setSelectedChallenge]);

    const activeCount = useMemo(() => {
      return myChallenges.filter((item: any) => {
        const isExpired = new Date(item.challenge?.expires_at) < new Date();
        const isCompleted = item.status === 'completed' || item.status === 'timed_out' || item.status === 'declined';
        const isBotMarathon = item.challenge?.is_bot_marathon;
        if (isBotMarathon && item.status === 'pending') return false;
        return !isExpired && !isCompleted && item.status !== 'viewed';
      }).length;
    }, [myChallenges]);

    const playedCount = useMemo(() => {
      return myChallenges.filter((item: any) => {
        const isExpired = new Date(item.challenge?.expires_at) < new Date();
        const isCompleted = item.status === 'completed' || item.status === 'timed_out' || item.status === 'declined';
        return !isExpired && isCompleted && item.status !== 'viewed';
      }).length;
    }, [myChallenges]);

    const expiredCount = useMemo(() => {
      return myChallenges.filter((item: any) => {
        const isExpired = new Date(item.challenge?.expires_at) < new Date();
        return isExpired;
      }).length;
    }, [myChallenges]);

    const unplayedCount = activeCount + openChallengesCount;

    const displayChallenges = useMemo(() => {
      if (listColumn === 'played') {
        return playedData?.items || [];
      }
      const marathonIds = (dailyMarathonChallenges || []).map((c: any) => c.challenge_id || c.challenge?.id);
      return filteredChallenges.filter(
        (item: any) => !marathonIds.includes(item.challenge_id || item.challenge?.id)
      );
    }, [listColumn, playedData, filteredChallenges, dailyMarathonChallenges]);

    const toggleFilters = () => {
      if (showFilters) clearFilters();
      setShowFilters(!showFilters);
    };


    //if initialChallengeId is present, nagivate to the challenge lobby
    useEffect(() => {
      if (initialChallengeId && initialChallengeId !== "null" && initialChallengeId !== "undefined") {
        handleViewChallenge(initialChallengeId);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Reset played page when navigating tabs or changing filters
    useEffect(() => {
      setPlayedPage(1);
    }, [listColumn, modeFilter, lengthFilter, searchQuery]);

    return (
      <div className="flex flex-col h-full overflow-hidden relative">
        <div
          id="challenge-modal-header"
          className="border-b border-white/5 flex items-center justify-between shrink-0 px-3 pb-3 sm:px-4 sm:pb-4 pt-3 sm:pt-4"
        >
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            {!isPlaying && selectedChallenge && (
              <button
                onClick={() => setSelectedChallenge(null)}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white cursor-pointer mr-1 flex items-center justify-center shrink-0"
                title="Back to List"
              >
                <ArrowLeft size={18} />
              </button>
            )}

            {/* Combined Parent Layout Context Wrapper */}
            <div className="flex items-center gap-3 sm:gap-4 w-full min-w-0">
              {/* 1. Trophy Container */}

              <div className="bg-correct/20 p-0.5 sm:p-1 rounded-lg sm:rounded-xl shrink-0 flex items-center justify-center">
                <Trophy className="text-correct w-8 h-8 sm:w-10 sm:h-10" />
              </div>

              {/* 2. Unified Text & Actions Row (Strictly inline across all screens) */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* Header Title Section */}
                <div className="flex items-center gap-2 shrink-0">
                  <h2 className="text-base sm:text-xl font-black uppercase tracking-tighter truncate">
                    {selectedChallenge && myParticipation && activeGameLength ? `#${activeGameLength}L` : !selectedChallenge && !myParticipation ? "Challenges" : "Challenge"}
                  </h2>
                  {isBackgroundFetching && (
                    <Loader2 className="w-3.5 h-3.5 text-correct animate-spin shrink-0" />
                  )}
                </div>

                {/* Secondary Action Controls Inline Area */}
                {isPlaying && (
                  <div className="flex items-center gap-1.5 sm:gap-2 border-l border-white/10 pl-3">
                    <button
                      onClick={() => (backAction ? backAction() : setIsPlaying(false))}
                      className="p-1 hover:bg-white/10 rounded-lg transition-colors text-white shrink-0"
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
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Side Action Shell Panel */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {!isPlaying && !selectedChallenge && (
              <button
                onClick={() => {
                  setActiveTab("my");
                  setIsCreatingChallenge(true);
                }}
                className="bg-correct hover:bg-correct/90 text-black px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider flex items-center gap-1 transition-all hover:scale-[1.02] active:scale-[0.98] mr-1 sm:mr-2"
              >
                <Plus className="w-6 h-6" strokeWidth={3} />
              </button>
            )}
            <button
              onClick={() => setIsHelpOpen(true)}
              className="p-1.5 sm:p-2 hover:bg-white/5 rounded-full transition-colors text-white"
              title="Challenge Guide"
            >
              <HelpCircle className="w-[18px] h-[18px] sm:w-5 sm:h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 hover:bg-white/5 rounded-full transition-colors text-white cursor-pointer"
            >
              <X className="w-[18px] h-[18px] sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden min-h-0 flex flex-col relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={isPlaying ? "gameplay" : "lobby"}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="flex flex-col h-full overflow-hidden absolute inset-0"
            >
              {isPlaying ? (
                <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                  <ChallengeGameplayContainer />
                </div>
              ) : (
                <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                  {error ? (
                    <ErrorFallback
                      message={error}
                      onRetry={() => {
                        if (selectedChallenge)
                          handleViewChallenge(selectedChallenge.id);
                        else loadMyChallenges();
                      }}
                    />
                  ) : selectedChallenge ? (
                    <ChallengeLobby />
                  ) : (
                    <div className="space-y-6">
                      {/* Segmented Switcher for Columns */}
                      <div className="flex bg-white/5 p-0.5 sm:p-1 rounded-xl border border-white/10 gap-1 shrink-0">
                        {(["unplayed", "played"] as const).map((tab) => {
                          const count = tab === "unplayed" ? unplayedCount : (playedData?.total ?? playedCount + expiredCount);
                          const label = tab === "unplayed" ? `Unplayed (${count})` : `Played (${count})`;
                          return (
                            <button
                              key={tab}
                              onClick={() => setListColumn(tab)}
                              className={`flex-1 py-1.5 sm:py-2 text-center text-[10px] sm:text-[12px]  font-black uppercase tracking-widest rounded-lg transition-all cursor-pointer ${listColumn === tab
                                ? "bg-correct text-black font-extrabold shadow-md"
                                : "text-white hover:text-white hover:bg-white/5"
                                }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>

                      {/* Search and Filters Toggle */}
                      <div className="space-y-4">
                        {dailyMarathonChallenges.length > 0 && listColumn === 'unplayed' && (
                          <MarathonBanner
                            challenges={dailyMarathonChallenges}
                            onClick={(challenge) => {
                              handleViewChallenge(challenge.challenge_id || challenge.challenge?.id)
                            }}
                          />
                        )}

                        <div className="flex items-center gap-2">
                          <div className="relative flex-1 group">
                            <Search
                              className="absolute left-4 top-1/2 -translate-y-1/2 text-white group-focus-within:text-correct transition-colors"
                              size={18}
                            />
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
                            className={`p-3 rounded-2xl border transition-all ${showFilters ? "bg-correct text-black border-correct shadow-lg shadow-correct/20" : "bg-white/5 border-white/10 text-white hover:text-white hover:bg-white/10"}`}
                          >
                            <SlidersHorizontal size={20} />
                          </button>
                        </div>

                        <AnimatePresence>
                          {showFilters && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
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
                                  <span className="text-[9px] font-black uppercase text-white w-10 shrink-0">
                                    Mode
                                  </span>
                                  {(["ALL", "LIVE", "ANYTIME"] as const).map(
                                    (m) => (
                                      <button
                                        key={m}
                                        onClick={() => setModeFilter(m)}
                                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${modeFilter === m ? "bg-correct text-black" : "bg-white/5 text-white hover:bg-white/10 hover:text-white"}`}
                                      >
                                        {m}
                                      </button>
                                    ),
                                  )}
                                </div>

                                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                                  <span className="text-[9px] font-black uppercase text-white w-10 shrink-0">
                                    Length
                                  </span>
                                  <button
                                    onClick={() => setLengthFilter("ALL")}
                                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${lengthFilter === "ALL" ? "bg-correct text-black" : "bg-white/5 text-white hover:bg-white/10 hover:text-white"}`}
                                  >
                                    ALL
                                  </button>
                                  <button
                                    onClick={() => setLengthFilter(1)}
                                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${lengthFilter === 1 ? "bg-correct text-black" : "bg-white/5 text-white hover:bg-white/10 hover:text-white"}`}
                                  >
                                    Marathon
                                  </button>
                                  {WORD_LENGTHS.map((l) => (
                                    <button
                                      key={l}
                                      onClick={() => setLengthFilter(l)}
                                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${lengthFilter === l ? "bg-correct text-black" : "bg-white/5 text-white hover:bg-white/10 hover:text-white"}`}
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
                        {loading && displayChallenges.length === 0 ? (
                          <ChallengeSkeleton />
                        ) : (isPlayedFetching && listColumn === 'played') || (loading && listColumn !== 'played') ? (
                          <ChallengeSkeleton />
                        ) : displayChallenges.length === 0 ? (
                          <div className="py-12 text-center text-white">
                            {listColumn === 'played'
                              ? (playedData && playedData.total === 0
                                ? "No challenges played yet."
                                : "No matching challenges found.")
                              : myChallenges.length === 0
                                ? "No challenges yet."
                                : "No matching challenges found."}
                          </div>
                        ) : listColumn === 'unplayed' ? (
                          <>
                            {displayChallenges.filter((i: any) => i._section === 'active').map((item: any, idx: number) => (
                              <ChallengeItem
                                key={item.id}
                                item={item}
                                user={user}
                                onSelect={handleViewChallenge}
                                index={idx}
                              />
                            ))}
                            {displayChallenges.filter((i: any) => i._section === 'open').length > 0 && (
                              <div className="relative py-2">
                                <div className="absolute inset-0 flex items-center">
                                  <div className="w-full border-t border-white/10" />
                                </div>
                                <div className="relative flex justify-center">
                                  <span className="bg-gray-950 px-3 text-[9px] font-black uppercase tracking-widest text-white/30">
                                    — Open Challenges —
                                  </span>
                                </div>
                              </div>
                            )}
                            {displayChallenges.filter((i: any) => i._section === 'open').map((item: any, idx: number) => (
                              <ChallengeItem
                                key={item.id}
                                item={item}
                                user={user}
                                onSelect={handleViewChallenge}
                                index={idx}
                              />
                            ))}
                          </>
                        ) : (
                          <>
                            {displayChallenges.map((item: any, idx: number) => (
                              <ChallengeItem
                                key={item.id}
                                item={item}
                                user={user}
                                onSelect={handleViewChallenge}
                                index={idx}
                              />
                            ))}
                            {listColumn === 'played' && playedData && playedData.total > PLAYED_PAGE_SIZE && (
                              <div className="flex items-center justify-center gap-2 pt-4 pb-2">
                                <button
                                  onClick={() => setPlayedPage(p => Math.max(1, p - 1))}
                                  disabled={playedPage === 1}
                                  className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-white/5 text-white disabled:opacity-30 hover:bg-white/10 transition-all cursor-pointer disabled:cursor-default"
                                >
                                  Prev
                                </button>
                                {Array.from(
                                  { length: Math.ceil(playedData.total / PLAYED_PAGE_SIZE) },
                                  (_, i) => i + 1,
                                ).map(p => (
                                  <button
                                    key={p}
                                    onClick={() => setPlayedPage(p)}
                                    className={`w-8 h-8 rounded-lg text-[10px] font-black transition-all cursor-pointer ${p === playedPage
                                      ? 'bg-correct text-black'
                                      : 'bg-white/5 text-white hover:bg-white/10'
                                      }`}
                                  >
                                    {p}
                                  </button>
                                ))}
                                <button
                                  onClick={() => setPlayedPage(p => p + 1)}
                                  disabled={playedPage >= Math.ceil(playedData.total / PLAYED_PAGE_SIZE)}
                                  className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-white/5 text-white disabled:opacity-30 hover:bg-white/10 transition-all cursor-pointer disabled:cursor-default"
                                >
                                  Next
                                </button>
                              </div>
                            )}
                          </>
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
                  className="p-2 hover:bg-white/5 rounded-full transition-colors text-gray-400 hover:text-white cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-hide">
                <ChallengeCreate
                  onSuccess={() => setIsCreatingChallenge(false)}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Edit Challenge Modal Sheet overlay */}
        <AnimatePresence>
          {isEditingChallenge && selectedChallenge && (
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
                    <SlidersHorizontal size={20} />
                  </div>
                  <h3 className="text-lg font-black uppercase tracking-tighter text-white">
                    Edit Challenge
                  </h3>
                </div>
                <button
                  onClick={() => setIsEditingChallenge(false)}
                  className="p-2 hover:bg-white/5 rounded-full transition-colors text-gray-400 hover:text-white cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-hide">
                <ChallengeCreate
                  editingChallenge={selectedChallenge}
                  onSuccess={() => setIsEditingChallenge(false)}
                />
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
              className="absolute inset-0 bg-gray-950/98 backdrop-blur-md z-60 flex flex-col"
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
                  className="p-2 hover:bg-white/5 rounded-full transition-colors text-white hover:text-white cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-hide space-y-6 text-sm text-white">
                <section className="space-y-2">
                  <h4 className="text-sm font-black uppercase text-white tracking-wide">
                    🏆 What is Challenge Mode?
                  </h4>
                  <p className="text-xs leading-relaxed text-white">
                    Challenge Mode allows you to create custom variant games and
                    compete directly against friends or players globally. You
                    can play live in real-time or asynchronously at your own
                    pace.
                  </p>
                </section>

                <section className="space-y-3">
                  <h4 className="text-sm font-black uppercase text-white tracking-wide">
                    🎮 Game Modes
                  </h4>
                  <div className="grid gap-3">
                    <div className="bg-white/5 border border-white/5 p-3.5 rounded-2xl">
                      <h5 className="text-xs font-black uppercase text-correct">
                        Anytime (Asynchronous)
                      </h5>
                      <p className="text-[11px] text-white mt-1 leading-relaxed">
                        Create a challenge that remains open for up to 24 hours.
                        Participants play at their own leisure. The leaderboard
                        updates in real-time as scores are submitted.
                      </p>
                    </div>
                    <div className="bg-white/5 border border-white/5 p-3.5 rounded-2xl">
                      <h5 className="text-xs font-black uppercase text-red-500">
                        Live (Real-time Race)
                      </h5>
                      <p className="text-[11px] text-white mt-1 leading-relaxed">
                        A synchronous race against time. All players compete
                        concurrently. Has a strict time limit per game. Includes
                        high-fidelity built-in audio chat for in-game banter!
                      </p>
                    </div>
                  </div>
                </section>

                <section className="space-y-2">
                  <h4 className="text-sm font-black uppercase text-white tracking-wide">
                    ⚡ Marathon Mode
                  </h4>
                  <p className="text-xs leading-relaxed text-white">
                    Instead of a single word, compete over a sequence of words
                    of different lengths (e.g. 3-letter up to 7-letter words).
                  </p>
                  <ul className="list-disc pl-4 space-y-2 text-xs text-white">
                    <li>
                      <strong className="text-yellow-500">
                        Sequence Customization:
                      </strong>{" "}
                      Reorder games to build custom progressions (e.g., 5L{" "}
                      {"->"} 3L {"->"} 7L).
                    </li>
                    <li>
                      <strong className="text-yellow-500">
                        Force Game Order:
                      </strong>{" "}
                      Force sequential unlocking. Players must play game #1 to
                      unlock game #2, and so on.
                    </li>
                    <li>
                      <strong className="text-yellow-500">
                        Per-Word Timers:
                      </strong>{" "}
                      Set unique duration limits for each individual word length
                      in Live mode.
                    </li>
                  </ul>
                </section>

                <section className="space-y-2">
                  <h4 className="text-sm font-black uppercase text-white tracking-wide">
                    🌀 Shape Shifter Mode
                  </h4>
                  <p className="text-xs leading-relaxed text-white">
                    An adversarial mode where the secret target word changes dynamically in the background with each guess.
                  </p>
                  <ul className="list-disc pl-4 space-y-2 text-xs text-white">
                    <li>
                      <strong className="text-purple-400">
                        Adversarial Shifting:
                      </strong>{" "}
                      The target word shifts, but all your previously guessed correct (green), misplaced (yellow), and absent (gray) letter feedback is strictly respected.
                    </li>
                    <li>
                      <strong className="text-purple-400">
                        20 Attempts:
                      </strong>{" "}
                      Because the algorithm shifts the word to avoid matching, the game limit is extended to <strong className="text-white">20 tries</strong> to help you "box it in".
                    </li>
                    <li>
                      <strong className="text-purple-400">
                        Word Timeline:
                      </strong>{" "}
                      Complete transparency. Once the game ends, you can inspect the full sequence of words the algorithm shifted through.
                    </li>
                  </ul>
                </section>

                <section className="space-y-3">
                  <h4 className="text-sm font-black uppercase text-white tracking-wide">
                    🛠️ Advanced Rules
                  </h4>
                  <div className="space-y-2 text-xs text-white">
                    <p>
                      <strong className="text-white">
                        Custom Word Challenges:
                      </strong>{" "}
                      Create hand-crafted challenges with words of your own
                      choice. (Note: Creators of custom-word challenges cannot
                      play).
                    </p>
                    <p>
                      <strong className="text-white">Handicap Starters:</strong>{" "}
                      Pre-assign starter words to restrict players' first
                      guesses. Can be randomly chosen by the system or hardcoded
                      by the creator. You can enforce these starter words so
                      they are automatically entered as the first guess.
                    </p>
                    <p>
                      <strong className="text-white">Public Challenges:</strong>{" "}
                      Open the lobby to anyone with the shareable link and
                      customize the maximum player limit (up to 100
                      participants).
                    </p>
                  </div>
                </section>

                <div className="pt-2">
                  <button
                    onClick={() => setIsHelpOpen(false)}
                    className="w-full bg-correct text-black font-black uppercase py-4 rounded-2xl text-xs hover:brightness-110 transition-all"
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
              time_taken: previewParticipant.time_taken,
              target_words: previewParticipant.target_words || undefined,
            }}
            targetWord={selectedChallenge?.target_word}
            salt={selectedChallenge?.salt}
            challenge={selectedChallenge}
            lengthOfWord={selectedChallenge?.word_length}
            isCreator={
              selectedChallenge?.creator_id === user?.id &&
              !!selectedChallenge?.is_custom_word
            }
            isShapeshifter={selectedChallenge?.is_shapeshifter}
          />
        )}

        {/* Bootstrapping Overlay Loader */}
        <AnimatePresence>
          {bootstrappingMessage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/85 backdrop-blur-md z-100 flex flex-col items-center justify-center space-y-6"
            >
              <div className="relative flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-correct animate-spin" />
                <div className="absolute bg-correct/10 p-2.5 rounded-full">
                  <Trophy className="w-5 h-5 text-correct animate-pulse" />
                </div>
              </div>
              <div className="text-center space-y-2 max-w-xs px-6">
                <p className="text-sm font-black uppercase tracking-widest text-white/90 animate-pulse">
                  {bootstrappingMessage}
                </p>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider leading-relaxed">
                  Preparing your game environment
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  },
);

const hasRecentChallenges = (): boolean => {
  try {
    const stored = safeLocalStorage.getItem("wordle_recent_challenges");
    if (stored) {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) && parsed.length > 0;
    }
  } catch (e) {
    console.error("Failed to read recent challenges", e);
  }
  return false;
};

const ChallengeModalContent = memo(
  ({ onClose, user }: { onClose: () => void; user: any }) => {
    const { effectiveUser, selectedChallenge, loading } = useChallengeContext();
    const { filteredChallenges } = useChallengeFilters();
    const hasCachedData = filteredChallenges.length > 0 || !!selectedChallenge;
    if (
      !user &&
      !effectiveUser &&
      !selectedChallenge &&
      !loading &&
      !hasRecentChallenges() &&
      !hasCachedData
    ) {
      return <GuestChallengeView onClose={onClose} />;
    }
    return (
      <AuthenticatedChallengeContent
        onClose={onClose}
        user={effectiveUser || user}
      />
    );
  },
);

export const ChallengeModal = ({
  isOpen,
  onClose,
  user,
  onChallengeCreated,
  initialChallengeId,
  inline = false,
}: ChallengeModalProps) => {
  const isPlaying = useChallengeStore((s) => s.isPlaying);

  if (!isOpen && !inline) return null;

  if (!user && !initialChallengeId && !hasRecentChallenges()) {
    const id = safeLocalStorage.getItem("wordle_anon_id");
    const username = safeLocalStorage.getItem("wordle_anon_username");
    if (!id || !username) {
      return <GuestChallengeView onClose={onClose} />;
    }
  }

  const renderContent = () => (
    <ChallengeProvider
      user={user}
      onChallengeCreated={onChallengeCreated}
      initialChallengeId={initialChallengeId}
    >
      <ChallengeModalContent onClose={onClose} user={user} />
    </ChallengeProvider>
  );

  if (inline) {
    return (
      <div
        className={`flex flex-col h-full flex-1 min-h-0 w-full mx-auto bg-gray-900 overflow-hidden relative shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] transition-all duration-300 ${isPlaying ? 'max-w-none rounded-none border-none' : 'max-w-lg sm:rounded-[40px] sm:border sm:border-white/10'}`}
        style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
      >
        <div className="w-full max-w-xl mx-auto flex flex-col h-full min-h-0 flex-1 relative overflow-hidden">
          {renderContent()}
        </div>
      </div>
    );
  }

  return (
    <ChallengeProvider
      user={user}
      onChallengeCreated={onChallengeCreated}
      initialChallengeId={initialChallengeId}
    >
      <div
        className={`bg-gray-900 w-full h-full shadow-2xl flex flex-col transition-[height,width,max-height,max-width,border-radius,border-color] animate-in fade-in slide-in-from-bottom-6 duration-200 ${isPlaying
          ? "max-h-full rounded-none border-none sm:max-w-[50vw] sm:h-[90vh] sm:max-h-[90vh] sm:rounded-3xl sm:border sm:border-white/10"
          : "max-h-full rounded-none border-none sm:max-w-xl sm:rounded-3xl sm:border sm:border-white/10 sm:h-[85vh] sm:max-h-[85vh]"
          }`}
      >
        <ChallengeModalContent onClose={onClose} user={user} />
      </div>
    </ChallengeProvider>
  );
};
