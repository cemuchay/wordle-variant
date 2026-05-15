import { BarChart2, HelpCircle, Lightbulb, RotateCcw, Share, Trophy } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface GameToolbarProps {
    onOpenChallenge: () => void;
    onOpenStats: () => void;
    onOpenInfo: () => void;
    onHint: () => void;
    onReset: () => void;
    onShare: () => void;
    isGameOver: boolean;
    usedHint: boolean;
    canShowHint: boolean;
}

const ICON_SIZE = 16;

export const GameToolbar = ({
    onOpenChallenge,
    onOpenStats,
    onOpenInfo,
    onHint,
    onReset,
    onShare,
    isGameOver,
    usedHint,
    canShowHint
}: GameToolbarProps) => {
    const { challengeUnreadCount } = useApp();

    return (
        <div className="w-full max-w-lg mx-auto mb-4">
            <div className="flex items-center justify-between bg-white/5 p-2 rounded-2xl border border-white/10">
                <div className="flex items-center gap-1">
                    <button
                        onClick={onOpenChallenge}
                        className="p-2 text-gray-400 hover:bg-white/5 hover:text-white rounded-xl transition-all relative"
                        title="Challenges"
                    >
                        <Trophy size={ICON_SIZE} />
                        {challengeUnreadCount > 0 && (
                            <span className="absolute top-0.5 right-0.5 bg-correct text-black text-[8px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center border border-black shadow-sm">
                                {challengeUnreadCount}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={onOpenStats}
                        className="p-2 text-gray-400 hover:bg-white/5 hover:text-white rounded-xl transition-all"
                        title="Statistics"
                    >
                        <BarChart2 size={ICON_SIZE} />
                    </button>
                    <button
                        onClick={onOpenInfo}
                        className="p-2 text-gray-400 hover:bg-white/5 hover:text-white rounded-xl transition-all"
                        title="How to play"
                    >
                        <HelpCircle size={ICON_SIZE} />
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 border-l border-white/10 pl-2 ml-1">
                        {canShowHint && !isGameOver && (
                            <button
                                onClick={onHint}
                                className={`p-2 transition-all rounded-xl ${usedHint ? 'text-yellow-500/30' : 'text-yellow-500 bg-yellow-500/10 animate-pulse'}`}
                                title={usedHint ? "Hint Used" : "Get Hint"}
                            >
                                <Lightbulb size={ICON_SIZE} />
                            </button>
                        )}
                        <button
                            onClick={onReset}
                            className="p-2 text-gray-500 hover:text-white rounded-xl hover:bg-white/5 transition-all active:rotate-180 duration-500"
                            title="Reset"
                        >
                            <RotateCcw size={ICON_SIZE} />
                        </button>
                        {isGameOver && (
                            <button
                                onClick={onShare}
                                className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/5 transition-all"
                            >
                                <Share size={ICON_SIZE} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
