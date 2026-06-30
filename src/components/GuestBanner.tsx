import { AlertTriangle, X } from 'lucide-react';

interface GuestBannerProps {
  onSignIn: () => void;
  onDismiss: () => void;
}

export const GuestBanner = ({ onSignIn, onDismiss }: GuestBannerProps) => {
  return (
    <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top duration-300">
      <div className="flex items-center gap-2 bg-amber-950/90 backdrop-blur-md border border-amber-500/30 pl-3 pr-1.5 py-1.5 rounded-2xl shadow-xl max-w-sm">
        <AlertTriangle size={13} className="text-amber-400 shrink-0" />
        <p className="text-[9px] sm:text-[10px] font-bold tracking-wide text-amber-200 leading-tight">
          Playing without an account? Sign in to sync scores &amp; compete.
        </p>
        <button
          onClick={onSignIn}
          className="bg-amber-500 hover:bg-amber-600 text-black px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider transition-colors shrink-0 cursor-pointer"
        >
          Sign In
        </button>
        <button
          onClick={onDismiss}
          className="text-gray-500 hover:text-gray-300 transition-colors shrink-0 p-1 cursor-pointer"
          aria-label="Dismiss"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
};
