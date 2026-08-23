import React from 'react';
import { X, Bell, Info } from 'lucide-react';
import type { Announcement } from '../data/announcements';
import { ModalLayout } from './layout/ModalLayout';

interface Props {
  announcement: Announcement;
  isOpen: boolean;
  onClose: () => void;
}

export const AnnouncementModal: React.FC<Props> = ({ announcement, isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <ModalLayout isOpen onClose={onClose} maxWidth="lg" showCloseButton={false} containerClassName="p-0!">
      <div className="flex flex-col h-full min-h-0 w-full">

        {/* Header */}
        <div className="bg-primary/20 p-6 border-b border-white/10 flex items-center gap-4 shrink-0">
          <div className="bg-primary/20 p-3 rounded-xl text-primary">
            <Bell size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">
                {announcement.type}
              </span>
              <span className="text-[10px] text-gray-500 font-mono italic">
                {announcement.date}
              </span>
            </div>
            <h2 className="text-xl font-black text-gray-100 uppercase tracking-tighter leading-tight mt-1">
              {announcement.title}
            </h2>
          </div>
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar prose prose-invert prose-sm max-w-none flex-1 min-h-0">
          <div
            className="announcement-content text-gray-300 space-y-4"
            dangerouslySetInnerHTML={{ __html: announcement.content }}
          />
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 shrink-0">
          <button
            onClick={onClose}
            className="w-full bg-white text-black font-black py-4 rounded-xl hover:bg-gray-200 transition-colors uppercase tracking-tighter shadow-lg active:scale-[0.98] transform"
          >
            I've read and understood
          </button>
          <p className="text-center text-[10px] text-gray-500 mt-4 flex items-center justify-center gap-1 uppercase tracking-widest font-bold">
            <Info size={12} /> This will not be shown again
          </p>
        </div>
      </div>
    </ModalLayout>
  );
};
