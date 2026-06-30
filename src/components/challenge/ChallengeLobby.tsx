/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Eye,
  Play,
  Share2,
  Clock,
  Copy,
  SlidersHorizontal,
  Shield,
  Sparkles,
  Globe,
  Lock,
  Hourglass,
  Trash2,
  Trophy,
} from "lucide-react";
import { memo, useMemo, useCallback, useState, useRef, useEffect } from "react";
import { useChallengeContext } from "../../context/ChallengeContext";
import { formatTime } from "./lib";
import { type ChallengeParticipant } from "../../hooks/useChallenge";
import { useApp } from "../../context/AppContext";
import { ProtectedAvatar } from "../chat/ProtectedAvatar";
import { ConfirmationModal } from "../ConfirmationModal";
import { SHAPESHIFTER_MAX_ATTEMPTS, DEFAULT_MAX_PARTICIPANTS, MAX_ATTEMPTS } from "../../constants/game";
import { safeLocalStorage, safeSessionStorage } from "../../utils/storage";
import { ChallengeChat } from "./ChallengeChat";
import { useChallengeChat } from "../../hooks/useChallengeChat";
import {
  parseMarathonGames,
  getMarathonTimer,
  getHandicapStarter,
} from "../../utils/marathon";
import { deobfuscateWord } from "../../lib/game-logic";
import { LobbyParticipantsSkeleton } from "./ChallengeUIElements";
import formatUsername from '../../utils/formatUsername';

const MODE_DEFINITIONS = {
  LIVE: {
    title: "Live Race",
    description: "A real-time competition where all players start at the same time and race to the finish. Speed is key!",
    color: "bg-red-500/20 text-red-400 border-red-500/30"
  },
  ANYTIME: {
    title: "Anytime Mode",
    description: "Play at your own pace any time before the challenge expires. Highest skill score wins.",
    color: "bg-green-500/20 text-green-400 border-green-500/30"
  },
  MARATHON: {
    title: "Marathon Mode",
    description: "A series of multiple words of increasing lengths that you must solve in sequence.",
    color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
  },
  BOT_MARATHON: {
    title: "Daily Event",
    description: "A special recurring marathon event curated by the Variant Bot with daily rewards.",
    color: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30"
  },
  SHAPESHIFTER: {
    title: "Shape Shifter",
    description: "An adversarial mode where the target word changes with each guess, respecting your previous feedback. Boxing it in is the goal!",
    color: "bg-purple-500/20 text-purple-400 border-purple-500/30"
  },
  PUBLIC: {
    title: "Public Room",
    description: "This challenge is open to anyone with the link. Compete with the community!",
    color: "bg-correct/20 text-correct border-correct/30"
  },
  DISABLE_HINTS: {
    title: "Hardcore Mode",
    description: "Hints are completely disabled for this challenge. Pure skill only!",
    color: "bg-orange-500/20 text-orange-400 border-orange-500/30"
  },
  HANDICAP: {
    title: "Handicap Starter",
    description: "Players are given a specific starting word to use. This can be a strategic hint or a mandatory first guess.",
    color: "bg-correct/20 text-correct border-correct/30"
  }
};

const ClickableModeLabel = memo(({ type, children, className, isPlain }: { type: keyof typeof MODE_DEFINITIONS, children: React.ReactNode, className?: string, isPlain?: boolean }) => {
  const { triggerToast } = useApp();
  const def = MODE_DEFINITIONS[type];

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerToast(`${def.title}: ${def.description}`, 12000, true);
  };

  return (
    <button
      onClick={handleClick}
      className={isPlain
        ? `cursor-help transition-all hover:text-white text-left ${className}`
        : `inline-flex items-center justify-center px-2 sm:px-3 py-1 rounded-full text-[0.5rem] sm:text-[0.625rem] font-black uppercase tracking-widest leading-none text-center border cursor-help transition-all hover:scale-105 active:scale-95 ${def.color} ${className}`}
    >
      {children}
    </button>
  );
});

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
  p,
  isMarathon,
  totalMarathonGames,
  myHasFinished,
  isLive,
  onPreview,
  canPreviewAll,
  isExpired,
}: ParticipantItemProps) {
  const pIsFinished = p.status === "completed" || p.status === "timed_out";

  const marathonCompletedCount = useMemo(() => {
    if (!isMarathon || !p.marathon_progress) return 0;
    let count = 0;
    for (let i = 0; i < p.marathon_progress.length; i++) {
      const status = p.marathon_progress[i].status;
      if (status === "completed" || status === "timed_out") count++;
    }
    return count;
  }, [isMarathon, p.marathon_progress]);

  const showScore =
    pIsFinished || (isMarathon && p.score > 0) || canPreviewAll || isExpired;
  const canClick = myHasFinished || isMarathon || canPreviewAll || isExpired;

  return (
    <div
      onClick={() => {
        if (canClick) onPreview(p);
      }}
      className={`flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5 transition-all ${canClick ? "cursor-pointer hover:bg-white/10 hover:border-white/20" : ""}`}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full border-2 border-white/10 overflow-hidden bg-gray-800 cursor-pointer hover:scale-105 transition-transform"
          onClick={(e) => {
            if (p.user_id) {
              e.stopPropagation();
              window.dispatchEvent(
                new CustomEvent("open-user-profile", {
                  detail: { userId: p.user_id },
                }),
              );
            }
          }}
        >
          <ProtectedAvatar
            userId={p.user_id || undefined}
            src={p.profiles?.avatar_url || undefined}
            username={p.profiles?.username || undefined}
            className="w-full h-full shrink-0"
          />
        </div>
        <div>
          <p
            className="text-sm font-bold cursor-pointer hover:underline"
            onClick={(e) => {
              if (p.user_id) {
                e.stopPropagation();
                window.dispatchEvent(
                  new CustomEvent("open-user-profile", {
                    detail: { userId: p.user_id },
                  }),
                );
              }
            }}
          >
            {p.profiles?.username || "Player"}
          </p>
          <p
            className={`text-[9px] font-black uppercase ${pIsFinished ? "text-white/60" : "text-yellow-500"}`}
          >
            {isMarathon
              ? `${marathonCompletedCount}/${totalMarathonGames} Games`
              : p.status === "timed_out"
                ? "Time Expired"
                : p.status}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {showScore && (
          <div className="text-right">
            <p className="text-correct font-black text-lg">{p.score}</p>
            <div className="flex flex-col items-end">
              {!isMarathon && (
                <p className="text-[9px] text-white/60 font-bold uppercase">
                  {p.attempts} Tries
                </p>
              )}
              {isLive && p.time_taken && (
                <div className="flex items-center gap-1 text-[8px] font-black text-white/70">
                  <Clock size={8} />
                  <span>{formatTime(p.time_taken)}</span>
                </div>
              )}
            </div>
          </div>
        )}
        {(myHasFinished || isMarathon || canPreviewAll) && (
          <div className="text-white/60">
            <Eye size={16} />
          </div>
        )}
      </div>
    </div>
  );
});

export const ChallengeLobby = memo(function ChallengeLobby() {
  const {
    selectedChallenge,
    myParticipation,
    participants,
    copyLink,
    shareLink,
    setPreviewParticipant,
    handleStartGame,
    setSelectedChallenge,
    loading,
    registerAnonymousUser,
    effectiveUser,
    setIsEditingChallenge,
    handleDelete,
    loadingParticipants,
    participantsError,
    retryFetchParticipants,
  } = useChallengeContext();
  const { triggerToast } = useApp();

  const [nicknameInput, setNicknameInput] = useState("");
  const [showGuestInput, setShowGuestInput] = useState(false);
  const [lobbyTab, setLobbyTab] = useState<'lobby' | 'chat'>('lobby');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isGuest = useMemo(() => {
    if (!effectiveUser) return false;
    return effectiveUser.id === safeLocalStorage.getItem('wordle_anon_id');
  }, [effectiveUser]);

  const { messages, sendMessage, editMessage, deleteMessage, reactToMessage, typingUsers, setTyping, loading: chatLoading } = useChallengeChat(
    selectedChallenge?.id,
    effectiveUser,
    isGuest
  );

  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const lastProcessedMessageIdRef = useRef<string | null>(null);


  // Clear unread count when switching to chat tab
  useEffect(() => {
    if (lobbyTab === 'chat') {
      setUnreadChatCount(0);
    }
  }, [lobbyTab]);

  // Handle new messages for unread count and mentions
  useEffect(() => {
    if (!messages || messages.length === 0) {
      lastProcessedMessageIdRef.current = null;
      return;
    }

    const isInitialLoad = lastProcessedMessageIdRef.current === null;

    let startIdx = 0;
    if (!isInitialLoad) {
      const idx = messages.findIndex(m => m.id === lastProcessedMessageIdRef.current);
      if (idx !== -1) {
        startIdx = idx + 1;
      }
    }

    const newMessages = messages.slice(startIdx);
    lastProcessedMessageIdRef.current = messages[messages.length - 1].id;

    if (isInitialLoad || newMessages.length === 0) return;

    let newUnreadCount = 0;
    let gotMention = false;

    newMessages.forEach(msg => {
      const isMe =
        (msg.sender_id && msg.sender_id === effectiveUser?.id) ||
        (msg.guest_sender_id && msg.guest_sender_id === effectiveUser?.id);

      if (!isMe) {
        if (lobbyTab !== 'chat') {
          newUnreadCount++;
        }

        // Scan for mention of the current user: @username
        const myUsername = effectiveUser?.username || effectiveUser?.user_metadata?.full_name || '';
        if (myUsername) {
          const escapedUsername = myUsername.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
          const mentionRegex = new RegExp(`@${escapedUsername}\\b`, 'i');
          if (mentionRegex.test(msg.content)) {
            gotMention = true;
          }
        }
      }
    });

    if (newUnreadCount > 0) {
      setUnreadChatCount(prev => prev + newUnreadCount);
    }

    if (gotMention) {
      const lastMsg = newMessages[newMessages.length - 1];
      triggerToast(`@${formatUsername(lastMsg.sender_name)} mentioned you in chat!`, 4000);
    }
  }, [messages, lobbyTab, effectiveUser, triggerToast]);

  const handlePreview = useCallback(
    (p: ChallengeParticipant) => {
      setPreviewParticipant(p);
    },
    [setPreviewParticipant],
  );

  const isHost = selectedChallenge?.creator_id === effectiveUser?.id;
  const canEditOrDelete = useMemo(() => {
    if (!selectedChallenge || !participants) return false;
    return !participants.some(p => p.status !== 'pending' && p.status !== 'host');
  }, [selectedChallenge, participants]);

  if (!selectedChallenge) return null;

  const isMarathon = selectedChallenge.word_length === 1;
  const isLive = selectedChallenge.mode === "LIVE";
  const myHasFinished =
    myParticipation?.status === "completed" ||
    myParticipation?.status === "timed_out";
  const isCreatorOfCustom =
    selectedChallenge.creator_id === effectiveUser?.id &&
    selectedChallenge.is_custom_word;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const isExpired = useMemo(
    () => new Date(selectedChallenge.expires_at) < new Date(),
    [selectedChallenge.expires_at],
  );

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const marathonGamesList = useMemo(() => {
    if (!isMarathon) return [];
    return parseMarathonGames(
      selectedChallenge.target_word,
      selectedChallenge.salt,
    );
  }, [isMarathon, selectedChallenge.target_word, selectedChallenge.salt]);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const marathonCompletedCount = useMemo(() => {
    if (!isMarathon || !myParticipation?.marathon_progress) return 0;
    let count = 0;
    for (let i = 0; i < myParticipation.marathon_progress.length; i++) {
      const s = myParticipation.marathon_progress[i].status;
      if (s === "completed" || s === "timed_out") count++;
    }
    return count;
  }, [isMarathon, myParticipation?.marathon_progress]);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const deobfuscatedTargetWord = useMemo(() => {
    if (!selectedChallenge || isMarathon) return "";
    return deobfuscateWord(
      selectedChallenge.target_word,
      selectedChallenge.salt,
    );
  }, [selectedChallenge, isMarathon]);

  const maxParts = selectedChallenge.max_participants || DEFAULT_MAX_PARTICIPANTS;
  const currentParts = participants.length;
  const isFull =
    currentParts >= maxParts && !myParticipation && !isCreatorOfCustom;

  return (
    <div className="space-y-6">
      <div className="bg-white/5 p-2 sm:p-4 rounded-2xl border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-correct/5 blur-3xl -mr-16 -mt-16 pointer-events-none" />

        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <ClickableModeLabel type={selectedChallenge.mode as any}>
              <span className="hidden sm:inline">{selectedChallenge.mode === "LIVE" ? "Live Race" : "Anytime Mode"}</span>
              <span className="sm:hidden">{selectedChallenge.mode === "LIVE" ? "⚡ Live" : "⏳ Async"}</span>
            </ClickableModeLabel>

            {isMarathon && (
              <ClickableModeLabel type="MARATHON">
                <span className="hidden sm:inline">Marathon</span>
                <span className="sm:hidden">🏃 Mar.</span>
              </ClickableModeLabel>
            )}

            {selectedChallenge.is_public && (
              <ClickableModeLabel type="PUBLIC">
                <span className="hidden sm:inline">Public</span>
                <span className="sm:hidden">🌍 Pub</span>
              </ClickableModeLabel>
            )}

            {selectedChallenge.is_bot_marathon && (
              <ClickableModeLabel type="BOT_MARATHON">
                <span className="hidden sm:inline">Daily Event</span>
                <span className="sm:hidden">🤖 Daily</span>
              </ClickableModeLabel>
            )}

            {selectedChallenge.is_shapeshifter && (
              <ClickableModeLabel type="SHAPESHIFTER" className="animate-pulse">
                <span className="hidden sm:inline">Shape Shifter</span>
                <span className="sm:hidden">🌀 Shift</span>
              </ClickableModeLabel>
            )}

            {selectedChallenge.disable_hints && (
              <ClickableModeLabel type="DISABLE_HINTS">
                <span className="hidden sm:inline">No Hints</span>
                <span className="sm:hidden">🚫 Hints</span>
              </ClickableModeLabel>
            )}
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => copyLink(selectedChallenge)}
              className="text-white hover:text-white flex items-center gap-1.5 text-[10px] font-bold uppercase transition-colors"
            >
              <Copy size={12} /> Copy Link
            </button>
            <button
              onClick={() => shareLink(selectedChallenge)}
              className="text-white hover:text-white flex items-center gap-1.5 text-[10px] font-bold uppercase transition-colors"
            >
              <Share2 size={12} /> Share
            </button>
          </div>
        </div>
        <h3 className="text-xl font-black mb-1">
          {isMarathon
            ? `The Marathon (${marathonGamesList.length} Games)`
            : `${selectedChallenge.word_length} Letter Word`}
        </h3>
        {isMarathon && (
          <>
            <p className="text-white text-sm mb-2">
              Solve sequence : {" "}
              <span className="text-green-500 text-[0.5rem] sm:text-[0.8rem]">
                ({marathonGamesList.map((g: { wordLength: number }) => g.wordLength).join("-")}).
              </span>
              <span> {selectedChallenge.mode === "LIVE" ? `You have ${selectedChallenge.max_time} minutes per word!` : "Take your time, async play."}</span>
            </p>


          </>
        )
        }
        {!isMarathon && (
          <p className="text-white text-sm mb-2">
            {selectedChallenge.mode === "LIVE"
              ? `Fastest wins! You have ${selectedChallenge.max_time} minutes.`
              : "Play anytime within the lifespan. Highest skill score wins!"}
          </p>)}

        {selectedChallenge.max_time && selectedChallenge.mode === "LIVE" && (
          <div className="inline-flex items-center gap-2 bg-red-500/10 px-3 py-1 rounded-lg border border-red-500/20">
            <Clock size={12} className="text-red-500" />
            <span className="text-[10px] font-black text-red-500 uppercase">
              {selectedChallenge.max_time}m Limit
            </span>
          </div>
        )}
      </div>

      {/* Tab Switcher */}
      <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 gap-1">
        <button
          onClick={() => setLobbyTab('lobby')}
          className={`flex-1 py-1.5 sm:py-2.5 text-center text-xs font-black uppercase tracking-widest rounded-lg transition-all cursor-pointer ${lobbyTab === 'lobby' ? 'bg-correct text-black font-extrabold' : 'text-white/70 hover:text-white hover:bg-white/5'}`}
        >
          Lobby
        </button>
        <button
          onClick={() => setLobbyTab('chat')}
          className={`flex-1 py-1.5 sm:py-2.5 text-center text-xs font-black uppercase tracking-widest rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${lobbyTab === 'chat' ? 'bg-correct text-black font-extrabold' : 'text-white/70 hover:text-white hover:bg-white/5'}`}
        >
          <span>Chat Room</span>
          {unreadChatCount > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full animate-bounce shrink-0">
              {unreadChatCount}
            </span>
          )}
        </button>
      </div>

      {lobbyTab === 'chat' ? (
        <ChallengeChat
          messages={messages}
          sendMessage={sendMessage}
          editMessage={editMessage}
          deleteMessage={deleteMessage}
          typingUsers={typingUsers}
          setTyping={setTyping}
          effectiveUser={effectiveUser}
          loading={chatLoading}
          participants={participants}
          reactToMessage={reactToMessage}
        />
      ) : (
        <>
          {/* Challenge Configuration Details */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3 space-y-2">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <h4 className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                <SlidersHorizontal size={12} className="text-correct" />
                Challenge Config.
              </h4>
              <span className="text-[7px] sm:text-[8px] font-bold text-white/70 uppercase">
                Hosted by{" "}
                {selectedChallenge.is_bot_marathon
                  ? "Variant Bot"
                  : selectedChallenge.profiles?.username ||
                  selectedChallenge.creator?.username ||
                  "Host"}
              </span>

            </div>

            <div className="pt-1 sm:pt-2 flex flex-col gap-3">
              {isExpired ? (
                <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl text-center space-y-1">
                  <p className="text-xs font-black uppercase text-red-500 flex items-center justify-center gap-1.5">
                    <Hourglass size={14} /> Challenge Expired ⌛
                  </p>
                  <p className="text-[10px] text-white font-bold leading-relaxed">
                    This challenge has ended. You can view the final scores and
                    details, but no more entries are allowed.
                  </p>
                </div>
              ) : isCreatorOfCustom ? (
                <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-2xl text-center space-y-1">
                  <p className="text-xs font-black uppercase text-yellow-500">
                    Host Mode Active 👑
                  </p>
                  <p className="text-[10px] text-white font-bold">
                    You created this custom word challenge. Watch your friends compete
                    on the leaderboard above!
                  </p>
                </div>
              ) : isFull ? (
                <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl text-center">
                  <p className="text-xs font-black uppercase text-red-500">
                    Challenge Full 🚫
                  </p>
                  <p className="text-[10px] text-white font-bold mt-1">
                    This challenge has reached its maximum participant limit of{" "}
                    {maxParts}.
                  </p>
                </div>
              ) : !effectiveUser ? (
                <div className="bg-white/5 border border-white/10 p-5 rounded-2xl space-y-4 animate-in fade-in duration-300">
                  <div className="text-center space-y-1">
                    <p className="text-xs font-black uppercase tracking-wider text-white">
                      Join the Challenge
                    </p>
                    <p className="text-[10px] text-white">
                      Log in to save stats permanently, or play now as a guest.
                    </p>
                  </div>

                  {!showGuestInput ? (
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => {
                          safeSessionStorage.setItem('auth_redirect_target', 'challenge');
                          window.dispatchEvent(new CustomEvent("open-auth-modal"));
                        }}
                        className="bg-correct text-black py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center justify-center cursor-pointer"
                      >
                        Log In / Sign Up
                      </button>
                      <button
                        onClick={() => setShowGuestInput(true)}
                        className="bg-white/10 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-white/20 transition-all flex items-center justify-center border border-white/5 cursor-pointer"
                      >
                        Play as Guest
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <input
                        type="text"
                        maxLength={15}
                        placeholder="Enter nickname..."
                        value={nicknameInput}
                        onChange={(e) =>
                          setNicknameInput(
                            e.target.value.replace(/[^A-Za-z0-9_]/g, ""),
                          )
                        }
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-correct outline-none uppercase text-center font-black tracking-widest text-correct"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => setShowGuestInput(false)}
                          className="bg-white/5 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all border border-white/5 cursor-pointer"
                        >
                          Back
                        </button>
                        <button
                          onClick={async () => {
                            const name = nicknameInput.trim();
                            if (name.length < 3) {
                              triggerToast(
                                "Nickname must be at least 3 characters.",
                                3000,
                              );
                              return;
                            }
                            const user = await registerAnonymousUser(name);
                            if (user) {
                              triggerToast("Guest profile created! Joining...", 2000);
                            }
                          }}
                          className="bg-correct text-black py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:brightness-110 transition-all cursor-pointer"
                        >
                          Join
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : !myHasFinished ? (
                <button
                  onClick={handleStartGame}
                  disabled={loading}
                  className="w-full bg-correct text-black py-4 rounded-2xl font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Play size={18} fill="currentColor" />{" "}
                  {myParticipation?.status === "playing"
                    ? "Continue Challenge"
                    : "Start Challenge"}
                </button>
              ) : (
                <div className="w-full bg-white/5 border border-white/10 text-correct py-4 rounded-2xl text-xs font-black uppercase tracking-widest text-center">
                  {isMarathon
                    ? `${marathonCompletedCount}/${marathonGamesList.length} Games Completed ${marathonCompletedCount === marathonGamesList.length ? '🎉' : '⌛'}`
                    : (myParticipation?.status === 'timed_out' ? 'Time Expired ⌛' : 'Challenge Completed 🎉')}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between px-2">
                <h4 className="text-xs font-black uppercase tracking-widest text-white">
                  Participants ({currentParts} / {maxParts})
                </h4>
              </div>
              <div className="space-y-2">
                {participantsError ? (
                  <div className="p-5 bg-red-950/20 border border-red-500/30 rounded-2xl text-center space-y-3">
                    <p className="text-xs font-black uppercase text-red-500">
                      Failed to load participants
                    </p>
                    <p className="text-[10px] text-white font-bold">
                      {participantsError}
                    </p>
                    <button
                      onClick={retryFetchParticipants}
                      className="bg-red-500 hover:bg-red-600 text-white font-black uppercase tracking-widest text-[9px] px-4 py-2 rounded-xl transition-colors cursor-pointer"
                    >
                      Retry Connection
                    </button>
                  </div>
                ) : participants.length === 0 ? (
                  loadingParticipants ? (
                    <LobbyParticipantsSkeleton />
                  ) : (
                    <div className="py-8 text-center text-white/70 text-[10px] font-black uppercase">
                      No participants found
                    </div>
                  )
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
                      canPreviewAll={
                        selectedChallenge.creator_id === effectiveUser?.id &&
                        !!selectedChallenge.is_custom_word
                      }
                      isExpired={isExpired}
                    />
                  ))
                )}
              </div>
            </div>



            <div className="grid grid-cols-2 gap-3">
              {/* Mode / Time Limit */}
              <div className="bg-white/3 p-3 rounded-xl border border-white/5 space-y-1">
                <p className="text-[8px] font-black uppercase text-white/70">
                  Timing & Mode
                </p>
                <div className="flex items-center gap-1.5">
                  <Clock
                    size={12}
                    className={
                      selectedChallenge.mode === "LIVE"
                        ? "text-red-500"
                        : "text-blue-500"
                    }
                  />
                  <span className="text-xs font-bold text-white">
                    {selectedChallenge.mode === "LIVE" ? (
                      <>
                        <span className="hidden sm:inline">Live Race</span>
                        <span className="sm:hidden">Live</span>
                      </>
                    ) : (
                      <>
                        <span className="hidden sm:inline">Anytime (Async)</span>
                        <span className="sm:hidden">A/M</span>
                      </>
                    )}
                  </span>
                </div>
                {selectedChallenge.mode === "LIVE" && (
                  <p className="text-[9px] text-white">
                    {isMarathon && selectedChallenge.marathon_timers
                      ? "Custom per-word timers"
                      : `${selectedChallenge.max_time}m per game limit`}
                  </p>
                )}
              </div>

              {/* Word Info */}
              <div className="bg-white/3 p-3 rounded-xl border border-white/5 space-y-1">
                <p className="text-[8px] font-black uppercase text-white/70">
                  Word Rules
                </p>
                <div className="flex items-center gap-1.5">
                  <Sparkles size={12} className="text-yellow-500" />
                  <span className="text-xs font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis">
                    {isMarathon ? (
                      <>
                        <span className="hidden sm:inline">Marathon ({marathonGamesList.length} Games)</span>
                        <span className="sm:hidden">M-({marathonGamesList.length})</span>
                      </>
                    ) : (
                      `${selectedChallenge.word_length || "Random"} Letters`
                    )}
                  </span>
                </div>
                <p className="text-[9px] text-white">
                  {selectedChallenge.is_shapeshifter
                    ? "Shape Shifter"
                    : selectedChallenge.is_custom_word
                      ? "Host Custom Word"
                      : "System Generated"}
                </p>
              </div>

              {/* Attempts Info */}
              <div className="bg-white/3 p-3 rounded-xl border border-white/5 space-y-1">
                <p className="text-[8px] font-black uppercase text-white/70">
                  Attempts
                </p>
                <div className="flex items-center gap-1.5">
                  <Trophy size={12} className="text-indigo-400" />
                  <span className="text-xs font-bold text-white">
                    {selectedChallenge.is_shapeshifter ? SHAPESHIFTER_MAX_ATTEMPTS : (selectedChallenge.max_attempts || MAX_ATTEMPTS)} Tries
                  </span>
                </div>
                <p className="text-[9px] text-white">
                  {selectedChallenge.is_shapeshifter
                    ? "Shifter Limit"
                    : (selectedChallenge.max_attempts && selectedChallenge.max_attempts !== MAX_ATTEMPTS
                      ? "Custom Limit"
                      : "Standard Limit")}
                </p>
              </div>

              {/* Handicap Info */}
              <div className="bg-white/3 p-3 rounded-xl border border-white/5 space-y-1 col-span-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <ClickableModeLabel type="HANDICAP" isPlain className="text-[8px] font-black uppercase text-white/70">
                      Handicap Starter
                    </ClickableModeLabel>
                    <div className="flex items-center gap-1.5">
                      <Shield
                        size={12}
                        className={
                          selectedChallenge.handicap_starter ||
                            selectedChallenge.handicap_starters
                            ? "text-correct"
                            : "text-white/55"
                        }
                      />
                      <span className="text-xs font-bold text-white">
                        {selectedChallenge.handicap_starter ||
                          selectedChallenge.handicap_starters
                          ? "Enabled"
                          : "Disabled"}
                      </span>
                    </div>
                  </div>
                  {(selectedChallenge.handicap_starter ||
                    selectedChallenge.handicap_starters) && (
                      <div className="text-right">
                        <span className="text-[9px] font-black bg-correct/10 text-correct border border-correct/20 px-2 py-0.5 rounded-md uppercase">
                          {selectedChallenge.handicap_enforced
                            ? "Auto-Enforced"
                            : "Optional"}
                        </span>
                      </div>
                    )}
                </div>
                {(selectedChallenge.handicap_starter ||
                  selectedChallenge.handicap_starters) && (
                    <div className="mt-2 text-[9px] text-white space-y-1 bg-black/20 p-2.5 rounded-lg border border-white/5">
                      {isMarathon && selectedChallenge.handicap_starters ? (
                        <div className="flex flex-wrap gap-1 justify-center text-center font-black max-h-[100px] overflow-y-auto animate-in fade-in duration-200">
                          {marathonGamesList.map((game, idx) => {
                            const w = getHandicapStarter(
                              selectedChallenge,
                              idx,
                              game.wordLength,
                            );
                            const hasWord = !!w && w !== "__SYSTEM_RANDOM__";
                            return (
                              <div
                                key={idx}
                                className="bg-white/5 p-1 rounded min-w-[45px]"
                              >
                                <span className="text-[7px] text-white/60 block">
                                  #{idx + 1} ({game.wordLength}L)
                                </span>
                                <span className="text-white/80 uppercase text-[8px]">
                                  {hasWord ? "Hidden" : "Rand"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="font-bold">
                          Starter Word:{" "}
                          <span className="text-white/80 uppercase tracking-wider font-mono">
                            {selectedChallenge.handicap_starter ===
                              "__SYSTEM_RANDOM__"
                              ? "Random (Hidden until start)"
                              : "Hidden until start"}
                          </span>
                        </p>
                      )}
                    </div>
                  )}
              </div>

              {/* Lifespan & Participants */}
              <div className="bg-white/3 p-3 rounded-xl border border-white/5 space-y-1">
                <p className="text-[8px] font-black uppercase text-white/70">
                  Privacy & Limits
                </p>
                <div className="flex items-center gap-1.5">
                  {selectedChallenge.is_public ? (
                    <Globe size={12} className="text-correct" />
                  ) : (
                    <Lock size={12} className="text-yellow-500" />
                  )}
                  <span className="text-xs font-bold text-white">
                    {selectedChallenge.is_public ? "Public Room" : "Invite Only"}
                  </span>
                </div>
                <p className="text-[9px] text-white">
                  {selectedChallenge.is_public
                    ? `Max ${selectedChallenge.max_participants || DEFAULT_MAX_PARTICIPANTS} players`
                    : "Direct shares only"}
                </p>
              </div>

              {/* Expiration Timer */}
              <div className="bg-white/3 p-3 rounded-xl border border-white/5 space-y-1">
                <p className="text-[8px] font-black uppercase text-white/70">
                  Room Lifespan
                </p>
                <div className="flex items-center gap-1.5">
                  <Hourglass size={12} className="text-white/70" />
                  <span className="text-xs font-bold text-white">Expires in</span>
                </div>
                <p className="text-[9px] text-white tabular-nums">
                  {new Date(selectedChallenge.expires_at).toLocaleString(
                    undefined,
                    {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    },
                  )}
                </p>
              </div>

              {/* Custom Marathon Timers if active */}
              {isMarathon &&
                selectedChallenge.mode === "LIVE" &&
                selectedChallenge.marathon_timers && (
                  <div className="bg-white/3 p-3 rounded-xl border border-white/5 space-y-1 col-span-2">
                    <p className="text-[8px] font-black uppercase text-white/70">
                      Marathon Game Time Limits
                    </p>
                    <div className="flex flex-wrap gap-1.5 justify-center pt-1 max-h-[120px] overflow-y-auto animate-in fade-in duration-200">
                      {marathonGamesList.map((game, idx) => {
                        const t = getMarathonTimer(
                          selectedChallenge,
                          idx,
                          game.wordLength,
                        );
                        return (
                          <div
                            key={idx}
                            className="bg-black/30 p-1.5 rounded-lg border border-white/5 text-center min-w-[50px]"
                          >
                            <p className="text-[8px] font-bold text-white/70">
                              #{idx + 1} ({game.wordLength}L)
                            </p>
                            <p className="text-[10px] font-black text-white">
                              {t}m
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
            </div>

            {/* Target Word Section for Completed Challenges */}
            {myParticipation && (
              <>
                {!isMarathon ? (
                  (myParticipation.status === 'completed' || myParticipation.status === 'timed_out') && (
                    <div className="mt-4 bg-white/3 p-4 rounded-xl border border-white/5 space-y-1.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <p className="text-[8px] font-black uppercase text-white/50 tracking-wider">
                        Target Answer
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-black uppercase tracking-wider font-mono text-correct">
                          {deobfuscatedTargetWord}
                        </span>
                        <span className="text-[8px] font-black bg-correct/10 text-correct border border-correct/20 px-2 py-0.5 rounded uppercase">
                          Revealed
                        </span>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="mt-4 bg-white/3 p-4 rounded-xl border border-white/5 space-y-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <p className="text-[8px] font-black uppercase text-white/50 tracking-wider">
                      Marathon Target Answers
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {marathonGamesList.map((game, idx) => {
                        const prog = myParticipation.marathon_progress?.find((p: { status: string, game_index: number }) => p.game_index === idx);
                        const isFinished = prog?.status === 'completed' || prog?.status === 'timed_out';
                        return (
                          <div key={idx} className="bg-black/20 p-2.5 rounded-xl border border-white/5 flex flex-col gap-0.5">
                            <span className="text-[8px] text-white/40 font-bold uppercase">Game #{idx + 1} ({game.wordLength}L)</span>
                            <span className={`text-xs font-black uppercase tracking-widest ${isFinished ? 'text-correct font-mono' : 'text-white/20'}`}>
                              {isFinished ? game.word : '• '.repeat(game.wordLength).trim()}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>




        </>
      )}

      <div className="pt-6 flex flex-col gap-3">
        {/* Host Edit/Delete Actions (Only in Lobby tab and if unplayed) */}
        {lobbyTab === 'lobby' && isHost && canEditOrDelete && (
          <div className="grid grid-cols-2 gap-3 p-3 bg-white/5 border border-white/10 rounded-2xl">
            <button
              onClick={() => setIsEditingChallenge(true)}
              className="bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <SlidersHorizontal size={14} /> Edit Challenge
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/20 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>
        )}

        <button
          onClick={() => setSelectedChallenge(null)}
          className="w-full bg-white/5 border border-white/10 text-white py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all cursor-pointer"
        >
          Back to List
        </button>
      </div>

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={async () => {
          setShowDeleteConfirm(false);
          await handleDelete(selectedChallenge.id);
        }}
        title="Delete Challenge"
        message="Are you sure you want to delete this challenge? This action is permanent and will remove all lobby information."
        confirmLabel="Delete"
        type="danger"
      />
    </div>
  );
});
