import { useState, useEffect, useRef } from 'react';
import { X, ShieldCheck, MessageSquareQuote, LogOut, Terminal, Mail, FileText, Bell, Download, Search, Shield, Pencil, Check } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useApp } from '../context/AppContext';
import { useAuth } from '../hooks/useAuth';
import { useConfirmation } from '../hooks/useConfirmation';
import { logger } from '../lib/logger';
import { subscribeToPush, unsubscribeFromPush } from '../lib/pushService';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useAppStore } from '../store/useAppStore';
import { useAdminStatus } from '../hooks/useAdminStatus';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SettingsModal = ({ isOpen, onClose, }: SettingsModalProps) => {
    const { profile, preferences, refreshProfile, triggerToast } = useApp();
    const { signOut } = useAuth();
    const { ask } = useConfirmation();
    const [loading, setLoading] = useState(false);
    const [sendingLogs, setSendingLogs] = useState(false);
    const [userEmail, setUserEmail] = useState<string>('');
    const [allowRoasts, setAllowRoasts] = useState(preferences.allowRoasts);
    const [compactMode, setCompactMode] = useState(preferences.compactMode);
    const [rememberLastView, setRememberLastView] = useState(preferences.rememberLastView || false);
    const [prevPreferences, setPrevPreferences] = useState(preferences);

    if (preferences !== prevPreferences) {
        setPrevPreferences(preferences);
        setAllowRoasts(preferences.allowRoasts);
        setCompactMode(preferences.compactMode);
        setRememberLastView(preferences.rememberLastView || false);
    }

    const [receiveEmails, setReceiveEmails] = useState(true);
    const [pushSupported, setPushSupported] = useState(false);
    const [pushEnabled, setPushEnabled] = useState(false);
    const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');
    const [searchQuery, setSearchQuery] = useState('');

    const { isStandalone, handleInstall, isInstalling, isIOS } = usePWAInstall();
    const [showIOSInstallInstructions, setShowIOSInstallInstructions] = useState(false);
    const { isAdmin } = useAdminStatus(profile?.id);

    const handleSignOut = async () => {
        const confirmed = await ask({
            title: 'Sign Out',
            message: 'Are you sure you want to sign out? Your local game state and statistics will be cleared.',
            confirmLabel: 'Sign Out',
            type: 'danger'
        });

        if (confirmed) {
            signOut();
            onClose();
        }
    };

    const usernameInputRef = useRef<HTMLInputElement>(null);
    const [editUsername, setEditUsername] = useState(profile?.username || '');
    const [isUsernameEditable, setIsUsernameEditable] = useState(false);
    const [prevProfile, setPrevProfile] = useState(profile);

    if (profile !== prevProfile) {
        setPrevProfile(profile);
        if (profile) {
            setEditUsername(profile.username || '');
        }
    }

    const [showConfirmSummary, setShowConfirmSummary] = useState(false);
    const [initialReceiveEmails, setInitialReceiveEmails] = useState(false);
    const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

    const handleReset = () => {
        setAllowRoasts(preferences.allowRoasts);
        setCompactMode(preferences.compactMode);
        setRememberLastView(preferences.rememberLastView || false);
        setEditUsername(profile?.username || '');
        setIsUsernameEditable(false);
        setReceiveEmails(initialReceiveEmails);
        triggerToast('Changes Discarded');
    };

    if (isOpen !== prevIsOpen) {
        setPrevIsOpen(isOpen);
        if (isOpen) {
            setShowConfirmSummary(false);
            setIsUsernameEditable(false);
        }
    }

    useEffect(() => {
        if (isOpen) {
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
                        setReceiveEmails(data.receive_emails);
                        setInitialReceiveEmails(data.receive_emails);
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
                        const sub = await reg.pushManager.getSubscription();
                        setPushEnabled(!!sub && Notification.permission === 'granted');
                    } catch (err) {
                        console.warn("[Settings] Error checking push subscription status:", err);
                    }
                }
            };

            fetchAuthData();
            fetchEmailPreferences();
            fetchPushStatus();
        }
    }, [isOpen, profile?.id]);

    const handlePushToggle = async () => {
        if (!pushSupported) return;

        if (pushEnabled) {
            // Disable
            setLoading(true);
            await unsubscribeFromPush();
            setPushEnabled(false);
            setLoading(false);
        } else {
            // Enable
            if (pushPermission === 'denied') {
                triggerToast('Notifications are blocked by your browser settings. Please allow them manually.');
                return;
            }

            // 2-Tier Double Opt-in Prompt
            const confirmed = await ask({
                title: 'Enable Notifications',
                message: 'Would you like to receive real-time push notifications for word challenges, global chat messages, and updates?',
                confirmLabel: 'Yes, Enable',
                cancelLabel: 'Maybe Later',
                type: 'info'
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
                console.error("[Settings] Push subscription toggle failed:", err);
            } finally {
                setLoading(false);
            }
        }
    };

    const handlePurgeCache = async () => {
        const confirmed = await ask({
            title: 'Purge Cache & Reload',
            message: 'This will unregister the service worker and clear all local application caches. Use this if the app is behaving unexpectedly or not updating. The page will reload immediately.',
            confirmLabel: 'Purge & Reload',
            type: 'danger'
        });

        if (confirmed) {
            setLoading(true);
            try {
                // 1. Unregister all service workers
                if ('serviceWorker' in navigator) {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    for (const registration of registrations) {
                        await registration.unregister();
                    }
                }

                // 2. Clear all caches
                if ('caches' in window) {
                    const keys = await caches.keys();
                    for (const key of keys) {
                        await caches.delete(key);
                    }
                }

                // 3. Reload
                window.location.reload();
            } catch (err) {
                console.error("[Settings] Cache purge failed:", err);
                triggerToast('Failed to purge cache');
                setLoading(false);
            }
        }
    };



    const getChanges = () => {
        const changes: { name: string; from: string; to: string }[] = [];

        if (profile?.id) {
            const usernameClean = editUsername.trim();
            const originalUsername = profile.username || '';
            if (usernameClean !== originalUsername) {
                changes.push({
                    name: 'Username',
                    from: originalUsername ? `@${originalUsername}` : 'None',
                    to: usernameClean ? `@${usernameClean}` : 'None'
                });
            }
        }

        if (allowRoasts !== (preferences.allowRoasts ?? true)) {
            changes.push({
                name: 'Allow Roasts',
                from: (preferences.allowRoasts ?? true) ? 'Enabled' : 'Disabled',
                to: allowRoasts ? 'Enabled' : 'Disabled'
            });
        }

        if (compactMode !== (preferences.compactMode ?? false)) {
            changes.push({
                name: 'Compact Mode',
                from: (preferences.compactMode ?? false) ? 'Enabled' : 'Disabled',
                to: compactMode ? 'Enabled' : 'Disabled'
            });
        }

        if (rememberLastView !== (preferences.rememberLastView ?? true)) {
            changes.push({
                name: 'Restore Last Tab',
                from: (preferences.rememberLastView ?? true) ? 'Enabled' : 'Disabled',
                to: rememberLastView ? 'Enabled' : 'Disabled'
            });
        }

        if (receiveEmails !== initialReceiveEmails) {
            changes.push({
                name: 'Email Notifications',
                from: initialReceiveEmails ? 'Subscribed' : 'Unsubscribed',
                to: receiveEmails ? 'Subscribed' : 'Unsubscribed'
            });
        }



        return changes;
    };

    const handleSave = async () => {
        setLoading(true);

        const newPreferences = {
            ...(profile?.preferences || preferences),
            allowRoasts,
            compactMode,
            rememberLastView,
        };

        // Update store directly for immediate effect and anonymous support
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

                // Check uniqueness
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
                    username: usernameClean || profile.username
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
                console.error("[Settings] Failed to sync profile updates to Supabase:", error);
            } else {
                await supabase.auth.updateUser({
                    data: {
                        username: usernameClean || profile.username
                    }
                });
                await refreshProfile();
            }
        }

        if (success) {
            triggerToast(profile?.id ? 'Preferences Updated' : 'Preferences Saved Locally');
            onClose();
        } else {
            triggerToast('Saved locally, but cloud sync failed.');
            onClose();
        }

        setLoading(false);
    };



    const matchesSearch = (text: string, description?: string) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return text.toLowerCase().includes(query) || (description?.toLowerCase().includes(query) ?? false);
    };

    if (!isOpen) return null;

    const showProfile = !!(profile?.id && (matchesSearch('Profile Settings') || matchesSearch('Username') || matchesSearch('Full Name')));
    const showSecurity = matchesSearch('Security & Identity') || matchesSearch('Email', userEmail);
    const showGameplay = matchesSearch('Gameplay Experience') || matchesSearch('Sassy Roasts') || matchesSearch('Compact Mode') || matchesSearch('Remember Last View');
    const showEmail = matchesSearch('Email Notifications') || matchesSearch('Updates & Reminders');
    const showPush = matchesSearch('Push Notifications') || matchesSearch('Live Push Updates');
    const showApp = !isStandalone && (matchesSearch('Application') || matchesSearch('Install Variant'));
    const showDiagnostics = matchesSearch('Diagnostics') || matchesSearch('Session Logs') || matchesSearch('Purge Cache');
    const showLegal = matchesSearch('Legal & Policies') || matchesSearch('Privacy') || matchesSearch('Terms') || matchesSearch('Data Deletion');

    const hasResults = showProfile || showSecurity || showGameplay || showEmail || showPush || showApp || showDiagnostics || showLegal;

    return (
        <div className="fixed inset-0 z-150 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-md bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] sm:max-h-[90vh] animate-in slide-in-from-bottom-8 duration-300 settings-modal-content">
                <style dangerouslySetInnerHTML={{
                    __html: `
                    .settings-modal-content *:not(svg):not(path) {
                        color: #ffffff !important;
                    }
                    .settings-modal-content input::placeholder {
                        color: rgba(255, 255, 255, 0.4) !important;
                    }
                `}} />

                {/* Header */}
                <div className="flex flex-col border-b border-gray-900 bg-gray-900/20 shrink-0">
                    <div className="flex items-center justify-between p-4 pb-2">
                        <h2 className="text-lg font-black text-white tracking-tight">Settings</h2>
                        <button onClick={onClose} className="p-1 hover:bg-gray-800 rounded-full transition-colors text-gray-500 hover:text-white cursor-pointer">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Search Bar */}
                    <div className="px-4 pb-4">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-400 transition-colors" size={14} />
                            <input
                                type="text"
                                placeholder="Search settings..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-gray-900/50 border border-gray-800 rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white transition-colors cursor-pointer"
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-8 overflow-y-auto custom-scrollbar flex-1">
                    {showConfirmSummary ? (
                        <div className="space-y-6 py-4 animate-in fade-in zoom-in-95 duration-200">
                            <div className="text-center space-y-2">
                                <h3 className="text-sm font-black uppercase tracking-wider text-indigo-400">Review Changes</h3>
                                <p className="text-[10px] text-gray-400 leading-relaxed">Please review the modified settings before saving.</p>
                            </div>
                            <div className="space-y-2.5 max-h-[40vh] overflow-y-auto pr-1">
                                {getChanges().map((change, idx) => (
                                    <div key={idx} className="bg-gray-900/50 border border-gray-800 rounded-xl p-3 space-y-1.5">
                                        <span className="text-[9px] font-black uppercase text-gray-500 tracking-wider block">{change.name}</span>
                                        <div className="flex items-center justify-between text-xs gap-3 font-medium">
                                            <span className="text-gray-400 line-through truncate max-w-[45%]">{change.from}</span>
                                            <span className="text-indigo-400 font-bold font-mono">→</span>
                                            <span className="text-correct font-bold truncate max-w-[45%]">{change.to}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <>
                            {!hasResults && (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <div className="w-12 h-12 bg-gray-900 rounded-full flex items-center justify-center mb-4 border border-gray-800">
                                        <Search size={20} className="text-gray-600" />
                                    </div>
                                    <p className="text-sm font-bold text-gray-300">No settings found</p>
                                    <p className="text-xs text-gray-600 mt-1">Try a different search term</p>
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="mt-4 text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-300 transition-colors"
                                    >
                                        Clear Search
                                    </button>
                                </div>
                            )}

                            {/* Profile Settings */}
                            {showProfile && (
                                <section className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="flex items-center gap-2 mb-1">
                                        <ShieldCheck size={14} className="text-indigo-400" />
                                        <label className="text-[10px] uppercase font-black text-gray-500 tracking-widest">
                                            Profile Settings
                                        </label>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Username</label>
                                            <div className="relative group flex items-center">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">@</span>
                                                <input
                                                    ref={usernameInputRef}
                                                    type="text"
                                                    value={editUsername}
                                                    readOnly={!isUsernameEditable}
                                                    onChange={(e) => {
                                                        const clean = e.target.value.replace(/\s+/g, '');
                                                        if (clean.length > 0) {
                                                            setEditUsername(clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase());
                                                        } else {
                                                            setEditUsername('');
                                                        }
                                                    }}
                                                    placeholder="Username"
                                                    className={`w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-8 pr-12 text-xs focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-all text-white placeholder-gray-600 ${!isUsernameEditable ? 'opacity-70 cursor-default select-none' : ''}`}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const nextEditable = !isUsernameEditable;
                                                        setIsUsernameEditable(nextEditable);
                                                        if (nextEditable) {
                                                            setTimeout(() => usernameInputRef.current?.focus(), 50);
                                                        }
                                                    }}
                                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-indigo-400 p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                                                    title={isUsernameEditable ? "Save username" : "Edit username"}
                                                >
                                                    {isUsernameEditable ? (
                                                        <Check size={14} className="text-indigo-400 animate-pulse" />
                                                    ) : (
                                                        <Pencil size={14} className="text-gray-500" />
                                                    )}
                                                </button>
                                            </div>
                                            <p className="text-[9px] text-gray-600 px-1">
                                                3-15 characters. Letters, numbers, and underscores only.
                                            </p>
                                        </div>
                                    </div>
                                </section>
                            )}

                            {/* Security & Identity (Private Data) */}
                            {showSecurity && (
                                <section className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="flex items-center gap-2 mb-1">
                                        <ShieldCheck size={14} className="text-indigo-400" />
                                        <label className="text-[10px] uppercase font-black text-gray-500 tracking-widest">
                                            Security & Identity
                                        </label>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between px-4 py-3 bg-gray-900/40 border border-gray-800/50 rounded-xl">
                                            <span className="text-xs text-gray-400 truncate max-w-50">
                                                {userEmail || 'Fetching...'}
                                            </span>
                                            <span className="text-[9px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                                                PRIVATE
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-gray-600 px-1 italic">
                                            Your email is used for recovery and is never shared publicly.
                                        </p>
                                    </div>
                                </section>
                            )}

                            {/* Gameplay Preferences */}
                            {showGameplay && (
                                <section className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="flex items-center gap-2 mb-1">
                                        <MessageSquareQuote size={14} className="text-indigo-400" />
                                        <label className="text-[10px] uppercase font-black text-gray-500 tracking-widest">
                                            Gameplay Experience
                                        </label>
                                    </div>

                                    <div className="space-y-3">
                                        {matchesSearch('Sassy Roasts') && (
                                            <div className="flex items-center justify-between p-4 bg-gray-900/40 border border-gray-800 rounded-xl transition-colors hover:border-gray-700">
                                                <div className="flex-1 pr-4">
                                                    <p className="text-sm font-bold text-gray-100">Sassy Roasts</p>
                                                    <p className="text-[11px] text-gray-500 leading-relaxed">
                                                        The app will roast you based on your game score.
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => setAllowRoasts(!allowRoasts)}
                                                    className={`w-12 h-6 rounded-full transition-all duration-300 relative ${allowRoasts ? 'bg-indigo-600 shadow-[0_0_12px_rgba(79,70,229,0.3)]' : 'bg-gray-800'
                                                        }`}
                                                >
                                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm ${allowRoasts ? 'left-7' : 'left-1'
                                                        }`} />
                                                </button>
                                            </div>
                                        )}

                                        {matchesSearch('Compact Mode') && (
                                            <div className="flex items-center justify-between p-4 bg-gray-900/40 border border-gray-800 rounded-xl transition-colors hover:border-gray-700">
                                                <div className="flex-1 pr-4">
                                                    <p className="text-sm font-bold text-gray-100">Compact Mode</p>
                                                    <p className="text-[11px] text-gray-500 leading-relaxed">
                                                        Reduce spacing in the game grid for smaller screens.
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => setCompactMode(!compactMode)}
                                                    className={`w-12 h-6 rounded-full transition-all duration-300 relative ${compactMode ? 'bg-indigo-600 shadow-[0_0_12px_rgba(79,70,229,0.3)]' : 'bg-gray-800'
                                                        }`}
                                                >
                                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm ${compactMode ? 'left-7' : 'left-1'
                                                        }`} />
                                                </button>
                                            </div>
                                        )}

                                        {matchesSearch('Remember Last View') && (
                                            <div className="flex items-center justify-between p-4 bg-gray-900/40 border border-gray-800 rounded-xl transition-colors hover:border-gray-700">
                                                <div className="flex-1 pr-4">
                                                    <p className="text-sm font-bold text-gray-100">Remember Last View Settings</p>
                                                    <p className="text-[11px] text-gray-500 leading-relaxed">
                                                        Globally remember your open modals and active tab across exits/reloads.
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => setRememberLastView(!rememberLastView)}
                                                    className={`w-12 h-6 rounded-full transition-all duration-300 relative ${rememberLastView ? 'bg-indigo-600 shadow-[0_0_12px_rgba(79,70,229,0.3)]' : 'bg-gray-800'
                                                        }`}
                                                >
                                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm ${rememberLastView ? 'left-7' : 'left-1'
                                                        }`} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </section>
                            )}

                            {/* Email Notifications Preferences */}
                            {showEmail && (
                                <section className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Mail size={14} className="text-indigo-400" />
                                        <label className="text-[10px] uppercase font-black text-gray-500 tracking-widest">
                                            Email Notifications
                                        </label>
                                    </div>

                                    {matchesSearch('Updates & Reminders') && (
                                        <div className="flex items-center justify-between p-4 bg-gray-900/40 border border-gray-800 rounded-xl transition-colors hover:border-gray-700">
                                            <div className="flex-1 pr-4">
                                                <p className="text-sm font-bold text-gray-100">Updates & Reminders</p>
                                                <p className="text-[11px] text-gray-500 leading-relaxed">
                                                    Receive streak reminders, inactivity nudges, and weekly leaderboard reports.
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => setReceiveEmails(!receiveEmails)}
                                                className={`w-12 h-6 rounded-full transition-all duration-300 relative ${receiveEmails ? 'bg-indigo-600 shadow-[0_0_12px_rgba(79,70,229,0.3)]' : 'bg-gray-800'
                                                    }`}
                                            >
                                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm ${receiveEmails ? 'left-7' : 'left-1'
                                                    }`} />
                                            </button>
                                        </div>
                                    )}
                                </section>
                            )}

                            {/* Push Notifications Preferences */}
                            {showPush && (
                                <section className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Bell size={14} className="text-indigo-400" />
                                        <label className="text-[10px] uppercase font-black text-gray-500 tracking-widest">
                                            Push Notifications
                                        </label>
                                    </div>

                                    {matchesSearch('Live Push Updates') && (
                                        <div className="flex items-center justify-between p-4 bg-gray-900/40 border border-gray-800 rounded-xl transition-colors hover:border-gray-700">
                                            <div className="flex-1 pr-4">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-bold text-gray-100">Live Push Updates</p>
                                                    {pushSupported && (
                                                        <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider ${pushPermission === 'granted' && pushEnabled
                                                            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                                            : pushPermission === 'denied'
                                                                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                                                : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                                                            }`}>
                                                            {pushPermission === 'granted' && pushEnabled
                                                                ? 'Active'
                                                                : pushPermission === 'denied'
                                                                    ? 'Blocked'
                                                                    : 'Not Active'}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[11px] text-gray-500 leading-relaxed mt-0.5">
                                                    {!pushSupported
                                                        ? 'Not supported by this browser/device.'
                                                        : 'Get instant notifications for challenges, chat messages, and leaderboard news.'}
                                                </p>
                                            </div>
                                            {pushSupported && (
                                                <button
                                                    onClick={handlePushToggle}
                                                    className={`w-12 h-6 rounded-full transition-all duration-300 relative ${pushEnabled && pushPermission === 'granted'
                                                        ? 'bg-indigo-600 shadow-[0_0_12px_rgba(79,70,229,0.3)]'
                                                        : 'bg-gray-800'
                                                        }`}
                                                >
                                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm ${pushEnabled && pushPermission === 'granted' ? 'left-7' : 'left-1'
                                                        }`} />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </section>
                            )}

                            {/* App Installation (PWA) */}
                            {showApp && (
                                <section className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Download size={14} className="text-indigo-400" />
                                        <label className="text-[10px] uppercase font-black text-gray-500 tracking-widest">
                                            Application
                                        </label>
                                    </div>

                                    <div className="p-4 bg-gray-900/40 border border-gray-800 rounded-xl transition-colors hover:border-gray-700">
                                        <div className="flex items-start gap-4">
                                            <div className="flex-1">
                                                <p className="text-sm font-bold text-gray-100">Install Variant</p>
                                                <p className="text-[11px] text-gray-500 leading-relaxed mt-0.5">
                                                    Add Variant to your home screen for quick, fullscreen word challenges.
                                                </p>
                                            </div>
                                            {!isIOS ? (
                                                <button
                                                    onClick={handleInstall}
                                                    disabled={isInstalling}
                                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-[10px] font-black text-white uppercase tracking-widest rounded-lg shadow-lg shadow-indigo-900/20 transition-all disabled:opacity-50 shrink-0"
                                                >
                                                    {isInstalling ? 'INSTALLING...' : 'INSTALL'}
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => setShowIOSInstallInstructions(!showIOSInstallInstructions)}
                                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-[10px] font-black text-white uppercase tracking-widest rounded-lg shadow-lg shadow-indigo-900/20 transition-all shrink-0"
                                                >
                                                    {showIOSInstallInstructions ? 'HIDE' : 'HOW TO'}
                                                </button>
                                            )}
                                        </div>
                                        {isIOS && showIOSInstallInstructions && (
                                            <div className="mt-4 p-3 bg-black/40 rounded-lg border border-gray-800/50 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                                <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">iOS Instructions:</p>
                                                <ol className="text-[11px] text-gray-500 space-y-1.5 list-decimal pl-4">
                                                    <li>Tap the <span className="inline-flex align-middle bg-gray-800 p-0.5 rounded text-white">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                                                            <polyline points="16 6 12 2 8 6" />
                                                            <line x1="12" y1="2" x2="12" y2="15" />
                                                        </svg>
                                                    </span> share button in Safari.</li>
                                                    <li>Scroll and select <span className="text-gray-300 font-bold">"Add to Home Screen"</span>.</li>
                                                    <li>Tap <span className="text-indigo-400 font-bold">"Add"</span> to finish.</li>
                                                </ol>
                                            </div>
                                        )}
                                    </div>
                                </section>
                            )}



                            {/* Admin Portal (Only for Admins) */}
                            {isAdmin && (matchesSearch('Admin') || matchesSearch('Portal') || matchesSearch('Shield')) && (
                                <section className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Shield size={14} className="text-correct" />
                                        <label className="text-[10px] uppercase font-black text-gray-500 tracking-widest">
                                            Management
                                        </label>
                                    </div>

                                    <a
                                        href="/admin"
                                        className="flex items-center justify-between p-4 bg-correct/5 border border-correct/20 rounded-xl hover:bg-correct/10 transition-all group"
                                    >
                                        <div className="flex-1 pr-4">
                                            <p className="text-sm font-bold text-correct">Admin Vetting Portal</p>
                                            <p className="text-[11px] text-gray-500 leading-relaxed">
                                                Access word vetting, user management, and system overrides.
                                            </p>
                                        </div>
                                        <Shield size={20} className="text-correct opacity-40 group-hover:opacity-100 transition-opacity" />
                                    </a>
                                </section>
                            )}

                            {/* Debugging & Diagnostics */}
                            {showDiagnostics && (
                                <section className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Terminal size={14} className="text-indigo-400" />
                                        <label className="text-[10px] uppercase font-black text-gray-500 tracking-widest">
                                            Diagnostics
                                        </label>
                                    </div>

                                    <div className="flex flex-col gap-3">
                                        {matchesSearch('Session Logs') && (
                                            <div className="flex items-center justify-between p-4 bg-gray-900/40 border border-gray-800 rounded-xl transition-colors hover:border-gray-700">
                                                <div className="flex-1 pr-4">
                                                    <p className="text-sm font-bold text-gray-100">Session Logs</p>
                                                    <p className="text-[11px] text-gray-500 leading-relaxed">
                                                        Send diagnostic logs to admin to help us debug issues.
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={async () => {
                                                        setSendingLogs(true);
                                                        await logger.sendLogsToAdmin();
                                                        setSendingLogs(false);
                                                        triggerToast('Logs Sent to Admin');
                                                    }}
                                                    disabled={sendingLogs}
                                                    className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-[10px] font-black text-gray-300 uppercase tracking-widest rounded-lg border border-white/5 transition-all disabled:opacity-50"
                                                >
                                                    {sendingLogs ? 'SENDING...' : 'SEND TO ADMIN'}
                                                </button>
                                            </div>
                                        )}

                                        {matchesSearch('Purge Cache') && (
                                            <div className="flex items-center justify-between p-4 bg-gray-900/40 border border-gray-800 rounded-xl transition-colors hover:border-gray-700">
                                                <div className="flex-1 pr-4">
                                                    <p className="text-sm font-bold text-gray-100">Purge Cache</p>
                                                    <p className="text-[11px] text-gray-500 leading-relaxed">
                                                        Clears all local application cache and reloads the page.
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={handlePurgeCache}
                                                    className="px-3 py-1.5 bg-red-950/30 hover:bg-red-900/40 text-[10px] font-black text-red-400 uppercase tracking-widest rounded-lg border border-red-500/20 transition-all"
                                                >
                                                    PURGE & RELOAD
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </section>
                            )}

                            {/* Legal & Policies */}
                            {showLegal && (
                                <section className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="flex items-center gap-2 mb-1">
                                        <FileText size={14} className="text-indigo-400" />
                                        <label className="text-[10px] uppercase font-black text-gray-500 tracking-widest">
                                            Legal & Policies
                                        </label>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2">
                                        {matchesSearch('Privacy') && (
                                            <a
                                                href="/privacy.html"
                                                className="flex flex-col items-center justify-center p-3 bg-gray-900/40 border border-gray-800 rounded-xl hover:border-gray-750 hover:bg-gray-905/60 transition-all text-center"
                                            >
                                                <span className="text-[10px] font-bold text-gray-200">Privacy</span>
                                                <span className="text-[8px] text-gray-500 uppercase tracking-wider mt-0.5">Policy</span>
                                            </a>
                                        )}
                                        {matchesSearch('Terms') && (
                                            <a
                                                href="/tos.html"
                                                className="flex flex-col items-center justify-center p-3 bg-gray-900/40 border border-gray-800 rounded-xl hover:border-gray-750 hover:bg-gray-905/60 transition-all text-center"
                                            >
                                                <span className="text-[10px] font-bold text-gray-200">Terms</span>
                                                <span className="text-[8px] text-gray-500 uppercase tracking-wider mt-0.5">of Service</span>
                                            </a>
                                        )}
                                        {matchesSearch('Data Deletion') && (
                                            <a
                                                href="/deletion.html"
                                                className="flex flex-col items-center justify-center p-3 bg-gray-900/40 border border-gray-800 rounded-xl hover:border-gray-750 hover:bg-gray-905/60 transition-all text-center"
                                            >
                                                <span className="text-[10px] font-bold text-gray-200">Data</span>
                                                <span className="text-[8px] text-gray-500 uppercase tracking-wider mt-0.5">Deletion</span>
                                            </a>
                                        )}
                                    </div>
                                </section>
                            )}
                        </>
                    )}
                </div>

                {/* Action Area */}
                <div className="p-4 bg-gray-900/30 border-t border-gray-900 flex flex-col gap-3 shrink-0">
                    {showConfirmSummary ? (
                        <>
                            <button
                                onClick={handleSave}
                                disabled={loading}
                                className="w-full py-3.5 bg-correct hover:bg-correct/85 active:scale-[0.98] text-black font-black text-sm rounded-xl transition-all shadow-lg shadow-correct/10 disabled:opacity-50"
                            >
                                {loading ? 'SYNCING...' : 'CONFIRM & SAVE'}
                            </button>
                            <button
                                onClick={() => setShowConfirmSummary(false)}
                                disabled={loading}
                                className="w-full py-3.5 bg-gray-900 border border-white/10 hover:bg-gray-800 text-white font-black text-sm rounded-xl transition-all"
                            >
                                BACK TO EDIT
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="flex gap-2 w-full">
                                <button
                                    onClick={handleReset}
                                    type="button"
                                    className="w-1/3 py-3.5 bg-gray-900 border border-white/10 hover:bg-gray-800 text-white font-black text-sm rounded-xl transition-all uppercase tracking-wider"
                                >
                                    Reset
                                </button>
                                <button
                                    onClick={() => {
                                        const changes = getChanges();
                                        if (changes.length === 0) {
                                            handleSave();
                                        } else {
                                            setShowConfirmSummary(true);
                                        }
                                    }}
                                    disabled={loading}
                                    className="w-2/3 py-3.5 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-indigo-900/20 disabled:opacity-50"
                                >
                                    SAVE PREFERENCES
                                </button>
                            </div>

                            <button
                                onClick={handleSignOut}
                                className="flex items-center justify-center gap-2 w-full py-2.5 text-gray-500 hover:text-red-400 text-[11px] font-bold transition-colors uppercase tracking-widest"
                            >
                                <LogOut size={12} />
                                Sign Out
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};