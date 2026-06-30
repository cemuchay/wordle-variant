import { HelpCircle, Lightbulb, RotateCcw, SettingsIcon, Share } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../hooks/useAuth';
import { useConfirmation } from '../../hooks/useConfirmation';
import type { SyncStatus } from '../../types/game';
import { ProtectedAvatar } from '../chat/ProtectedAvatar';
import { NotificationBell } from '../notifications/NotificationBell';
import { CloudSyncMenu } from '../SyncCloudModal';
import formatUsername from '../../utils/formatUsername';

interface AppHeaderProps {
    onOpenSettings: () => void;
    onOpenSearch?: () => void;
    onOpenInfo?: () => void;
    onOpenWeeklyWrapped?: () => void;
    onHint: () => void;
    onReset: () => void;
    onShare: () => void;
    onRetrySync: () => void;
    isGameOver: boolean;
    isRevealing?: boolean;
    usedHint: boolean;
    canShowHint: boolean;
    isHintLocked?: boolean;
    syncStatus: SyncStatus;
    isMonday?: boolean;
    hideGameplayActions?: boolean;
}

const ICON_SIZE = 20;

export const AppHeader = ({
    onOpenSettings,
    onOpenInfo,
    onOpenWeeklyWrapped,
    onHint,
    onReset,
    onShare,
    onRetrySync,
    isGameOver,
    isRevealing,
    usedHint,
    canShowHint,
    isHintLocked,
    syncStatus,
    isMonday = false,
    hideGameplayActions = false
}: AppHeaderProps) => {
    const { user, signOut } = useAuth();
    const { ask } = useConfirmation();
    const { triggerToast, isDynamicIslandVisible } = useApp();
    const [isShaking, setIsShaking] = useState(false);

    const handleLockedHintClick = () => {
        setIsShaking(true);
        const goofyMessages = [
            "Not so fast! 🤫 Guess more words first!",
            "No freebies yet! Keep trying! 🔒",
            "Work for it! Guess at least 2 words! 💪",
            "Nice try, lockpicker! 🗝️"
        ];
        const randomMsg = goofyMessages[Math.floor(Math.random() * goofyMessages.length)];
        triggerToast(randomMsg, 3000);
        setTimeout(() => setIsShaking(false), 500);
    };

    const handleSignOut = async () => {
        const confirmed = await ask({
            title: 'Sign Out',
            message: 'Are you sure you want to sign out? Your local game state and statistics will be cleared.',
            confirmLabel: 'Sign Out',
            type: 'danger'
        });

        if (confirmed) {
            signOut();
        }
    };

    return (
        <header className={`w-full max-w-lg mx-auto flex flex-col gap-2 mb-2 shrink-0 ${isDynamicIslandVisible ? 'pt-7.5 sm:pt-10' : 'pt-2'}`}>
            <div className="w-full flex items-center justify-between gap-1 h-10 py-1 px-2 bg-white/5 rounded-2xl border border-white/10">
                {/* Left Side: Logo & Sync Status */}
                <div className="flex items-center gap-1.5 min-w-0">
                    <div className="bg-correct/10 px-1.5 py-0.5 rounded-lg border border-correct/20 shrink-0">
                        <h1 className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-white">
                            V<span className="hidden sm:inline">ariant</span><span className="text-correct">.</span>
                        </h1>
                    </div>
                    <CloudSyncMenu status={syncStatus} onRetry={onRetrySync} />
                </div>

                {/* Right Side: Gameplay & App controls & Profile */}
                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                    {/* Gameplay Actions */}
                    {!hideGameplayActions && (
                        <>
                            <div className="flex items-center gap-0.5">
                                {canShowHint && (!isGameOver || isRevealing) && (
                                    <button
                                        onClick={isHintLocked && !usedHint ? handleLockedHintClick : onHint}
                                        disabled={usedHint}
                                        className={`p-1.5 transition-all rounded-lg relative cursor-pointer ${usedHint
                                            ? 'text-yellow-500/30 cursor-not-allowed'
                                            : isHintLocked
                                                ? `text-gray-500 opacity-70 hover:opacity-100 hover:bg-white/5 active:scale-95 ${isShaking ? 'animate-shake' : ''}`
                                                : 'text-yellow-500 bg-yellow-500/10 hover:bg-yellow-500/20 active:scale-95 animate-pulse'
                                            }`}
                                        title={usedHint ? "Hint Used" : isHintLocked ? "Unlock hint by guessing 2+ words" : "Get Hint"}
                                    >
                                        <Lightbulb size={ICON_SIZE} />
                                        {isHintLocked && !usedHint && (
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                <div className="w-[80%] h-[1.5px] bg-red-600/60 rotate-45" />
                                            </div>
                                        )}
                                    </button>
                                )}
                                <button
                                    onClick={onReset}
                                    className="p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-white/5 transition-all active:rotate-180 duration-500 cursor-pointer"
                                    title="Reset"
                                >
                                    <RotateCcw size={ICON_SIZE} />
                                </button>
                                {isGameOver && (
                                    <button
                                        onClick={onShare}
                                        className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-all cursor-pointer"
                                        title="Share"
                                    >
                                        <Share size={ICON_SIZE} />
                                    </button>
                                )}
                            </div>

                            {/* Divider */}
                            <div className="w-px h-3.5 bg-white/10 mx-0.5" />
                        </>
                    )}

                    {/* App Controls */}
                    <div className="flex items-center gap-0.5">
                        {user && isMonday && (
                            <button
                                onClick={onOpenWeeklyWrapped}
                                className="text-[8px] sm:text-[9px] font-black bg-linear-to-r from-pink-500 to-indigo-600 text-white px-2 py-1 rounded-lg uppercase tracking-wider hover:scale-105 active:scale-95 transition-all shadow-[0_0_10px_rgba(236,72,153,0.3)] shrink-0 flex items-center justify-center gap-1 cursor-pointer"
                                title="See your Weekly Wrapped"
                            >
                                🎁
                            </button>
                        )}

                        {user && <NotificationBell />}

                        <button onClick={onOpenInfo} className="text-gray-500 hover:text-white transition-colors p-1.5 shrink-0 cursor-pointer" title="Rules & How to Play">
                            <HelpCircle size={ICON_SIZE} />
                        </button>

                        <button onClick={onOpenSettings} className="text-gray-500 hover:text-white transition-colors p-1.5 shrink-0 cursor-pointer" title="Settings">
                            <SettingsIcon size={ICON_SIZE} />
                        </button>
                    </div>

                    {/* Divider */}
                    <div className="w-px h-3.5 bg-white/10 mx-0.5" />

                    {/* Profile Area */}
                    {user ? (
                        <div className="flex items-center gap-1 bg-white/5 pl-0.5 pr-2 py-0.5 rounded-full border border-white/10 group relative sm:max-w-none cursor-pointer">
                            {user.user_metadata.avatar_url ? (
                                <ProtectedAvatar
                                    userId={user.id}
                                    src={user.user_metadata.avatar_url}
                                    username={formatUsername(user.user_metadata.full_name) || user.email}
                                    className="w-4 h-4 rounded-full border border-white/10"
                                />
                            ) : (
                                <div className="w-4 h-4 rounded-full border border-white/10 flex items-center justify-center bg-white/10 text-[7px] font-black uppercase text-white shrink-0">
                                    {(formatUsername(user.user_metadata.full_name) || user.email || '?').substring(0, 2)}
                                </div>
                            )}
                            <span className="text-[8px] font-black uppercase text-gray-400 truncate max-w-[30px] min-[360px]:max-w-[50px] min-[400px]:max-w-[70px] sm:max-w-none hidden sm:inline">
                                {formatUsername(user.user_metadata.full_name) || user.email?.split('@')[0]}
                            </span>
                            <button
                                onClick={handleSignOut}
                                className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-red-500 text-[8px] font-black px-2 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap cursor-pointer"
                            >
                                LOGOUT
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => window.dispatchEvent(new CustomEvent('open-auth-modal'))}
                            className="text-[8px] sm:text-[9px] font-black bg-white text-black px-2 py-1 rounded-lg uppercase tracking-wider hover:bg-gray-200 transition-colors cursor-pointer"
                        >
                            Login
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
};