import React from 'react';
import { X } from 'lucide-react';

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
  if (!isOpen) return null;

  const isFullScreen = maxWidth === 'full';

  if (isFullScreen) {
    return (
      <div
        className={`${
          isOverlay
            ? `fixed inset-0 ${zIndex} bg-background`
            : 'relative flex-1 bg-background'
        } w-full h-dvh min-h-dvh max-h-dvh flex flex-col flex-1 overflow-hidden select-none text-white ${className}`}
        style={{
          paddingTop: isOverlay ? 'env(safe-area-inset-top, 0px)' : undefined,
          paddingBottom: isOverlay ? 'env(safe-area-inset-bottom, 0px)' : undefined,
          paddingLeft: isOverlay ? 'env(safe-area-inset-left, 0px)' : undefined,
          paddingRight: isOverlay ? 'env(safe-area-inset-right, 0px)' : undefined,
        }}
      >
        <div className={`flex flex-col flex-1 h-full w-full min-h-0 relative overflow-hidden bg-background ${containerClassName}`}>
          {(title || (onClose && showCloseButton)) && (
            <div className="flex items-center justify-between p-3 border-b border-white/10 shrink-0 relative bg-slate-900/90 backdrop-blur-md">
              {title ? (
                <h2 className="text-base sm:text-lg uppercase tracking-wider text-gray-100 flex-1 text-center font-black">
                  {title}
                </h2>
              ) : (
                <div className="flex-1" />
              )}
              {onClose && showCloseButton && (
                <button
                  onClick={onClose}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-colors cursor-pointer z-20"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              )}
            </div>
          )}

          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto scrollbar-hide">
            {children}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${
        isOverlay
          ? `fixed inset-0 ${zIndex} bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200`
          : 'relative flex-1'
      } w-full h-full min-h-0 overflow-hidden select-none text-white ${className}`}
    >
      <div
        className={`w-full ${maxWidthMap[maxWidth]} flex flex-col max-h-[90dvh] min-h-0 relative overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-4 sm:p-5 ${containerClassName}`}
      >
        {(title || (onClose && showCloseButton)) && (
          <div className="flex items-center justify-between mb-3 shrink-0 px-1 relative">
            {title ? (
              <h2 className="text-lg sm:text-xl uppercase tracking-wider text-gray-100 flex-1 text-center font-black">
                {title}
              </h2>
            ) : (
              <div className="flex-1" />
            )}
            {onClose && showCloseButton && (
              <button
                onClick={onClose}
                className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-colors cursor-pointer z-20"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            )}
          </div>
        )}

        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto scrollbar-hide">
          {children}
        </div>
      </div>
    </div>
  );
};

export default ModalLayout;