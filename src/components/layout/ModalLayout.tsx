import React from 'react';
import { X } from 'lucide-react';
import { useIsStandalone } from '../../hooks/useIsStandalone';
import { useApp } from '../../context/AppContext';

export interface ModalLayoutProps {
  isOpen?: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  title?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  showCloseButton?: boolean;
  className?: string;
  containerClassName?: string;
  zIndex?: string;
  variant?: 'fullscreen' | 'dialog';
}

const maxWidthMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  full: 'max-w-full',
};

export const ModalLayout: React.FC<ModalLayoutProps> = ({
  isOpen = true,
  onClose,
  children,
  title,
  maxWidth = 'lg',
  showCloseButton = true,
  className = '',
  containerClassName = '',
  zIndex = 'z-150',
  variant = 'fullscreen',
}) => {
  const isStandalone = useIsStandalone();
  const { isDynamicIslandVisible } = useApp();

  if (!isOpen) return null;

  if (variant === 'dialog') {
    return (
      <div
        className={`fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center ${zIndex} p-4 overflow-y-auto ${className}`}
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)',
          paddingBottom: isStandalone
            ? 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)'
            : 'calc(env(safe-area-inset-bottom, 0px) + 1.25rem)',
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget && onClose) {
            onClose();
          }
        }}
      >
        <div
          className={`bg-gray-900 border border-gray-800 w-full ${maxWidthMap[maxWidth]} rounded-2xl p-6 shadow-2xl text-center relative my-auto max-h-[85vh] overflow-y-auto scrollbar-hide flex flex-col ${containerClassName}`}
        >
          {onClose && showCloseButton && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/5 cursor-pointer z-10"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          )}

          {title && (
            <h2 className="text-xl uppercase font-black tracking-tighter text-white mb-4 shrink-0">
              {title}
            </h2>
          )}

          {children}
        </div>
      </div>
    );
  }

  // Full Screen layout (default): fills 100% viewport width and height cleanly without black borders or bottom side gaps
  return (
    <div
      className={`fixed inset-0 bg-gray-900 ${zIndex} flex flex-col w-full h-dvh min-h-dvh max-h-dvh overflow-hidden select-none ${className}`}
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)',
        paddingBottom: isStandalone
          ? 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)'
          : 'calc(env(safe-area-inset-bottom, 0px) + 1rem)',
      }}
    >
      <div
        className={`w-full ${maxWidthMap[maxWidth]} mx-auto flex flex-col flex-1 h-full min-h-0 relative overflow-y-auto px-4 py-4 sm:px-6 scrollbar-hide ${
          isDynamicIslandVisible ? 'pt-8 sm:pt-10' : ''
        } ${containerClassName}`}
      >
        {onClose && showCloseButton && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/5 cursor-pointer z-20"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        )}

        {title && (
          <h2 className="text-xl uppercase font-black tracking-tighter text-white mb-4 shrink-0 text-center">
            {title}
          </h2>
        )}

        {children}
      </div>
    </div>
  );
};

export default ModalLayout;