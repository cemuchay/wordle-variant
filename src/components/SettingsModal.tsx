import { useState, useEffect } from 'react';
import { X, ShieldCheck, MessageSquareQuote, LogOut, Terminal, Mail, FileText } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useApp } from '../context/AppContext';
import { useAuth } from '../hooks/useAuth';
import { useConfirmation } from '../hooks/useConfirmation';
import { logger } from '../lib/logger';

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
    const [receiveEmails, setReceiveEmails] = useState(true);

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
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAllowRoasts(preferences.allowRoasts);
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
            
            fetchAuthData();
            fetchEmailPreferences();
        }
    }, [isOpen, profile?.id]);

    const handleSave = async () => {
        setLoading(true);
        const { error } = await supabase
            .from('profiles')
            .update({
                preferences: {
                    ...profile.preferences,
                    allowRoasts: allowRoasts,
                }
            })
            .eq('id', profile.id);

        if (profile?.id) {
            await supabase
                .from('email_preferences')
                .upsert({
                    user_id: profile.id,
                    receive_emails: receiveEmails,
                    updated_at: new Date().toISOString(),
                });
        }

        if (!error) {
            await refreshProfile();
            triggerToast('Preferences Updated')
            onClose();
        }
        setLoading(false);
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

                    {/* Debugging & Diagnostics */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Terminal size={14} className="text-indigo-400" />
                            <label className="text-[10px] uppercase font-black text-gray-500 tracking-widest">
                                Diagnostics
                            </label>
                        </div>

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