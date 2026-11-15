import React from 'react';
import { X, Bell, Info, BarChart3 } from 'lucide-react';
import type { Announcement } from '../data/announcements';
import type { Poll } from '../types/poll';
import { ModalLayout } from './layout/ModalLayout';
import { ChatPollCard } from './chat/poll/ChatPollCard';

interface AnnouncementModalProps {
    isOpen: boolean;
    onClose: () => void;
    announcement: Announcement | null;
    activePoll?: Poll | null;
    currentUserId?: string;
    currentUserProfile?: { id: string; username: string; avatar_url: string };
}

export const AnnouncementModal: React.FC<AnnouncementModalProps> = ({
    isOpen,
    onClose,
    announcement,
    activePoll,
    currentUserId,
    currentUserProfile,
}) => {
    if (!isOpen || (!announcement && !activePoll)) return null;

    const isPollOnly = !announcement && Boolean(activePoll);

    return (
        <ModalLayout isOpen={isOpen} onClose={onClose} maxWidth="full" showCloseButton={false} containerClassName="p-0!">
            <div className="flex flex-col h-full min-h-0 w-full max-w-lg mx-auto">
                {/* Header */}
                <div className="bg-primary/20 p-6 border-b border-white/10 flex items-center gap-4 shrink-0 relative">
                    <div className="bg-primary/20 p-3 rounded-xl text-primary">
                        {isPollOnly ? <BarChart3 size={24} /> : <Bell size={24} />}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">
                                {isPollOnly ? 'Community Poll' : announcement?.type}
                            </span>
                            {!isPollOnly && announcement?.date && (
                                <span className="text-[10px] text-gray-500 font-mono italic">
                                    {announcement.date}
                                </span>
                            )}
                        </div>
                        <h2 className="text-xl font-black text-gray-100 uppercase tracking-tighter leading-tight mt-1">
                            {isPollOnly ? 'Share Your Vote' : announcement?.title}
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
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/10 shrink-0">
                    <button
                        onClick={onClose}
                        className="w-full bg-white text-black font-black py-4 rounded-xl hover:bg-gray-200 transition-colors uppercase tracking-tighter shadow-lg active:scale-[0.98] transform cursor-pointer"
                    >
                        {isPollOnly ? 'Remind me tomorrow' : "I've read and understood"}
                    </button>
                    <p className="text-center text-[10px] text-gray-500 mt-4 flex items-center justify-center gap-1 uppercase tracking-widest font-bold">
                        <Info size={12} /> {isPollOnly ? 'Shown once per day until you vote' : 'This will not be shown again'}
                    </p>
                </div>
            </div>
        </ModalLayout>
    );
};
