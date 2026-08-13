import React, { useEffect, useRef, useCallback } from 'react';
import { Menu, X } from 'lucide-react';
import { AppHeader } from './AppHeader';
import { AppNavigation } from './AppNavigation';
import { DynamicIslandStatus } from '../DynamicIslandStatus';
import { useAppStore } from '../../store/useAppStore';
import { useApp } from '../../context/AppContext';
import { applyTheme } from '../../utils/theme';
import type { SyncStatus } from '../../types/game';

export interface AppLayoutHeaderProps {
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

export interface AppLayoutNavigationProps {
    activeItem: 'play' | 'chat' | 'leaderboard' | 'challenges' | 'wordup' | 'more';
    onNavigate: (item: 'play' | 'chat' | 'leaderboard' | 'challenges' | 'wordup' | 'more') => void;
    challengeUnreadCount: number;
    chatUnreadCount: number;
    wordupUnreadCount?: number;
    userId?: string;
}

export interface AppLayoutProps {
    children: React.ReactNode;
    hideHeader?: boolean;
    hideNavigation?: boolean;
    headerProps?: AppLayoutHeaderProps;
    navigationProps?: AppLayoutNavigationProps;
    theme?: 'dark' | 'light' | 'wordup' | string;
    className?: string;
}

export const AppLayout = ({
    children,
    hideHeader = false,
    hideNavigation = false,
    headerProps,
    navigationProps,
    theme,
    className = '',
}: AppLayoutProps) => {
    const preferences = useAppStore(s => s.preferences);
    const setPreferences = useAppStore(s => s.setPreferences);
    const isHeaderMenuOpen = useAppStore(s => s.isHeaderMenuOpen);
    const setHeaderMenuOpen = useAppStore(s => s.setHeaderMenuOpen);

    // Dynamic theme updates when prop is provided
    useEffect(() => {
        if (theme) {
            applyTheme(theme);
            if (theme === 'dark' || theme === 'light') {
                if (preferences.theme !== theme) {
                    setPreferences({ ...preferences, theme });
                }
            }
        }
    }, [theme, preferences, setPreferences]);

    const { isDynamicIslandVisible } = useApp();

    // Determine if game for the day has not been completed (in-progress daily game)
    const isDailyGameInProgress = headerProps && !headerProps.isGameOver && !hideHeader;

    const autoHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const resetAutoHideTimer = useCallback(() => {
        if (autoHideTimerRef.current) {
            clearTimeout(autoHideTimerRef.current);
        }
        autoHideTimerRef.current = setTimeout(() => {
            setHeaderMenuOpen(false);
        }, 30000); // 30 seconds
    }, [setHeaderMenuOpen]);

    const handleToggleHeaderMenu = useCallback(() => {
        if (!isHeaderMenuOpen) {
            setHeaderMenuOpen(true);
            resetAutoHideTimer();
        } else {
            setHeaderMenuOpen(false);
            if (autoHideTimerRef.current) {
                clearTimeout(autoHideTimerRef.current);
            }
        }
    }, [isHeaderMenuOpen, setHeaderMenuOpen, resetAutoHideTimer]);

    // Reset 30s auto-hide timer on user interaction while menu is open
    useEffect(() => {
        if (!isHeaderMenuOpen) return;

        const handleUserActivity = () => {
            resetAutoHideTimer();
        };

        window.addEventListener('click', handleUserActivity);
        window.addEventListener('touchstart', handleUserActivity);
        window.addEventListener('keydown', handleUserActivity);

        return () => {
            window.removeEventListener('click', handleUserActivity);
            window.removeEventListener('touchstart', handleUserActivity);
            window.removeEventListener('keydown', handleUserActivity);
            if (autoHideTimerRef.current) {
                clearTimeout(autoHideTimerRef.current);
            }
        };
    }, [isHeaderMenuOpen, resetAutoHideTimer]);

    return (
        <div
            className={`w-full h-dvh min-h-dvh max-h-dvh flex flex-col flex-1 overflow-hidden bg-dark text-white relative select-none ${className}`}
            style={{
                backgroundColor: theme && theme.startsWith('#') ? theme : undefined,
                paddingTop: 'env(safe-area-inset-top, 0px)',
                paddingBottom: '0px',
                paddingLeft: 'env(safe-area-inset-left, 0px)',
                paddingRight: 'env(safe-area-inset-right, 0px)',
            }}
        >
            {/* Built-in Dynamic Island */}
            <DynamicIslandStatus />

            {/* Menu Bar Icon Beside Dynamic Island (Active during uncompleted daily game) */}
            {isDailyGameInProgress && (
                <div
                    className="fixed pointer-events-auto z-[140]"
                    style={{
                        top: 'calc(env(safe-area-inset-top, 0px) + 8px)',
                        right: 'max(12px, calc(50vw - 210px))'
                    }}
                >
                    <button
                        onClick={handleToggleHeaderMenu}
                        className={`w-8 h-8 rounded-full border transition-all cursor-pointer shadow-lg active:scale-95 flex items-center justify-center ${
                            isHeaderMenuOpen
                                ? 'bg-indigo-600 text-white border-indigo-400 shadow-indigo-600/30'
                                : 'bg-[#0b101d]/90 hover:bg-slate-800 text-gray-300 hover:text-white border-slate-700/80 backdrop-blur-md'
                        }`}
                        title={isHeaderMenuOpen ? "Close Menu" : "Header Options"}
                    >
                        {isHeaderMenuOpen ? <X size={15} /> : <Menu size={15} />}
                    </button>
                </div>
            )}

            {/* Floating AppHeader Overlay when user clicks Menu Icon */}
            {isDailyGameInProgress && isHeaderMenuOpen && headerProps && (
                <div className="fixed top-[calc(env(safe-area-inset-top,0px)+44px)] left-1/2 -translate-x-1/2 z-[135] w-full max-w-lg px-2 pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="bg-[#0b101d]/95 backdrop-blur-xl border border-white/15 rounded-2xl shadow-2xl p-1">
                        <AppHeader {...headerProps} />
                    </div>
                </div>
            )}

            {/* Central Top Clearance Spacer for Dynamic Island */}
            <div className={`flex flex-col flex-1 min-h-0 w-full relative transition-[padding] duration-200 ${isDynamicIslandVisible ? 'pt-10 sm:pt-14' : 'pt-0'}`}>
                {/* Standard App Header (Only rendered when game is completed / not in daily in-progress mode) */}
                {!hideHeader && headerProps && !isDailyGameInProgress && (
                    <AppHeader {...headerProps} />
                )}

                {/* Main Content Area Slot */}
                <main className="flex-1 flex flex-col min-h-0 w-full relative overflow-hidden">
                    {children}
                </main>
            </div>

            {/* Built-in App Navigation */}
            {!hideNavigation && navigationProps && (
                <AppNavigation {...navigationProps} />
            )}
        </div>
    );
};

export default AppLayout;
