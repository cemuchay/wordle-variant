import { useState, useEffect } from "react";
import { safeLocalStorage, safeSessionStorage } from "../utils/storage";

export interface BeforeInstallPromptEvent extends Event {
   readonly platforms: string[];
   readonly userChoice: Promise<{
      outcome: "accepted" | "dismissed";
      platform: string;
   }>;
   prompt(): Promise<void>;
}

export function usePWAInstall() {
   const [deferredPrompt, setDeferredPrompt] =
      useState<BeforeInstallPromptEvent | null>(null);
   const [isIOS, setIsIOS] = useState(false);
   const [isStandalone, setIsStandalone] = useState(false);
   const [isDismissed, setIsDismissed] = useState(false);

   const [isInstalling, setIsInstalling] = useState(false);

   useEffect(() => {
      // 1. Check if running in standalone mode (already installed & opened as PWA)
      const checkStandalone =
         window.matchMedia("(display-mode: standalone)").matches ||
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         (window.navigator as any).standalone === true;

      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsStandalone(checkStandalone);

      // 2. Check iOS
      const checkIOS =
         /iPad|iPhone|iPod/.test(navigator.userAgent) &&
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         !(window as any).MSStream;
      setIsIOS(checkIOS);

      // 3. Check dismissal
      const dismissCount = Number(
         safeLocalStorage.getItem("pwa_install_dismiss_count") || 0,
      );
      const sessionDismissed =
         safeSessionStorage.getItem("pwa_install_session_dismissed") === "true";
      setIsDismissed(dismissCount >= 2 || sessionDismissed);

      // 4. Listen for beforeinstallprompt (Android/Chrome/Edge/etc.)
      const handleBeforeInstallPrompt = (e: Event) => {
         e.preventDefault();
         setDeferredPrompt(e as BeforeInstallPromptEvent);
      };

      // 5. Track native app installation finished
      const handleAppInstalled = () => {
         setIsInstalling(false);
      };

      // 6. Track background Service Worker installation state
      if ("serviceWorker" in navigator) {
         navigator.serviceWorker.getRegistration().then((reg) => {
            if (reg?.installing) {
               setIsInstalling(true);
               // eslint-disable-next-line @typescript-eslint/no-explicit-any
               reg.installing.addEventListener("statechange", (e: any) => {
                  if (e.target.state === "activated") {
                     setIsInstalling(false);
                  }
               });
            }
         });
      }

      window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.addEventListener("appinstalled", handleAppInstalled);

      return () => {
         window.removeEventListener(
            "beforeinstallprompt",
            handleBeforeInstallPrompt,
         );
         window.removeEventListener("appinstalled", handleAppInstalled);
      };
   }, []);

   const handleInstall = async () => {
      if (!deferredPrompt) return;
      setIsInstalling(true);
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
         setDeferredPrompt(null);
      } else {
         setIsInstalling(false);
      }
   };

   const handleDismiss = () => {
      const nextCount =
         Number(safeLocalStorage.getItem("pwa_install_dismiss_count") || 0) + 1;
      safeLocalStorage.setItem("pwa_install_dismiss_count", String(nextCount));
      safeSessionStorage.setItem("pwa_install_session_dismissed", "true");
      setIsDismissed(true);
   };

   const showBanner =
      !isStandalone && !isDismissed && (deferredPrompt !== null || isIOS);

   return {
      showBanner,
      isIOS,
      isStandalone,
      isInstalling,
      handleInstall,
      handleDismiss,
   };
}
