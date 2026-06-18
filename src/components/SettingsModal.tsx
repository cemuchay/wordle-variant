import { useState, useEffect } from 'react';
import { X, ShieldCheck, MessageSquareQuote, LogOut, Terminal, Mail, FileText, Bell, Download, ChevronUp, ChevronDown, Layout } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useApp } from '../context/AppContext';
import { useAuth } from '../hooks/useAuth';
import { useConfirmation } from '../hooks/useConfirmation';
import { logger } from '../lib/logger';
import { subscribeToPush, unsubscribeFromPush } from '../lib/pushService';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useAppStore } from '../store/useAppStore';

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
    const [navOrder, setNavOrder] = useState<string[]>(preferences.navOrder || ["play", "chat", "leaderboard", "challenges", "wordup"]);
    const [receiveEmails, setReceiveEmails] = useState(true);
    const [pushSupported, setPushSupported] = useState(false);
    const [pushEnabled, setPushEnabled] = useState(false);
    const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');

    const { isStandalone, handleInstall, isInstalling, isIOS } = usePWAInstall();
    const [showIOSInstallInstructions, setShowIOSInstallInstructions] = useState(false);

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

    // Sync internal state when preferences change
    useEffect(() => {
        setAllowRoasts(preferences.allowRoasts);
        setCompactMode(preferences.compactMode);
        setNavOrder(preferences.navOrder || ["play", "chat", "leaderboard", "challenges", "wordup"]);
    }, [preferences]);

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

    const moveNavItem = (index: number, direction: 'up' | 'down') => {
        const newOrder = [...navOrder];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= newOrder.length) return;

        const [moved] = newOrder.splice(index, 1);
        newOrder.splice(targetIndex, 0, moved);
        setNavOrder(newOrder);
    };

    const handleSave = async () => {
        setLoading(true);

        const newPreferences = {
            ...(profile?.preferences || preferences),
            allowRoasts,
            compactMode,
            navOrder,
        };

        // Update store directly for immediate effect and anonymous support
        useAppStore.getState().setPreferences(newPreferences);

        let success = true;

        if (profile?.id) {
            const { error } = await supabase
                .from('profiles')
                .update({
                    preferences: newPreferences
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
                console.error("[Settings] Failed to sync preferences to Supabase:", error);
            } else {
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

    const navItemLabels: Record<string, string> = {
        play: 'Play',
        chat: 'Chat',
        leaderboard: 'Leaderboard',
        challenges: 'Challenges',
        wordup: 'WordUp'
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-150 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-md bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] sm:max-h-[90vh] animate-in slide-in-from-bottom-8 duration-300">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-900 bg-gray-900/20 shrink-0">
                    <h2 className="text-lg font-black text-white tracking-tight">Settings</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-800 rounded-full transition-colors text-gray-500 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-8 overflow-y-auto custom-scrollbar flex-1">
                    {/* Security & Identity (Private Data) */}
                    <section className="space-y-3">
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

                    {/* Gameplay Preferences */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 mb-1">
                            <MessageSquareQuote size={14} className="text-indigo-400" />
                            <label className="text-[10px] uppercase font-black text-gray-500 tracking-widest">
                                Gameplay Experience
                            </label>
                        </div>

                        <div className="space-y-3">
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
                        </div>
                    </section>

                    {/* Email Notifications Preferences */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Mail size={14} className="text-indigo-400" />
                            <label className="text-[10px] uppercase font-black text-gray-500 tracking-widest">
                                Email Notifications
                            </label>
                        </div>

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
                    </section>

                    {/* Push Notifications Preferences */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Bell size={14} className="text-indigo-400" />
                            <label className="text-[10px] uppercase font-black text-gray-500 tracking-widest">
                                Push Notifications
                            </label>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-gray-900/40 border border-gray-800 rounded-xl transition-colors hover:border-gray-700">
                            <div className="flex-1 pr-4">
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-bold text-gray-100">Live Push Updates</p>
                                    {pushSupported && (
                                        <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider ${
                                            pushPermission === 'granted' && pushEnabled
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
                                    className={`w-12 h-6 rounded-full transition-all duration-300 relative ${
                                        pushEnabled && pushPermission === 'granted'
                                            ? 'bg-indigo-600 shadow-[0_0_12px_rgba(79,70,229,0.3)]'
                                            : 'bg-gray-800'
                                    }`}
                                >
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm ${
                                        pushEnabled && pushPermission === 'granted' ? 'left-7' : 'left-1'
                                    }`} />
                                </button>
                            )}
                        </div>
                    </section>

                    {/* App Installation (PWA) */}
                    {!isStandalone && (
                        <section className="space-y-4">
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

                    {/* Navigation Layout */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Layout size={14} className="text-indigo-400" />
                            <label className="text-[10px] uppercase font-black text-gray-500 tracking-widest">
                                Navigation Layout
                            </label>
                        </div>

                        <div className="space-y-2">
                            {navOrder.map((id, index) => (
                                <div key={id} className="flex items-center justify-between p-3 bg-gray-900/40 border border-gray-800 rounded-xl">
                                    <span className="text-sm font-bold text-gray-200">
                                        {navItemLabels[id]}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => moveNavItem(index, 'up')}
                                            disabled={index === 0}
                                            className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-500 hover:text-white transition-colors disabled:opacity-20"
                                        >
                                            <ChevronUp size={16} />
                                        </button>
                                        <button
                                            onClick={() => moveNavItem(index, 'down')}
                                            disabled={index === navOrder.length - 1}
                                            className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-500 hover:text-white transition-colors disabled:opacity-20"
                                        >
                                            <ChevronDown size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p className="text-[10px] text-gray-600 px-1 italic">
                            Customize the order of your bottom navigation tabs.
                        </p>
                    </section>

                    {/* Debugging & Diagnostics */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Terminal size={14} className="text-indigo-400" />
                            <label className="text-[10px] uppercase font-black text-gray-500 tracking-widest">
                                Diagnostics
                            </label>
                        </div>

                        <div className="flex flex-col gap-3">
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
                        </div>
                    </section>

                    {/* Legal & Policies */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 mb-1">
                            <FileText size={14} className="text-indigo-400" />
                            <label className="text-[10px] uppercase font-black text-gray-500 tracking-widest">
                                Legal & Policies
                            </label>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            <a
                                href="/privacy.html"
                                className="flex flex-col items-center justify-center p-3 bg-gray-900/40 border border-gray-800 rounded-xl hover:border-gray-750 hover:bg-gray-905/60 transition-all text-center"
                            >
                                <span className="text-[10px] font-bold text-gray-200">Privacy</span>
                                <span className="text-[8px] text-gray-500 uppercase tracking-wider mt-0.5">Policy</span>
                            </a>
                            <a
                                href="/tos.html"
                                className="flex flex-col items-center justify-center p-3 bg-gray-900/40 border border-gray-800 rounded-xl hover:border-gray-750 hover:bg-gray-905/60 transition-all text-center"
                            >
                                <span className="text-[10px] font-bold text-gray-200">Terms</span>
                                <span className="text-[8px] text-gray-500 uppercase tracking-wider mt-0.5">of Service</span>
                            </a>
                            <a
                                href="/deletion.html"
                                className="flex flex-col items-center justify-center p-3 bg-gray-900/40 border border-gray-800 rounded-xl hover:border-gray-750 hover:bg-gray-905/60 transition-all text-center"
                            >
                                <span className="text-[10px] font-bold text-gray-200">Data</span>
                                <span className="text-[8px] text-gray-500 uppercase tracking-wider mt-0.5">Deletion</span>
                            </a>
                        </div>
                    </section>
                </div>

                {/* Action Area */}
                <div className="p-4 bg-gray-900/30 border-t border-gray-900 flex flex-col gap-3 shrink-0">
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-indigo-900/20 disabled:opacity-50"
                    >
                        {loading ? 'SYNCING...' : 'SAVE PREFERENCES'}
                    </button>

                    <button
                        onClick={handleSignOut}
                        className="flex items-center justify-center gap-2 w-full py-2.5 text-gray-500 hover:text-red-400 text-[11px] font-bold transition-colors uppercase tracking-widest"
                    >
                        <LogOut size={12} />
                        Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
};