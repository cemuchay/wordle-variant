import React, { useEffect } from 'react';

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
      bg-white text-black px-6 py-3 rounded-xl shadow-2xl 
      font-bold text-sm uppercase tracking-wide 
      text-center border border-gray-200
      /* Use standard v4 transform for entrance if not using an animation plugin */
      animate-bounce-subtle
    `}>
        {message}
      </div>
    </div>
  );
};