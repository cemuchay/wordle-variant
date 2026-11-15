import React from 'react';
import { X, Bell, Info, BarChart3, Trophy } from 'lucide-react';
import type { Announcement } from '../data/announcements';
import type { Poll } from '../types/poll';
import { ModalLayout } from './layout/ModalLayout';
import { ChatPollCard } from './chat/poll/ChatPollCard';
import { MarathonBanner } from './common/MarathonBanner';

interface AnnouncementModalProps {
    isOpen: boolean;
    onClose: () => void;
    announcement: Announcement | null;
    activePoll?: Poll | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    marathonChallenge?: any | null;
    hasJoinedChallenge?: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onPlayChallenge?: (challenge: any) => void;
    currentUserId?: string;
    currentUserProfile?: { id: string; username: string; avatar_url: string };
}

export const AnnouncementModal: React.FC<AnnouncementModalProps> = ({
    isOpen,
    onClose,
    announcement,
    activePoll,
    marathonChallenge,
    hasJoinedChallenge = false,
    onPlayChallenge,
    currentUserId,
    currentUserProfile,
}) => {
    const isMarathonOnly = !announcement && !activePoll && Boolean(marathonChallenge);
    if (!isOpen || (!announcement && !activePoll && !marathonChallenge)) return null;

    const isPollOnly = !announcement && Boolean(activePoll);

    return (
        <ModalLayout isOpen={isOpen} onClose={onClose} maxWidth="full" showCloseButton={false} containerClassName="p-0!">
            <div className="flex flex-col h-full min-h-0 w-full max-w-lg mx-auto">
                {/* Header */}
                <div className="bg-primary/20 p-6 border-b border-white/10 flex items-center gap-4 shrink-0 relative">
                    <div className="bg-primary/20 p-3 rounded-xl text-primary">
                        {isMarathonOnly ? <Trophy size={24} /> : isPollOnly ? <BarChart3 size={24} /> : <Bell size={24} />}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">
                                {isMarathonOnly ? 'Daily Challenge' : isPollOnly ? 'Community Poll' : announcement?.type}
                            </span>
                            {!isPollOnly && !isMarathonOnly && announcement?.date && (
                                <span className="text-[10px] text-gray-500 font-mono italic">
                                    {announcement.date}
                                </span>
                            )}
                        </div>
                        <h2 className="text-xl font-black text-gray-100 uppercase tracking-tighter leading-tight mt-1">
                            {isMarathonOnly
                                ? hasJoinedChallenge
                                    ? 'Continue Your Marathon'
                                    : "Join Today's Marathon"
                                : isPollOnly
                                ? 'Share Your Vote'
                                : announcement?.title}
                        </h2>
                    </div>
                    <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors cursor-pointer">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto custom-scrollbar prose prose-invert prose-sm max-w-none flex-1 min-h-0 space-y-4">
                    {announcement && (
                        <div
                            className="announcement-content text-gray-300 space-y-4"
                            dangerouslySetInnerHTML={{ __html: announcement.content }}
                        />
                    )}
                    {activePoll && (
                        <ChatPollCard
                            pollId={activePoll.id}
                            currentUserId={currentUserId}
                            currentUserProfile={currentUserProfile}
                            compact
                        />
                    )}
                    {isMarathonOnly && marathonChallenge && (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-300 leading-relaxed">
                                {hasJoinedChallenge
                                    ? "You're already in today's Daily Marathon! Jump back in to climb the leaderboard before time runs out."
                                    : "Today's Daily Marathon is live! Join now, solve the challenge words, and compete for the top spot."}
                            </p>
                            <MarathonBanner
                                challenges={[marathonChallenge]}
                                onClick={(c) => {
                                    onPlayChallenge?.(c);
                                    onClose();
                                }}
                            />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/10 shrink-0 space-y-2.5">
                    {isMarathonOnly && marathonChallenge ? (
                        <>
                            <button
                                onClick={() => {
                                    onPlayChallenge?.(marathonChallenge);
                                    onClose();
                                }}
                                className="w-full bg-white text-black font-black py-4 rounded-xl hover:bg-gray-200 transition-colors uppercase tracking-tighter shadow-lg active:scale-[0.98] transform cursor-pointer"
                            >
                                {hasJoinedChallenge ? 'Continue Playing' : 'Join Daily Marathon'}
                            </button>
                            <button
                                onClick={onClose}
                                className="w-full bg-white/5 text-gray-300 font-bold py-3 rounded-xl hover:bg-white/10 transition-colors uppercase tracking-wider text-xs cursor-pointer"
                            >
                                Maybe Later
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={onClose}
                            className="w-full bg-white text-black font-black py-4 rounded-xl hover:bg-gray-200 transition-colors uppercase tracking-tighter shadow-lg active:scale-[0.98] transform cursor-pointer"
                        >
                            {isPollOnly ? 'Remind me tomorrow' : "I've read and understood"}
                        </button>
                    )}
                    <p className="text-center text-[10px] text-gray-500 mt-4 flex items-center justify-center gap-1 uppercase tracking-widest font-bold">
                        <Info size={12} />{' '}
                        {isMarathonOnly
                            ? 'Shown once per day when you have not visited Challenges recently'
                            : isPollOnly
                            ? 'Shown once per day until you vote'
                            : 'This will not be shown again'}
                    </p>
                </div>
            </div>
        </ModalLayout>
    );
};
