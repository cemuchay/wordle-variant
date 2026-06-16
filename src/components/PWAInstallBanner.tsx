import { usePWAInstall } from '../hooks/usePWAInstall';
import { useState } from 'react';

export default function PWAInstallBanner() {
  const { showBanner, isIOS, handleInstall, handleDismiss } = usePWAInstall();
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="bg-slate-900 border border-slate-800/80 rounded-2xl shadow-2xl shadow-black/50 p-4 md:p-5 backdrop-blur-xl relative overflow-hidden">
        {/* Decorative subtle background gradient glow */}
        <div className="absolute -top-12 -right-12 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-start gap-4">
          {/* App Icon Preview */}
          <div className="w-12 h-12 rounded-xl bg-slate-950 flex items-center justify-center shrink-0 border border-slate-800 shadow-inner">
            <img
              src="/pwa_192x192.png"
              alt="App Icon"
              className="w-10 h-10 rounded-lg object-contain"
              onError={(e) => {
                // Fallback icon placeholder if not loaded
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>

          {/* Text Content */}
          <div className="flex-1 min-w-0 pr-6">
            <h4 className="text-sm font-bold text-white tracking-wide">
              Install Variant
            </h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Add Variant to your home screen for quick, fullscreen word challenges.
            </p>
          </div>

          {/* Close/Dismiss Button */}
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 text-slate-500 hover:text-slate-300 transition-colors p-1 rounded-lg hover:bg-slate-800/50"
            aria-label="Dismiss banner"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Action Button & Instructions */}
        <div className="mt-4 flex flex-col gap-2.5">
          {!isIOS ? (
            <button
              onClick={handleInstall}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] rounded-xl shadow-lg shadow-indigo-600/20 transition-all duration-200"
            >
              Install App
            </button>
          ) : (
            <>
              {!showIOSInstructions ? (
                <button
                  onClick={() => setShowIOSInstructions(true)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] rounded-xl shadow-lg shadow-indigo-600/20 transition-all duration-200"
                >
                  How to Install on iOS
                </button>
              ) : (
                <div className="mt-2 text-xs bg-slate-950/60 border border-slate-800/40 rounded-xl p-3 text-slate-300 space-y-2 animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex items-center gap-2 font-semibold text-white border-b border-slate-800/50 pb-1.5 mb-1.5">
                    <span>iOS Safari Instructions</span>
                  </div>
                  <ol className="list-decimal pl-4 space-y-1.5 text-slate-400">
                    <li>
                      Tap the <span className="inline-flex align-middle bg-slate-800 p-1 rounded text-white"><ShareIcon /></span> share button at the bottom of Safari.
                    </li>
                    <li>
                      Scroll down and select <span className="font-semibold text-white">"Add to Home Screen"</span>.
                    </li>
                    <li>
                      Tap <span className="font-semibold text-indigo-400">"Add"</span> in the top right corner.
                    </li>
                  </ol>
                  <button
                    onClick={() => setShowIOSInstructions(false)}
                    className="w-full mt-2 text-center text-[10px] text-slate-500 hover:text-slate-400 underline transition-colors"
                  >
                    Hide instructions
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Minimalist Share Icon representing iOS Safari share sheet button
function ShareIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}
