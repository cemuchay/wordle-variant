/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';

export function usePWAInstall() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isIOSDevice, setIsIOSDevice] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // 1. Check if user previously declined
    const dismissed = localStorage.getItem('pwa_dismissed') === 'true';
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDismissed(dismissed);

    // 2. Detect iOS
    const isIOS =
      ['iPad Simulator', 'iPhone Simulator', 'iPod Simulator', 'iPad', 'iPhone', 'iPod'].includes(navigator.platform) ||
      (navigator.userAgent.includes("Mac") && "ontouchend" in document);
    setIsIOSDevice(isIOS);

    // 3. Check if already installed
    const installed = (window.navigator as any).standalone || window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(installed);

    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  const handleDontAskAgain = () => {
    localStorage.setItem('pwa_dismissed', 'true');
    setIsDismissed(true);
  };

  const onClose = () => {
    // We use a temporary session-based dismissal here
    // If you want it to show up again on refresh, don't use localStorage
    setIsDismissed(true);
  };

  return {
    // Show button if: Not dismissed AND (we have a prompt OR it's an uninstalled iOS device)
    showButton: !isDismissed && !isStandalone && (!!installPrompt || isIOSDevice),
    isIOS: isIOSDevice,
    handleInstall,
    handleDontAskAgain,
    onClose,
  };
}