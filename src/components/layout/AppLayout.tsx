import React, { useEffect } from 'react';
import { AppHeader } from './AppHeader';
import { AppNavigation } from './AppNavigation';
import { DynamicIslandStatus } from '../DynamicIslandStatus';
import { useAppStore } from '../../store/useAppStore';
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

    // Dynamic theme updates when prop is provided
    useEffect(() => {
        if (theme) {
            document.documentElement.setAttribute('data-theme', theme);
            if (theme === 'dark' || theme === 'light') {
                if (preferences.theme !== theme) {
                    setPreferences({ ...preferences, theme });
                }
            }
        }
    }, [theme, preferences, setPreferences]);

    return (
        <div
            className={`w-full h-[100dvh] max-h-[100dvh] flex flex-col overflow-hidden bg-dark text-white relative select-none ${className}`}
            style={{
                paddingTop: 'env(safe-area-inset-top, 0px)',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                paddingLeft: 'env(safe-area-inset-left, 0px)',
                paddingRight: 'env(safe-area-inset-right, 0px)',
            }}
        >
            {/* Built-in Dynamic Island (Always present across the app) */}
            <DynamicIslandStatus />

            {/* Built-in App Header */}
            {!hideHeader && headerProps && (
                <AppHeader {...headerProps} />
            )}

            {/* Main Content Area Slot */}
            <main className="flex-1 flex flex-col min-h-0 w-full relative overflow-hidden">
                {children}
            </main>

            {/* Built-in App Navigation */}
            {!hideNavigation && navigationProps && (
                <AppNavigation {...navigationProps} />
            )}
        </div>
    );
};

export default AppLayout;
