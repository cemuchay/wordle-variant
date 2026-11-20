import { useEffect, useState } from "react";

const DEFAULT_BACKGROUND_GRACE_MS = 45_000;

/**
 * Returns `true` while the browser tab is visible (and for a short grace period
 * after being backgrounded so quick tab switches don't churn subscriptions).
 * Once hidden longer than `graceMs`, returns `false` so Realtime `postgres_changes`
 * hooks can unsubscribe until the user brings the tab back to the foreground.
 */
export function useIsTabVisible(graceMs = DEFAULT_BACKGROUND_GRACE_MS): boolean {
   const [isVisible, setIsVisible] = useState<boolean>(() => {
      if (typeof document === "undefined") return true;
      return document.visibilityState !== "hidden";
   });

   useEffect(() => {
      if (typeof document === "undefined") return;
      let hideTimer: ReturnType<typeof setTimeout> | null = null;

      const clearTimer = () => {
         if (hideTimer !== null) {
            clearTimeout(hideTimer);
            hideTimer = null;
         }
      };

      const handleVisible = () => {
         clearTimer();
         setIsVisible(true);
      };

      const handleVisibilityChange = () => {
         if (document.visibilityState === "hidden") {
            clearTimer();
            hideTimer = setTimeout(() => {
               setIsVisible(false);
            }, graceMs);
         } else {
            handleVisible();
         }
      };

      document.addEventListener("visibilitychange", handleVisibilityChange);
      window.addEventListener("focus", handleVisible);

      return () => {
         clearTimer();
         document.removeEventListener("visibilitychange", handleVisibilityChange);
         window.removeEventListener("focus", handleVisible);
      };
   }, [graceMs]);

   return isVisible;
}
