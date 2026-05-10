import { useState, useEffect } from 'react';
import { X, ShieldCheck, MessageSquareQuote, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useApp } from '../context/AppContext';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SettingsModal = ({ isOpen, onClose, }: SettingsModalProps) => {
    const { profile, preferences, refreshProfile, triggerToast } = useApp();
    const [loading, setLoading] = useState(false);
    const [userEmail, setUserEmail] = useState<string>('');
    const [allowRoasts, setAllowRoasts] = useState(preferences.allowRoasts);

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
            fetchAuthData();
        }
    }, [isOpen]);

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

        if (!error) {
            await refreshProfile();
            triggerToast('Preferences Updated')
            onClose();
        }
        setLoading(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-150 flex items-end sm:items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-md bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 duration-300">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-900 bg-gray-900/20">
                    <h2 className="text-lg font-black text-white tracking-tight">Settings</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-800 rounded-full transition-colors text-gray-500 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-8">
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
                </div>

                {/* Action Area */}
                <div className="p-4 bg-gray-900/30 border-t border-gray-900 flex flex-col gap-3">
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-indigo-900/20 disabled:opacity-50"
                    >
                        {loading ? 'SYNCING...' : 'SAVE PREFERENCES'}
                    </button>

                    <button
                        onClick={() => supabase.auth.signOut()}
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