import { useState } from 'react';
import { ExternalLink, RefreshCw, Sparkles, X } from 'lucide-react';
import { ModalLayout } from '../layout/ModalLayout';
import { ConfirmationModal } from '../ConfirmationModal';

export interface ExternalGameEmbedProps {
    title: string;
    url: string;
    badge?: string;
    gradientClass?: string;
    onBack: () => void;
    allowPermissions?: string;
}

export const ExternalGameEmbed = ({
    title,
    url,
    badge = 'Standalone',
    gradientClass = 'from-pink-400 via-amber-300 to-cyan-300',
    onBack,
    allowPermissions = 'autoplay; fullscreen; clipboard-write; clipboard-read'
}: ExternalGameEmbedProps) => {
    const [isLoading, setIsLoading] = useState(true);
    const [iframeKey, setIframeKey] = useState(0);
    const [isExitConfirmOpen, setIsExitConfirmOpen] = useState(false);

    const handleConfirmExit = () => {
        window.open(url, '_blank', 'noopener,noreferrer');
        setIsExitConfirmOpen(false);
    };

    return (
        <>
            <ModalLayout
                isOpen={true}
                onClose={onBack}
                maxWidth="full"
                zIndex="z-[200]"
                showCloseButton={false}
                className="!p-0"
                containerClassName="!bg-slate-950"
            >
                {/* Top Controls Bar */}
                <div className="w-full flex items-center justify-between px-3 py-2 bg-slate-900/95 border-b border-white/10 shrink-0 backdrop-blur-md z-10">
                    {/* Left: Close / Back Button */}
                    <button
                        onClick={onBack}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-xs font-bold text-slate-200 hover:text-white transition-all cursor-pointer border border-white/10 active:scale-95"
                        aria-label="Close and return to More Games"
                    >
                        <X size={16} />
                        <span className="hidden sm:inline">Close</span>
                    </button>

                    {/* Center: Title & Badge */}
                    <div className="flex items-center gap-2">
                        <span className={`text-sm sm:text-base font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r ${gradientClass}`}>
                            {title}
                        </span>
                        {badge && (
                            <span className="px-1.5 py-0.5 rounded-md bg-white/10 border border-white/10 text-slate-200 text-[10px] font-bold flex items-center gap-1">
                                <Sparkles size={10} className="text-amber-300" /> {badge}
                            </span>
                        )}
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                setIsLoading(true);
                                setIframeKey((k) => k + 1);
                            }}
                            title="Reload game"
                            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-slate-300 hover:text-white transition-all cursor-pointer active:scale-95"
                        >
                            <RefreshCw size={14} />
                        </button>

                        <button
                            onClick={() => setIsExitConfirmOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-pink-500 to-cyan-500 hover:opacity-90 text-xs font-black text-white shadow-md transition-all active:scale-95 cursor-pointer"
                        >
                            <span>Play Full Game</span>
                            <ExternalLink size={12} />
                        </button>
                    </div>
                </div>

                {/* Embedded Iframe Container */}
                <div className="w-full flex-1 min-h-0 relative bg-slate-950 overflow-hidden scrollbar-hide">
                    {isLoading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-xs z-20 space-y-3">
                            <div className="w-9 h-9 border-3 border-pink-500/30 border-t-pink-500 rounded-full animate-spin" />
                            <p className="text-xs font-bold text-slate-300 animate-pulse">Loading {title}...</p>
                        </div>
                    )}

                    <iframe
                        key={iframeKey}
                        src={url}
                        title={title}
                        className="w-full h-full border-0 block overflow-hidden scrollbar-hide"
                        allow={allowPermissions}
                        onLoad={() => setIsLoading(false)}
                    />
                </div>
            </ModalLayout>

            {/* Confirmation Modal when exiting Variant */}
            <ConfirmationModal
                isOpen={isExitConfirmOpen}
                onClose={() => setIsExitConfirmOpen(false)}
                onConfirm={handleConfirmExit}
                title="Exit Variant?"
                message={`You are about to open ${title} in a new browser tab. Do you want to proceed to the full standalone game?`}
                confirmLabel="Open Game"
                cancelLabel="Stay in Variant"
                type="info"
            />
        </>
    );
};

export default ExternalGameEmbed;
