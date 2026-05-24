import { useEffect, useState } from 'react';
import { Mail, CheckCircle, AlertTriangle, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

export const UnsubscribePage = () => {
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('Unsubscribing you from email notifications...');

    useEffect(() => {
        const performUnsubscribe = async () => {
            try {
                const params = new URLSearchParams(window.location.search);
                const userId = params.get('user_id');

                if (!userId) {
                    setStatus('error');
                    setMessage('Invalid unsubscribe link. Missing user identifier.');
                    return;
                }

                // Call security definer RPC to unsubscribe target user_id anonymously
                const { error } = await supabase.rpc('unsubscribe_user', {
                    target_user_id: userId
                });

                if (error) {
                    throw error;
                }

                setStatus('success');
                setMessage('You have been successfully unsubscribed from all email notifications.');
            } catch (err: any) {
                console.error('Unsubscribe failed:', err);
                setStatus('error');
                setMessage(err.message || 'An error occurred while updating your subscription preferences.');
            }
        };

        performUnsubscribe();
    }, []);

    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
            {/* Backdrop Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />

            {/* Main Content Box */}
            <div className="relative w-full max-w-md bg-gray-950 border border-gray-800 rounded-3xl shadow-2xl p-8 text-center space-y-6 overflow-hidden animate-in fade-in zoom-in duration-500">
                {/* Header Accent */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-indigo-600" />

                {/* Icons based on status */}
                <div className="flex justify-center">
                    {status === 'loading' && (
                        <div className="p-4 bg-gray-900 border border-gray-800 rounded-2xl animate-pulse">
                            <Mail size={40} className="text-gray-400" />
                        </div>
                    )}
                    {status === 'success' && (
                        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl animate-in zoom-in duration-300">
                            <CheckCircle size={40} className="text-green-400" />
                        </div>
                    )}
                    {status === 'error' && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl animate-in shake duration-300">
                            <AlertTriangle size={40} className="text-red-400" />
                        </div>
                    )}
                </div>

                {/* Text Messages */}
                <div className="space-y-2">
                    <h1 className="text-xl font-black uppercase tracking-tight">
                        {status === 'loading' && 'Processing Request'}
                        {status === 'success' && 'Unsubscribed'}
                        {status === 'error' && 'Unsubscribe Failed'}
                    </h1>
                    <p className="text-xs text-gray-400 leading-relaxed px-4">
                        {message}
                    </p>
                </div>

                {/* Back to Game Button */}
                <div className="pt-4">
                    <button
                        onClick={() => { window.location.href = '/'; }}
                        className="inline-flex items-center gap-2 px-5 py-3 bg-gray-900 hover:bg-gray-800 active:scale-[0.98] border border-gray-800 hover:border-gray-700 text-xs font-black uppercase tracking-widest text-gray-300 hover:text-white rounded-xl transition-all"
                    >
                        <ArrowLeft size={14} />
                        Back to Wordle Variant
                    </button>
                </div>
            </div>
        </div>
    );
};
