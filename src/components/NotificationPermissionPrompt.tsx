import { useState, useEffect } from 'react';
import { subscribeToPush } from '../lib/pushService';

export default function NotificationPermissionPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check if running in standalone mode (PWA is installed and opened)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.navigator as any).standalone === true;

    // Check if notifications are supported and not allowed yet
    const notificationsSupported = 'Notification' in window;
    const notGranted = notificationsSupported && Notification.permission !== 'granted';

    // Check dismissal state
    const dismissed = localStorage.getItem('pwa_notification_prompt_dismissed') === 'true';
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDismissed(dismissed);

    if ((isStandalone || import.meta.env.DEV) && notGranted && !dismissed) {
      setShowPrompt(true);
    }
  }, []);

  const handleEnable = async () => {
    try {
      const sub = await subscribeToPush();
      if (sub) {
        setShowPrompt(false);
      }
    } catch (err) {
      console.error("Failed to enable push notifications:", err);
      // Even if permission request fails or is denied, close the prompt
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('pwa_notification_prompt_dismissed', 'true');
    setIsDismissed(true);
    setShowPrompt(false);
  };

  if (!showPrompt || isDismissed) return null;

  return (
    <div className="fixed top-16 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-[9999] animate-in fade-in slide-in-from-top-5 duration-300">
      <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl shadow-2xl shadow-indigo-500/10 p-4 md:p-5 backdrop-blur-xl relative overflow-hidden">
        {/* Glowing gradient border line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-linear-to-r from-indigo-500 via-purple-500 to-indigo-500" />

        <div className="flex items-start gap-4">
          {/* Bell Icon Visual */}
          <div className="w-12 h-12 rounded-xl bg-indigo-950 flex items-center justify-center shrink-0 border border-indigo-500/20 shadow-inner text-indigo-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>

          {/* Text Content */}
          <div className="flex-1 min-w-0 pr-6">
            <h4 className="text-sm font-bold text-white tracking-wide">
              Enable Notifications
            </h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              {Notification.permission === 'denied'
                ? 'Notifications are currently blocked. Please open browser/app settings and allow notifications to receive game updates.'
                : 'Get live updates for challenges, chat messages, and leaderboard results directly on your home screen.'}
            </p>
          </div>

          {/* Close/Dismiss Button */}
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 text-slate-500 hover:text-slate-300 transition-colors p-1 rounded-lg hover:bg-slate-800/50"
            aria-label="Dismiss prompt"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Action Button */}
        <div className="mt-4">
          {Notification.permission === 'denied' ? (
            <button
              onClick={handleDismiss}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 active:scale-[0.98] rounded-xl transition-all duration-200"
            >
              Okay, I'll update settings
            </button>
          ) : (
            <button
              onClick={handleEnable}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] rounded-xl shadow-lg shadow-indigo-600/20 transition-all duration-200"
            >
              Allow Notifications
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
