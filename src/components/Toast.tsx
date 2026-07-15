import React, { useEffect, useMemo } from 'react';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Z_INDEX, ANIMATION_DURATION } from '../constants/ui';

interface ToastProps {
  message: string;
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ message, isVisible, onClose, duration = 3000 }) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, isVisible, onClose]);

  const style = useMemo(() => {
    const lower = message.toLowerCase();

    // Alert / Error keywords
    if (
      lower.includes('failed') ||
      lower.includes('error') ||
      lower.includes('invalid') ||
      lower.includes('rejected') ||
      lower.includes('busy') ||
      lower.includes('no answer') ||
      lower.includes('expired') ||
      lower.includes('deleted') ||
      lower.includes('ended') ||
      lower.includes('declined')
    ) {
      return {
        icon: <AlertCircle className="w-4 h-4 text-red-500" />,
        borderColor: 'border-red-500/25',
        glowColor: 'shadow-red-500/10',
        label: 'ALERT'
      };
    }

    // Success keywords
    if (
      lower.includes('success') ||
      lower.includes('completed') ||
      lower.includes('accepted') ||
      lower.includes('won') ||
      lower.includes('connect') ||
      lower.includes('sync') ||
      lower.includes('added')
    ) {
      return {
        icon: <CheckCircle2 className="w-4 h-4 text-correct" />,
        borderColor: 'border-correct/25',
        glowColor: 'shadow-correct/10',
        label: 'SUCCESS'
      };
    }

    // Default Info notice
    return {
      icon: <Info className="w-4 h-4 text-blue-400" />,
      borderColor: 'border-white/10',
      glowColor: 'shadow-black/40',
      label: 'INFO'
    };
  }, [message]);

  return (
    <AnimatePresence>
      {isVisible && (
        <div
          className="fixed top-16 sm:top-20 left-1/2 -translate-x-1/2 w-full max-w-sm px-4 flex justify-center pointer-events-none"
          style={{ zIndex: Z_INDEX.TOAST }}
        >
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: ANIMATION_DURATION.FAST / 1000 }}
            className={`
              w-full pointer-events-auto bg-gray-950/85 backdrop-blur-md border ${style.borderColor} 
              p-3.5 rounded-2xl shadow-2xl ${style.glowColor} flex items-start gap-3.5 relative overflow-hidden
            `}
          >
            {/* Left Accent indicator line */}
            <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${style.label === 'ALERT' ? 'bg-red-500' : style.label === 'SUCCESS' ? 'bg-correct' : 'bg-blue-500'
              }`} />

            {/* Icon Group */}
            <div className="flex items-center justify-center p-1.5 bg-white/5 rounded-xl shrink-0">
              {style.icon}
            </div>

            {/* Content Group */}
            <div className="flex-1 min-w-0">

              <p className="text-[11px] text-gray-200 font-extrabold uppercase tracking-wider leading-relaxed">
                {message}
              </p>
            </div>

            {/* Close action */}
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors shrink-0 self-center cursor-pointer"
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};