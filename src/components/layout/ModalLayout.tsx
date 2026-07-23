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
}) => {
  const isStandalone = useIsStandalone();
  const { isDynamicIslandVisible } = useApp();

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center ${zIndex} p-4 sm:p-6 overflow-y-auto ${isDynamicIslandVisible ? 'pt-12 sm:pt-14' : 'pt-4 sm:pt-6'
        } ${className}`}
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)',
        paddingBottom: isStandalone
          ? 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)'
          : 'calc(env(safe-area-inset-bottom, 0px) + 1.25rem)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          onClose();
        }
      }}
    >
      <div
        className={`bg-gray-900 border border-gray-800 w-full ${maxWidthMap[maxWidth]} rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-2xl text-center relative my-auto max-h-[88vh] sm:max-h-[90vh] overflow-y-auto scrollbar-hide flex flex-col ${containerClassName}`}
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
};

export default ModalLayout;