import { motion } from 'framer-motion';

interface TransitionLoaderProps {
    message: string;
}

export const TransitionLoader = ({ message }: TransitionLoaderProps) => {
    return (
        <div className="fixed inset-0 z-200 flex flex-col items-center justify-center bg-black/75 backdrop-blur-md transition-all duration-300">
            <div className="flex flex-col items-center gap-4 text-center">
                {/* Glowing Spinner Icon */}
                <div className="relative">
                    {/* Pulsing Outer Glow */}
                    <motion.div
                        animate={{ scale: [0.9, 1.1, 0.9], opacity: [0.4, 0.8, 0.4] }}
                        transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                        className="absolute inset-0 bg-correct/20 blur-xl rounded-full"
                    />
                    
                    {/* Ring Spinner */}
                    <div className="w-10 h-10 rounded-full border-4 border-correct/10 border-t-correct animate-spin" />
                </div>

                {/* Loading Message */}
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-correct animate-pulse mt-1 select-none">
                    {message}
                </p>
            </div>
        </div>
    );
};
