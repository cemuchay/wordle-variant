import { useState, useEffect, useRef, useMemo } from 'react';
import {
    X, LogOut, Terminal, Bell, Download, Shield, Pencil, Check,
    BarChart3, RotateCcw, ArrowRight, Sparkles
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useApp } from '../context/AppContext';
import { useAuth } from '../hooks/useAuth';
import { useConfirmation } from '../hooks/useConfirmation';
import { logger } from '../lib/logger';
import { subscribeToPush, unsubscribeFromPush, syncPushSubscriptionIfNeeded } from '../lib/pushService';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useAppStore, type TileRevealStyle } from '../store/useAppStore';
import { useAdminStatus } from '../hooks/useAdminStatus';
import { ModalLayout } from './layout/ModalLayout';
import { AdminPollsModal } from './admin/polls/AdminPollsModal';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface SettingsDraft {
    editUsername: string;
    commentsDisabled: boolean;
    tileRevealStyle: TileRevealStyle;
    allowRoasts: boolean;
    compactMode: boolean;
    rememberLastView: boolean;
    receiveEmails: boolean;
}

interface SettingDiff {
    name: string;
    from: string;
    to: string;
}

const REVEAL_STYLE_LABELS: Record<TileRevealStyle, string> = {
    normal: 'Normal',
    slow: 'Slow',
    instant: 'Instant',
};

const ToggleSwitch = ({
    checked,
    onChange,
    disabled = false,
}: {
    checked: boolean;
    onChange: (next: boolean) => void;
    disabled?: boolean;
}) => (
    <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${checked ? 'bg-emerald-500' : 'bg-white/15'
            }`}
    >
        <span
            className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'
                }`}
        />
    </button>
);

export const SettingsModal = ({ isOpen, onClose }: SettingsModalProps) => {
    const { profile, preferences, refreshProfile, triggerToast } = useApp();
    const { signOut } = useAuth();
    const { ask } = useConfirmation();
    const [loading, setLoading] = useState(false);
    const [sendingLogs, setSendingLogs] = useState(false);
    const [userEmail, setUserEmail] = useState<string>('');

    const draftStorageKey = `settings_draft_${profile?.id || 'guest'}`;

    const [allowRoasts, setAllowRoasts] = useState(preferences.allowRoasts);
    const [compactMode, setCompactMode] = useState(preferences.compactMode);
    const [rememberLastView, setRememberLastView] = useState(preferences.rememberLastView || false);
    const [tileRevealStyle, setTileRevealStyle] = useState<TileRevealStyle>(preferences.tileRevealStyle || 'normal');
    const [receiveEmails, setReceiveEmails] = useState(true);
    const [initialReceiveEmails, setInitialReceiveEmails] = useState(true);
    const [editUsername, setEditUsername] = useState(profile?.username || '');
    const [commentsDisabled, setCommentsDisabled] = useState(profile?.comments_disabled || false);

    const [isUsernameEditable, setIsUsernameEditable] = useState(false);
    const [showConfirmSummary, setShowConfirmSummary] = useState(false);
    const [draftRestored, setDraftRestored] = useState(false);

    const [pushSupported, setPushSupported] = useState(false);
    const [pushEnabled, setPushEnabled] = useState(false);
    const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');

    const { isStandalone, handleInstall, isInstalling, isIOS } = usePWAInstall();
    const [showIOSInstallInstructions, setShowIOSInstallInstructions] = useState(false);
    const { isAdmin } = useAdminStatus(profile?.id);
    const [isAdminPollsOpen, setIsAdminPollsOpen] = useState(false);

    const usernameInputRef = useRef<HTMLInputElement>(null);
    const prevIsOpenRef = useRef(false);

    // Sync from store/profile when modal opens, then overlay any saved draft from localStorage
    useEffect(() => {
        const justOpened = isOpen && !prevIsOpenRef.current;
        prevIsOpenRef.current = isOpen;
        if (!justOpened) return;

        setShowConfirmSummary(false);
        setIsUsernameEditable(false);

        const baseAllowRoasts = preferences.allowRoasts;
        const baseCompactMode = preferences.compactMode;
        const baseRememberLastView = preferences.rememberLastView || false;
        const baseTileRevealStyle = preferences.tileRevealStyle || 'normal';
        const baseUsername = profile?.username || '';
        const baseCommentsDisabled = profile?.comments_disabled || false;

        setAllowRoasts(baseAllowRoasts);
        setCompactMode(baseCompactMode);
        setRememberLastView(baseRememberLastView);
        setTileRevealStyle(baseTileRevealStyle);
        setEditUsername(baseUsername);
        setCommentsDisabled(baseCommentsDisabled);

        try {
            const rawDraft = localStorage.getItem(draftStorageKey);
            if (rawDraft) {
                const draft: Partial<SettingsDraft> = JSON.parse(rawDraft);
                // eslint-disable-next-line react-hooks/set-state-in-effect
                if (typeof draft.allowRoasts === 'boolean') setAllowRoasts(draft.allowRoasts);
                if (typeof draft.compactMode === 'boolean') setCompactMode(draft.compactMode);
                if (typeof draft.rememberLastView === 'boolean') setRememberLastView(draft.rememberLastView);
                if (draft.tileRevealStyle) setTileRevealStyle(draft.tileRevealStyle);
                if (typeof draft.editUsername === 'string') setEditUsername(draft.editUsername);
                if (typeof draft.commentsDisabled === 'boolean') setCommentsDisabled(draft.commentsDisabled);
                if (typeof draft.receiveEmails === 'boolean') setReceiveEmails(draft.receiveEmails);
                setDraftRestored(true);
            } else {
                setDraftRestored(false);
            }
        } catch {
            setDraftRestored(false);
        }
    }, [isOpen, draftStorageKey, preferences, profile]);

    // Fetch auth email, email preferences, and push status when modal opens
    useEffect(() => {
        if (!isOpen) return;

        const fetchAuthData = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.email) setUserEmail(user.email);
        };

        const fetchEmailPreferences = async () => {
            if (profile?.id) {
                const { data, error } = await supabase
                    .from('email_preferences')
                    .select('receive_emails')
                    .eq('user_id', profile.id)
                    .maybeSingle();
                if (!error && data) {
                    setInitialReceiveEmails(data.receive_emails);
                    // Only overwrite if no draft is overriding it
                    const rawDraft = localStorage.getItem(draftStorageKey);
                    if (!rawDraft) {
                        setReceiveEmails(data.receive_emails);
                    }
                }
            }
        };

        const fetchPushStatus = async () => {
            const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
            setPushSupported(supported);
            if (supported) {
                setPushPermission(Notification.permission);
                try {
                    const reg = await navigator.serviceWorker.ready;
                    let sub = await reg.pushManager.getSubscription();
                    if (Notification.permission === 'granted') {
                        // Self-heal: ensure browser subscription matches current VAPID key and is synced to Supabase DB
                        const syncedSub = await syncPushSubscriptionIfNeeded(true);
                        if (syncedSub) {
                            sub = syncedSub;
                        }
                    }
                    setPushEnabled(!!sub && Notification.permission === 'granted');
                } catch (err) {
                    console.warn('[Settings] Error checking push subscription status:', err);
                }
            }
        };

        fetchAuthData();
        fetchEmailPreferences();
        fetchPushStatus();
    }, [isOpen, profile?.id, draftStorageKey]);

    // Compute diff between saved state and current draft
    const changes = useMemo<SettingDiff[]>(() => {
        const list: SettingDiff[] = [];
        const savedUsername = profile?.username || '';
        if (profile?.id && editUsername.trim() !== savedUsername) {
            list.push({
                name: 'Username',
                from: savedUsername || 'None',
                to: editUsername.trim() || 'None',
            });
        }
        if (profile?.id && commentsDisabled !== (profile?.comments_disabled || false)) {
            list.push({
                name: 'Profile Comments',
                from: profile?.comments_disabled ? 'Disabled' : 'Enabled',
                to: commentsDisabled ? 'Disabled' : 'Enabled',
            });
        }
        const savedReveal = (preferences.tileRevealStyle || 'normal') as TileRevealStyle;
        if (tileRevealStyle !== savedReveal) {
            list.push({
                name: 'Tile Reveal Style',
                from: REVEAL_STYLE_LABELS[savedReveal],
                to: REVEAL_STYLE_LABELS[tileRevealStyle],
            });
        }
        if (allowRoasts !== preferences.allowRoasts) {
            list.push({
                name: 'Wordle Roasts',
                from: preferences.allowRoasts ? 'On' : 'Off',
                to: allowRoasts ? 'On' : 'Off',
            });
        }
        if (compactMode !== preferences.compactMode) {
            list.push({
                name: 'Compact Mode',
                from: preferences.compactMode ? 'On' : 'Off',
                to: compactMode ? 'On' : 'Off',
            });
        }
        if (rememberLastView !== (preferences.rememberLastView || false)) {
            list.push({
                name: 'Remember Last View',
                from: preferences.rememberLastView ? 'On' : 'Off',
                to: rememberLastView ? 'On' : 'Off',
            });
        }
        if (profile?.id && receiveEmails !== initialReceiveEmails) {
            list.push({
                name: 'Email Updates',
                from: initialReceiveEmails ? 'On' : 'Off',
                to: receiveEmails ? 'On' : 'Off',
            });
        }
        return list;
    }, [
        profile,
        preferences,
        editUsername,
        commentsDisabled,
        tileRevealStyle,
        allowRoasts,
        compactMode,
        rememberLastView,
        receiveEmails,
        initialReceiveEmails,
    ]);

    const hasChanges = changes.length > 0;

    // Persist draft to localStorage whenever draftable values change
    useEffect(() => {
        if (!isOpen) return;
        if (hasChanges) {
            const draft: SettingsDraft = {
                editUsername,
                commentsDisabled,
                tileRevealStyle,
                allowRoasts,
                compactMode,
                rememberLastView,
                receiveEmails,
            };
            try {
                localStorage.setItem(draftStorageKey, JSON.stringify(draft));
            } catch {
                // Ignore storage quota errors
            }
        } else {
            try {
                localStorage.removeItem(draftStorageKey);
            } catch {
                // Ignore
            }
        }
    }, [
        isOpen,
        hasChanges,
        draftStorageKey,
        editUsername,
        commentsDisabled,
        tileRevealStyle,
        allowRoasts,
        compactMode,
        rememberLastView,
        receiveEmails,
    ]);

    const handleClearDraft = () => {
        setAllowRoasts(preferences.allowRoasts);
        setCompactMode(preferences.compactMode);
        setRememberLastView(preferences.rememberLastView || false);
        setTileRevealStyle(preferences.tileRevealStyle || 'normal');
        setEditUsername(profile?.username || '');
        setCommentsDisabled(profile?.comments_disabled || false);
        setReceiveEmails(initialReceiveEmails);
        setIsUsernameEditable(false);
        setShowConfirmSummary(false);
        setDraftRestored(false);
        try {
            localStorage.removeItem(draftStorageKey);
        } catch {
            // Ignore
        }
        triggerToast('Draft Cleared');
    };

    const handleSignOut = async () => {
        const confirmed = await ask({
            title: 'Sign Out',
            message: 'Are you sure you want to sign out? Your local game state and statistics will be cleared.',
            confirmLabel: 'Sign Out',
            type: 'danger',
        });

        if (confirmed) {
            signOut();
            onClose();
        }
    };

    const handlePushToggle = async () => {
        if (!pushSupported) return;

        if (pushEnabled) {
            setLoading(true);
            await unsubscribeFromPush();
            setPushEnabled(false);
            setLoading(false);
        } else {
            if (pushPermission === 'denied') {
                triggerToast('Notifications are blocked by your browser settings.');
                return;
            }

            const confirmed = await ask({
                title: 'Enable Notifications',
                message: 'Receive real-time push notifications for word challenges, chat messages, and updates?',
                confirmLabel: 'Enable',
                cancelLabel: 'Not Now',
                type: 'info',
            });

            if (!confirmed) return;

            setLoading(true);
            try {
                const sub = await subscribeToPush();
                if (sub) {
                    setPushEnabled(true);
                    setPushPermission('granted');
                }
            } catch (err) {
                console.error('[Settings] Push subscription toggle failed:', err);
            } finally {
                setLoading(false);
            }
        }
    };

    const handlePurgeCache = async () => {
        const confirmed = await ask({
            title: 'Purge Cache & Reload',
            message: 'This will unregister the service worker and clear all local application caches. The page will reload immediately.',
            confirmLabel: 'Purge & Reload',
            type: 'danger',
        });

        if (confirmed) {
            setLoading(true);
            try {
                if ('serviceWorker' in navigator) {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    for (const registration of registrations) {
                        await registration.unregister();
                    }
                }
                if ('caches' in window) {
                    const cacheNames = await caches.keys();
                    await Promise.all(cacheNames.map((name) => caches.delete(name)));
                }
                window.location.reload();
            } catch (err) {
                console.error('[Settings] Cache purge failed:', err);
                triggerToast('Failed to purge cache.');
                setLoading(false);
            }
        }
    };

    const handleSendLogs = async () => {
        setSendingLogs(true);
        try {
            const logData = JSON.stringify(logger.getLogs(), null, 2);
            const { error } = await supabase.from('diagnostic_logs').insert({
                user_id: profile?.id || null,
                username: profile?.username || 'Anonymous',
                logs: logData,
                user_agent: navigator.userAgent,
            });
            if (error) throw error;
            triggerToast('Diagnostic logs sent.');
        } catch (err) {
            console.error('[Settings] Failed to send logs:', err);
            triggerToast('Failed to send logs.');
        } finally {
            setSendingLogs(false);
        }
    };

    const handleSave = async () => {
        setLoading(true);

        const newPreferences = {
            ...(profile?.preferences || preferences),
            allowRoasts,
            compactMode,
            rememberLastView,
            tileRevealStyle,
        };

        // Update store immediately (persists to localStorage for Guest & logged-in users)
        useAppStore.getState().setPreferences(newPreferences);

        let success = true;

        if (profile?.id) {
            const usernameClean = editUsername.trim();

            if (usernameClean) {
                if (usernameClean.length < 3 || usernameClean.length > 15) {
                    triggerToast('Username must be between 3 and 15 characters.');
                    setLoading(false);
                    return;
                }
                if (!/^[a-zA-Z0-9_]+$/.test(usernameClean)) {
                    triggerToast('Username can only contain letters, numbers and underscores.');
                    setLoading(false);
                    return;
                }

                const { data: existingUser, error: checkError } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('username', usernameClean)
                    .neq('id', profile.id)
                    .maybeSingle();

                if (!checkError && existingUser) {
                    triggerToast('Username is already taken.');
                    setLoading(false);
                    return;
                }
            }

            const { error } = await supabase
                .from('profiles')
                .update({
                    preferences: newPreferences,
                    username: usernameClean || profile.username,
                    comments_disabled: commentsDisabled,
                })
                .eq('id', profile.id);

            await supabase
                .from('email_preferences')
                .upsert({
                    user_id: profile.id,
                    receive_emails: receiveEmails,
                    updated_at: new Date().toISOString(),
                });

            if (error) {
                success = false;
                console.error('[Settings] Failed to sync profile updates to Supabase:', error);
            } else {
                try {
                    const updatedProfile = {
                        ...profile,
                        preferences: newPreferences,
                        username: usernameClean || profile.username,
                        comments_disabled: commentsDisabled,
                    };
                    localStorage.setItem(`cached-profile-${profile.id}`, JSON.stringify(updatedProfile));
                } catch {
                    // Ignore storage errors
                }
                await supabase.auth.updateUser({
                    data: {
                        username: usernameClean || profile.username,
                    },
                });
                await refreshProfile();
            }
        }

        try {
            localStorage.removeItem(draftStorageKey);
        } catch {
            // Ignore
        }
        setDraftRestored(false);
        setShowConfirmSummary(false);

        if (success) {
            triggerToast(profile?.id ? 'Settings Saved' : 'Settings Saved Locally');
            onClose();
        } else {
            triggerToast('Saved locally, but cloud sync failed.');
            onClose();
        }

        setLoading(false);
    };

    const header = (
        <div className="sticky top-0 z-20 backdrop-blur-md bg-[#121213]/90 flex items-center justify-between px-5 py-4 border-b border-white/10">
            <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold text-white tracking-tight">Settings</h2>
                {draftRestored && hasChanges && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/25">
                        Draft
                    </span>
                )}
            </div>
            <button
                onClick={onClose}
                className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                aria-label="Close settings"
            >
                <X className="w-5 h-5" />
            </button>
        </div>
    );

    const footer = showConfirmSummary ? (
        <div className="sticky bottom-0 z-20 backdrop-blur-md bg-[#121213]/90 flex items-center gap-3 p-4 border-t border-white/10">
            <button
                type="button"
                onClick={() => setShowConfirmSummary(false)}
                disabled={loading}
                className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm transition-colors disabled:opacity-50"
            >
                Back
            </button>
            <button
                type="button"
                onClick={handleSave}
                disabled={loading}
                className="flex-[2] py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-colors disabled:opacity-50"
            >
                {loading ? 'Saving...' : 'Confirm & Save'}
            </button>
        </div>
    ) : hasChanges ? (
        <div className="sticky bottom-0 z-20 backdrop-blur-md bg-[#121213]/90 flex items-center gap-3 p-4 border-t border-white/10">
            <button
                type="button"
                onClick={handleClearDraft}
                className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-semibold text-sm transition-colors"
            >
                <RotateCcw className="w-4 h-4" />
                Clear Draft
            </button>
            <button
                type="button"
                onClick={() => setShowConfirmSummary(true)}
                disabled={loading}
                className="flex-1 py-3 rounded-xl font-bold text-sm bg-white text-black hover:bg-gray-200 transition-all disabled:opacity-50"
            >
                {`Save Changes (${changes.length})`}
            </button>
        </div>
    ) : null;

    return (
        <>
            <ModalLayout
                isOpen={isOpen}
                onClose={onClose}
                showCloseButton={false}
                maxWidth="lg"
            >
                {header}
                <div className="p-5 space-y-7">
                    {showConfirmSummary ? (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-emerald-400" />
                                <h3 className="text-lg font-bold text-white">Review Changes</h3>
                            </div>
                            <p className="text-sm text-gray-400">
                                Confirm the updates below before saving your settings.
                            </p>

                            <div className="rounded-2xl bg-white/[0.04] border border-white/10 divide-y divide-white/5 overflow-hidden">
                                {changes.map((change) => (
                                    <div key={change.name} className="p-4 flex items-center justify-between gap-4">
                                        <span className="text-sm font-semibold text-white">
                                            {change.name}
                                        </span>
                                        <div className="flex items-center gap-2 text-sm">
                                            <span className="text-gray-400 line-through">{change.from}</span>
                                            <ArrowRight className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                                            <span className="font-bold text-emerald-400">{change.to}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* 1. Account & Profile */}
                            <section className="space-y-2.5">
                                <h3 className="text-sm font-bold text-white/90 px-1">
                                    Account & Profile
                                </h3>
                                <div className="rounded-2xl bg-white/[0.04] border border-white/10 divide-y divide-white/5 overflow-hidden">
                                    {profile?.id ? (
                                        <>
                                            <div className="p-4 flex items-center justify-between gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-sm font-semibold text-white">Username</div>
                                                    {isUsernameEditable ? (
                                                        <input
                                                            ref={usernameInputRef}
                                                            type="text"
                                                            value={editUsername}
                                                            onChange={(e) => {
                                                                const clean = e.target.value.replace(/[^a-zA-Z0-9_]/g, '');
                                                                setEditUsername(clean);
                                                            }}
                                                            maxLength={15}
                                                            className="mt-1.5 w-full bg-black/40 border border-white/20 rounded-lg px-3 py-1.5 text-sm font-semibold text-white focus:outline-none focus:border-emerald-400"
                                                            placeholder="Enter username"
                                                        />
                                                    ) : (
                                                        <div className="text-xs text-gray-400 truncate mt-0.5">
                                                            {editUsername || 'Not set'}
                                                        </div>
                                                    )}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setIsUsernameEditable(!isUsernameEditable);
                                                        if (!isUsernameEditable) {
                                                            setTimeout(() => usernameInputRef.current?.focus(), 50);
                                                        }
                                                    }}
                                                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 transition-colors shrink-0"
                                                    aria-label="Edit username"
                                                >
                                                    {isUsernameEditable ? (
                                                        <Check className="w-4 h-4 text-emerald-400" />
                                                    ) : (
                                                        <Pencil className="w-4 h-4" />
                                                    )}
                                                </button>
                                            </div>

                                            <div className="p-4 flex items-center justify-between gap-3">
                                                <div>
                                                    <div className="text-sm font-semibold text-white">Email</div>
                                                    <div className="text-xs text-gray-400 mt-0.5">
                                                        {userEmail || 'Loading...'}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-4 flex items-center justify-between gap-3">
                                                <div>
                                                    <div className="text-sm font-semibold text-white">Disable Comments</div>
                                                    <div className="text-xs text-gray-400 mt-0.5">
                                                        Hide comments on your profile
                                                    </div>
                                                </div>
                                                <ToggleSwitch
                                                    checked={commentsDisabled}
                                                    onChange={setCommentsDisabled}
                                                />
                                            </div>

                                            <button
                                                type="button"
                                                onClick={handleSignOut}
                                                className="w-full p-4 flex items-center justify-between text-left hover:bg-red-500/10 transition-colors"
                                            >
                                                <span className="text-sm font-semibold text-red-400">Sign Out</span>
                                                <LogOut className="w-4 h-4 text-red-400" />
                                            </button>
                                        </>
                                    ) : (
                                        <div className="p-4">
                                            <div className="text-sm font-semibold text-white">Guest Mode</div>
                                            <div className="text-xs text-gray-400 mt-0.5">
                                                Gameplay settings are saved locally on this device.
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* 2. Gameplay & Alerts */}
                            <section className="space-y-2.5">
                                <h3 className="text-sm font-bold text-white/90 px-1">
                                    Gameplay & Alerts
                                </h3>
                                <div className="rounded-2xl bg-white/[0.04] border border-white/10 divide-y divide-white/5 overflow-hidden">
                                    {/* Tile Reveal Style */}
                                    <div className="p-4 space-y-3">
                                        <div>
                                            <div className="text-sm font-semibold text-white">Tile Reveal Style</div>
                                            <div className="text-xs text-gray-400 mt-0.5">
                                                Applies to Standard, Challenge, and Guest games
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-black/40 border border-white/5">
                                            {(['normal', 'slow', 'instant'] as TileRevealStyle[]).map((style) => {
                                                const active = tileRevealStyle === style;
                                                return (
                                                    <button
                                                        key={style}
                                                        type="button"
                                                        onClick={() => setTileRevealStyle(style)}
                                                        className={`py-2 rounded-lg text-xs font-bold transition-all ${active
                                                                ? 'bg-white text-black shadow-sm'
                                                                : 'text-gray-400 hover:text-white'
                                                            }`}
                                                    >
                                                        {REVEAL_STYLE_LABELS[style]}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="p-4 flex items-center justify-between gap-3">
                                        <div>
                                            <div className="text-sm font-semibold text-white">Wordle Roasts</div>
                                            <div className="text-xs text-gray-400 mt-0.5">
                                                Show playful post-game commentary
                                            </div>
                                        </div>
                                        <ToggleSwitch checked={allowRoasts} onChange={setAllowRoasts} />
                                    </div>

                                    <div className="p-4 flex items-center justify-between gap-3">
                                        <div>
                                            <div className="text-sm font-semibold text-white">Compact Mode</div>
                                            <div className="text-xs text-gray-400 mt-0.5">
                                                Tighter spacing for smaller screens
                                            </div>
                                        </div>
                                        <ToggleSwitch checked={compactMode} onChange={setCompactMode} />
                                    </div>

                                    <div className="p-4 flex items-center justify-between gap-3">
                                        <div>
                                            <div className="text-sm font-semibold text-white">Remember Last View</div>
                                            <div className="text-xs text-gray-400 mt-0.5">
                                                Reopen the last tab you visited
                                            </div>
                                        </div>
                                        <ToggleSwitch checked={rememberLastView} onChange={setRememberLastView} />
                                    </div>

                                    {profile?.id && (
                                        <div className="p-4 flex items-center justify-between gap-3">
                                            <div>
                                                <div className="text-sm font-semibold text-white">Email Updates</div>
                                                <div className="text-xs text-gray-400 mt-0.5">
                                                    Daily reminders and challenge alerts
                                                </div>
                                            </div>
                                            <ToggleSwitch checked={receiveEmails} onChange={setReceiveEmails} />
                                        </div>
                                    )}

                                    {pushSupported && (
                                        <div className="p-4 flex items-center justify-between gap-3">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-semibold text-white">
                                                        Push Notifications
                                                    </span>
                                                    <span
                                                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pushPermission === 'granted' && pushEnabled
                                                                ? 'bg-emerald-500/20 text-emerald-400'
                                                                : 'bg-white/10 text-gray-400'
                                                            }`}
                                                    >
                                                        {pushPermission === 'granted' && pushEnabled ? 'Active' : 'Off'}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-gray-400 mt-0.5">
                                                    Instant alerts on this device
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handlePushToggle}
                                                disabled={loading}
                                                className="p-2 rounded-xl bg-white/10 hover:bg-white/15 text-white transition-colors disabled:opacity-50"
                                                aria-label="Toggle push notifications"
                                            >
                                                <Bell className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* 3. App & Support */}
                            <section className="space-y-2.5">
                                <h3 className="text-sm font-bold text-white/90 px-1">
                                    App & Support
                                </h3>
                                <div className="rounded-2xl bg-white/[0.04] border border-white/10 divide-y divide-white/5 overflow-hidden">
                                    {!isStandalone && (
                                        <div className="p-4 space-y-2">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <div className="text-sm font-semibold text-white">Install App</div>
                                                    <div className="text-xs text-gray-400 mt-0.5">
                                                        Add to home screen for faster access
                                                    </div>
                                                </div>
                                                {isIOS ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowIOSInstallInstructions(!showIOSInstallInstructions)}
                                                        className="px-3.5 py-1.5 rounded-xl bg-white text-black text-xs font-bold hover:bg-gray-200 transition-colors"
                                                    >
                                                        How to Install
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={handleInstall}
                                                        disabled={isInstalling}
                                                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white text-black text-xs font-bold hover:bg-gray-200 transition-colors disabled:opacity-50"
                                                    >
                                                        <Download className="w-3.5 h-3.5" />
                                                        {isInstalling ? 'Installing...' : 'Install'}
                                                    </button>
                                                )}
                                            </div>
                                            {isIOS && showIOSInstallInstructions && (
                                                <p className="text-xs text-gray-400 bg-black/30 rounded-xl p-3">
                                                    Tap the Share button in Safari, then choose &ldquo;Add to Home Screen&rdquo;.
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {isAdmin && (
                                        <>
                                            <a
                                                href="/admin"
                                                onClick={onClose}
                                                className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <Shield className="w-4 h-4 text-[#E85151]" />
                                                    <span className="text-sm font-semibold text-white">Admin Dashboard</span>
                                                </div>
                                                <span className="text-xs font-semibold text-gray-400">Open</span>
                                            </a>
                                            <button
                                                type="button"
                                                onClick={() => setIsAdminPollsOpen(true)}
                                                className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <BarChart3 className="w-4 h-4 text-indigo-400" />
                                                    <span className="text-sm font-semibold text-white">Admin Polls</span>
                                                </div>
                                                <span className="text-xs font-semibold text-gray-400">Open</span>
                                            </button>
                                        </>
                                    )}

                                    <div className="p-4 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2.5">
                                            <Terminal className="w-4 h-4 text-gray-400" />
                                            <div>
                                                <div className="text-sm font-semibold text-white">Diagnostics</div>
                                                <div className="text-xs text-gray-400 mt-0.5">
                                                    Send logs or reset app cache
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={handleSendLogs}
                                                disabled={sendingLogs}
                                                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition-colors disabled:opacity-50"
                                            >
                                                {sendingLogs ? 'Sending...' : 'Send Logs'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handlePurgeCache}
                                                disabled={loading}
                                                className="px-3 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-xs font-semibold text-red-400 transition-colors disabled:opacity-50"
                                            >
                                                Purge Cache
                                            </button>
                                        </div>
                                    </div>

                                    <div className="p-4 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2.5">
                                            <Shield className="w-4 h-4 text-gray-400" />
                                            <span className="text-sm font-semibold text-white">Legal</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs font-semibold text-gray-400">
                                            <a href="/privacy" className="hover:text-white transition-colors">
                                                Privacy
                                            </a>
                                            <a href="/terms" className="hover:text-white transition-colors">
                                                Terms
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </>
                    )}
                </div>
                {footer}
            </ModalLayout>

            {isAdmin && (
                <AdminPollsModal
                    isOpen={isAdminPollsOpen}
                    onClose={() => setIsAdminPollsOpen(false)}
                />
            )}
        </>
    );
};
