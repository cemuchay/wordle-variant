import React from 'react';
import { X, Bell, Info } from 'lucide-react';
import type { Announcement } from '../data/announcements';

interface Props {
  announcement: Announcement;
  isOpen: boolean;
  onClose: () => void;
}

export const AnnouncementModal: React.FC<Props> = ({ announcement, isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-150 p-4">
      <div className="bg-gray-900 border border-gray-700 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-200 h-[90vh]">

        {/* Header */}
        <div className="bg-primary/20 p-6 border-b border-gray-800 flex items-center gap-4">
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
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-2 max-h-[60vh] overflow-y-auto custom-scrollbar prose prose-invert prose-sm max-w-none">
          <div
            className="announcement-content"
            dangerouslySetInnerHTML={{ __html: announcement.content }}
          />
        </div>

        {/* Footer */}
        <div className="p-2 bg-gray-900/50 border-t border-gray-800">
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
    </div>
  );
};
