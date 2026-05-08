import { Download } from "lucide-react";
import { usePWAInstall } from "../hooks/usePWAInstall";

const PWAInstallBanner = () => {
    const { showButton, isIOS, handleInstall, handleDontAskAgain, onClose } = usePWAInstall();

    if (!showButton) return null;

    return (
        <>{
            isIOS ? <IOSInstallPrompt onClose={onClose} /> : (<div className="fixed top-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-xs bg-gray-950/90 border border-white/10 p-3 rounded-2xl flex flex-col gap-3 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-100 backdrop-blur-xl animate-in fade-in slide-in-from-top-4 duration-300">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <div className="shrink-0 w-9 h-9 bg-linear-to-br from-correct to-emerald-500 rounded-xl flex items-center justify-center text-black shadow-[0_0_15px_rgba(0,255,0,0.2)]">
                        <Download size={18} strokeWidth={3} />
                    </div>
                    <div className="min-w-0">
                        <h4 className="text-[11px] font-black text-white uppercase tracking-tight leading-none mb-1">
                            Install App
                        </h4>
                        <p className="text-[9px] text-gray-500 font-bold uppercase leading-tight truncate">
                            Faster access & offline play
                        </p>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-2">
                    {/* Main Install Button */}
                    <button
                        onClick={handleInstall}
                        className="w-full bg-correct text-black py-2.5 rounded-lg font-black text-[10px] uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-lg"
                    >
                        Install Now
                    </button>

                    {/* Secondary Dismissal Buttons */}
                    <div className="flex gap-2">
                        <button
                            onClick={onClose} // Just hides for this session
                            className="flex-1 py-2 bg-white/5 text-gray-400 rounded-lg font-bold text-[9px] uppercase hover:text-white transition-colors border border-white/5"
                        >
                            Later
                        </button>
                        <button
                            onClick={handleDontAskAgain} // Sets localStorage "pwa_dismissed"
                            className="flex-1 py-2 bg-white/5 text-red-400 rounded-lg font-bold text-[9px] uppercase hover:text-red-400 transition-colors border border-white/5"
                        >
                            Never
                        </button>
                    </div>
                </div>
            </div>)
        }</>
    );
};

export default PWAInstallBanner

import { Share, PlusSquare, X } from 'lucide-react';

const IOSInstallPrompt = ({ onClose }: {  onClose: () => void }) => {

    return (
        <div className="fixed inset-0 z-100 flex items-end justify-center sm:items-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-gray-900 border border-white/10 rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10 duration-300">
                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-sm font-black uppercase tracking-tighter text-white">Install on iOS (Safari)</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-6">
                    <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10 text-gray-300">
                            1
                        </div>
                        <p className="text-xs text-gray-300 font-medium">
                            Tap the <span className="inline-flex items-center bg-white/10 p-1 rounded mx-1"><Share size={14} className="text-blue-400" /></span> <strong>Share</strong> button in the menu bar.
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10 text-gray-300">
                            2
                        </div>
                        <p className="text-xs text-gray-300 font-medium">
                            Scroll down and tap <span className="inline-flex items-center bg-white/10 px-2 py-1 rounded mx-1 text-[10px] font-bold">Add to Home Screen <PlusSquare size={12} className="ml-1" /></span>
                        </p>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className="w-full mt-8 bg-correct text-black py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-transform"
                >
                    Got it
                </button>
            </div>
        </div>
    );
};