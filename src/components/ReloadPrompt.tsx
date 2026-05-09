import { useRegisterSW } from 'virtual:pwa-register/react';

export default function ReloadPrompt() {
    const {
        offlineReady: [offlineReady, setOfflineReady],
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) {
            console.log('SW Registered: ', r);
        },
        onRegisterError(error) {
            console.error('SW registration error', error);
        },
    });

    const close = () => {
        setOfflineReady(false);
        setNeedRefresh(false);
    };

    // Don't render anything if there's no update or offline readiness to show
    if (!offlineReady && !needRefresh) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 z-100 animate-in fade-in slide-in-from-bottom-5">
            <div className="p-4 bg-gray-900 border border-indigo-500/50 rounded-xl shadow-2xl backdrop-blur-md">
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                        <div className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-sm font-bold text-white">
                                {needRefresh ? 'Update Available' : 'App Ready Offline'}
                            </p>
                            <p className="text-xs text-gray-400">
                                {needRefresh
                                    ? 'A new version is ready. Click update to refresh.'
                                    : 'The game is now cached for offline play.'}
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        {needRefresh && (
                            <button
                                onClick={() => updateServiceWorker(true)}
                                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold rounded-lg transition-all"
                            >
                                Update Now
                            </button>
                        )}
                        <button
                            onClick={close}
                            className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium rounded-lg transition-all"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}