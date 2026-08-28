// src/utils/notifications.ts
import { safeLocalStorage } from './storage';

/**
 * Checks if desktop notifications are enabled in user settings/localStorage.
 */
export function areDesktopNotificationsEnabled(): boolean {
  const pref = safeLocalStorage.getItem('desktop_notifications_enabled');
  return pref !== 'false';
}

export function setDesktopNotificationsEnabled(enabled: boolean): void {
  safeLocalStorage.setItem('desktop_notifications_enabled', enabled ? 'true' : 'false');
}

/**
 * Requests browser notification permission if not yet decided.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  if (Notification.permission === 'default') {
    return await Notification.requestPermission();
  }
  return Notification.permission;
}

interface ShowDesktopNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  groupId?: string;
  onClick?: () => void;
}

/**
 * Triggers a native desktop/PC notification if the tab is inactive or hidden,
 * and the user has granted notification permission.
 */
export function showDesktopNotification({
  title,
  body,
  icon,
  tag,
  groupId,
  onClick,
}: ShowDesktopNotificationOptions): Notification | null {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return null;
  }

  // Only trigger desktop notification if permission granted and tab is NOT focused / hidden
  const isHidden = typeof document !== 'undefined' && (document.hidden || !document.hasFocus());
  if (!isHidden) {
    return null;
  }

  if (Notification.permission !== 'granted' || !areDesktopNotificationsEnabled()) {
    return null;
  }

  try {
    const notif = new Notification(title, {
      body,
      icon: icon || '/favicon.ico',
      tag: tag || (groupId ? `chat-msg-${groupId}` : undefined),
      silent: false,
    });

    notif.onclick = (e) => {
      e.preventDefault();
      window.focus();
      notif.close();
      if (onClick) {
        onClick();
      } else if (groupId) {
        window.dispatchEvent(
          new CustomEvent('open-chat-room', { detail: { groupId } })
        );
      }
    };

    return notif;
  } catch (err) {
    console.warn('Failed to display desktop notification:', err);
    return null;
  }
}
