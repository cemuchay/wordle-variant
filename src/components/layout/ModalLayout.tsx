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
  isOverlay?: boolean;
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
  maxWidth = 'xl',
  showCloseButton = true,
  className = '',
  containerClassName = '',
  zIndex = 'z-150',
  isOverlay = true,
}) => {
  const isStandalone = useIsStandalone();
  const { isDynamicIslandVisible } = useApp();

  if (!isOpen) return null;

  return (
    <div
      className={`${
        isOverlay
          ? `fixed inset-0 ${zIndex} bg-gray-900`
          : 'relative flex-1 h-full min-h-0'
      } flex flex-col w-full h-full min-h-0 overflow-hidden select-none bg-gray-900 ${className}`}
      style={{
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        paddingTop: isOverlay
          ? 'calc(env(safe-area-inset-top, 0px) + 0.5rem)'
          : undefined,
        paddingBottom: isOverlay
          ? isStandalone
            ? 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)'
            : 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)'
          : undefined,
      }}
    >
      <div
        className={`w-full ${maxWidthMap[maxWidth]} mx-auto flex flex-col flex-1 h-full min-h-0 relative overflow-hidden px-3 py-3 ${
          isDynamicIslandVisible && isOverlay ? 'pt-6 sm:pt-8' : ''
        } ${containerClassName}`}
      >
        <div className="flex items-center justify-between mb-3 shrink-0 px-2 relative">
          {title ? (
            <h2 className="text-xl uppercase tracking-tighter text-gray-100 flex-1 text-center font-black">
              {title}
            </h2>
          ) : (
            <div className="flex-1" />
          )}
          {onClose && showCloseButton && (
            <button
              onClick={onClose}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white hover:bg-white/5 p-1 rounded-full transition-colors cursor-pointer z-20"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          )}
        </div>

        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto scrollbar-hide">
          {children}
        </div>
      </div>
    </div>
  );
};

export default ModalLayout;