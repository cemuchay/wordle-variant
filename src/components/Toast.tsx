import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ToastProps {
  message: string;
  isVisible: boolean;
  onClose: () => void;
  duration?: number
}

export const Toast: React.FC<ToastProps> = ({ message, isVisible, onClose, duration = 3000 }) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-100 w-full max-w-fit px-4 transition-all duration-300 ease-out">
      <div className={`
        bg-white text-black pl-6 pr-4 py-3 rounded-xl shadow-2xl 
        font-bold text-sm uppercase tracking-wide 
        border border-gray-200 animate-bounce-subtle
        flex items-center gap-4 justify-between min-w-[200px]
      `}>
        <span className="whitespace-nowrap">{message}</span>
        <button 
          onClick={onClose}
          className="text-black/50 hover:text-black p-0.5 rounded-full hover:bg-black/5 transition-colors shrink-0"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};