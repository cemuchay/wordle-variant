import { useApp } from '../../context/AppContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, X, CheckCircle2, AlertCircle, Info, Timer } from 'lucide-react';
import { useState } from 'react';

export const AudioConnectionLog = () => {
    const { audioChat, activeCall } = useApp();
    const [isVisible, setIsVisible] = useState(true);

    if (!activeCall || !isVisible) {
        if (!activeCall) return null;
        return (
            <button 
                onClick={() => setIsVisible(true)}
                className="fixed bottom-4 left-4 p-2 bg-black/40 backdrop-blur-md rounded-lg border border-white/10 text-gray-500 hover:text-white transition-all z-50"
                title="Show Connection Logs"
            >
                <Terminal size={14} />
            </button>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-4 left-4 w-72 max-h-60 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden flex flex-col shadow-2xl z-50 pointer-events-auto"
        >
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 bg-white/5">
                <div className="flex items-center gap-2">
                    <Terminal size={12} className="text-emerald-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/70">Audio Link Log</span>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={audioChat.clearLogs}
                        className="text-[9px] font-bold text-gray-500 hover:text-white transition-colors uppercase"
                    >
                        Clear
                    </button>
                    <button 
                        onClick={() => setIsVisible(false)}
                        className="text-gray-500 hover:text-white transition-colors"
                    >
                        <X size={12} />
                    </button>
                </div>
            </div>

            {/* Latest on top, sorted by timestamp to prevent jumbled order */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-hide">
                <AnimatePresence initial={false}>
                    {audioChat.logs
                        .slice()
                        .sort((a, b) => b.timestamp - a.timestamp)
                        .map((log) => (
                        <motion.div
                            key={log.timestamp + log.message}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-start gap-2 group"
                        >
                            <div className="mt-0.5 shrink-0">
                                {log.type === 'success' && <CheckCircle2 size={10} className="text-emerald-500" />}
                                {log.type === 'error' && <AlertCircle size={10} className="text-red-500" />}
                                {log.type === 'warning' && <Timer size={10} className="text-yellow-500" />}
                                {log.type === 'info' && <Info size={10} className="text-blue-400" />}
                            </div>
                            <div className="flex flex-col flex-1 min-w-0">
                                <span className={`text-[9px] leading-tight font-bold break-words ${
                                    log.type === 'success' ? 'text-emerald-400' :
                                    log.type === 'error' ? 'text-red-400' :
                                    log.type === 'warning' ? 'text-yellow-400' :
                                    'text-white/80'
                                }`}>
                                    {log.message}
                                </span>
                                <span className="text-[7px] text-white/20 font-mono mt-0.5">
                                    {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </span>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
                
                {audioChat.logs.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-4 text-center">
                        <Terminal size={20} className="text-white/5 mb-2" />
                        <span className="text-[9px] text-white/20 uppercase font-black tracking-tighter">Waiting for events...</span>
                    </div>
                )}
            </div>
            
            <div className="px-3 py-1.5 bg-emerald-500/5 border-t border-white/5 flex items-center justify-between">
                <span className="text-[8px] font-bold text-emerald-500/50 uppercase tracking-widest">
                    Status: {audioChat.isConnected ? 'Connected' : 'Syncing'}
                </span>
                <div className={`w-1.5 h-1.5 rounded-full ${audioChat.isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-yellow-500 animate-bounce'}`} />
            </div>
        </motion.div>
    );
};
