import { useState, useEffect } from 'react';
import { subscribeToPush } from '../lib/pushService';

export const NotificationToggle = () => {
  const [permission, setPermission] = useState<NotificationPermission | 'loading'>('loading');

  useEffect(() => {
    if ('Notification' in window) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPermission(Notification.permission);
    }
  }, []);

  const handleEnable = async () => {
    try {
      const sub = await subscribeToPush();
      if (sub) {
        setPermission('granted')
        window.alert(`Notification enabled`)
      };
    } catch (err) {
      console.error("Permission error:", err);
      setPermission(Notification.permission);
    }
  };

  if (permission === 'granted' || permission === 'loading' || !('Notification' in window)) {
    return null;
  }

  return (
    <div className="flex justify-center w-full my-2">
      {permission === 'denied' ? (
        <div className="flex flex-col items-center gap-2 p-4 border border-red-200 rounded-lg bg-red-50 text-center max-w-sm">
          <div className="flex items-center gap-2 text-red-700 font-semibold">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            Notifications Blocked
          </div>
          <p className="text-xs text-red-600">
            Please click the <strong>lock icon</strong> in your browser address bar and set Notifications to <strong>"Allow"</strong> to receive updates.
          </p>
        </div>
      ) : (
        <button
          onClick={handleEnable}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-all active:scale-95 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          <BellIcon />
          Enable Notifications
        </button>
      )}
    </div>
  );
};

const BellIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
    <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
  </svg>
);