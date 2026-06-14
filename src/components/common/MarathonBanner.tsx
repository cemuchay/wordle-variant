import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

interface MarathonBannerProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    challenge: any;
    onClick: () => void;
    className?: string;
    showTimer?: boolean;
}

const DAILY_CONFIG = [
    { // Sunday
        bg: 'from-rose-500/20 via-pink-500/20 to-rose-600/20',
        border: 'border-rose-500/30',
        hoverBorder: 'hover:border-rose-400/50',
        accent: 'bg-rose-500',
        textAccent: 'text-rose-400',
        title: 'Sunday Sprint 🏃‍♂️',
        description: 'End your week with a marathon victory!'
    },
    { // Monday
        bg: 'from-indigo-600/20 via-blue-600/20 to-indigo-700/20',
        border: 'border-indigo-500/30',
        hoverBorder: 'hover:border-indigo-400/50',
        accent: 'bg-indigo-500',
        textAccent: 'text-indigo-400',
        title: 'Monday Motivation 🔋',
        description: 'Start your week strong with a challenge!'
    },
    { // Tuesday
        bg: 'from-emerald-500/20 via-teal-500/20 to-emerald-600/20',
        border: 'border-emerald-500/30',
        hoverBorder: 'hover:border-emerald-400/50',
        accent: 'bg-emerald-500',
        textAccent: 'text-emerald-400',
        title: 'Turbo Tuesday ⚡',
        description: 'Pick up the pace in today\'s marathon!'
    },
    { // Wednesday
        bg: 'from-amber-500/20 via-orange-500/20 to-amber-600/20',
        border: 'border-amber-500/30',
        hoverBorder: 'hover:border-amber-400/50',
        accent: 'bg-amber-500',
        textAccent: 'text-amber-400',
        title: 'Mid-Week Marathon 🐫',
        description: 'Conquer the hump with a winning streak!'
    },
    { // Thursday
        bg: 'from-purple-600/20 via-fuchsia-600/20 to-purple-700/20',
        border: 'border-purple-500/30',
        hoverBorder: 'hover:border-purple-400/50',
        accent: 'bg-purple-500',
        textAccent: 'text-purple-400',
        title: 'Thriving Thursday 🚀',
        description: 'Push your limits in the daily event!'
    },
    { // Friday
        bg: 'from-cyan-500/20 via-blue-500/20 to-cyan-600/20',
        border: 'border-cyan-500/30',
        hoverBorder: 'hover:border-cyan-400/50',
        accent: 'bg-cyan-500',
        textAccent: 'text-cyan-400',
        title: 'Friday Flash ⚡',
        description: 'Finish the work week with a bang!'
    },
    { // Saturday
        bg: 'from-yellow-500/20 via-amber-500/20 to-yellow-600/20',
        border: 'border-yellow-500/30',
        hoverBorder: 'hover:border-yellow-400/50',
        accent: 'bg-yellow-500',
        textAccent: 'text-yellow-400',
        title: 'Weekend Warrior ⚔️',
        description: 'The ultimate marathon for the weekend!'
    }
];

export const MarathonBanner = ({ challenge, onClick, className, showTimer = true }: MarathonBannerProps) => {
    const [timeLeft, setTimeLeft] = useState<string>('');
    const dayIndex = new Date().getDay();
    const config = DAILY_CONFIG[dayIndex];

    useEffect(() => {
        const expiresAtStr = challenge?.expires_at || challenge?.challenge?.expires_at;
        if (!expiresAtStr) return;

        const calculateTimeLeft = () => {
            const expiresAt = new Date(expiresAtStr).getTime();
            const now = new Date().getTime();
            const difference = expiresAt - now;

            if (difference <= 0) {
                setTimeLeft('Expired');
                return;
            }

            const days = Math.floor(difference / (1000 * 60 * 60 * 24));
            const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));

            const parts = [];
            if (days > 0) parts.push(`${days}d`);
            if (hours > 0 || days > 0) parts.push(`${hours}h`);
            if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`);

            setTimeLeft(parts.join(' '));
        };

        calculateTimeLeft();
        const timer = setInterval(calculateTimeLeft, 60000);

        return () => clearInterval(timer);
    }, [challenge]);

    return (
        <motion.button
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            className={`w-full text-left bg-linear-to-r ${config.bg} border ${config.border} p-1.5 sm:p-2 px-2 sm:px-4 rounded-2xl ${config.hoverBorder} transition-all duration-300 relative overflow-hidden flex flex-col gap-3 shadow-xl backdrop-blur-md group cursor-pointer ${className}`}
        >
            <div className={`absolute top-0 right-0 h-16 w-36 bg-white/5 blur-3xl -mr-12 -mt-12 pointer-events-none group-hover:bg-white/10 transition-colors duration-500`} />

            <div className="flex items-center justify-between w-full relative z-10">
                <div className="flex items-center gap-2">
                    <span className={`flex items-center gap-1.5 px-0.5 sm:px-2.5 py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest ${config.accent} text-white border border-white/10 shadow-[0_0_10px_rgba(255,255,255,0.1)]`}>
                        <Sparkles size={12} className="animate-pulse" />
                        Daily Marathon
                    </span>
                    {showTimer && timeLeft && (
                        <span className="text-[11px] text-white/60 font-medium">
                            {timeLeft !== 'Expired' ? (
                                <>Ends in <span className={`${config.textAccent} font-black tabular-nums`}>{timeLeft}</span></>
                            ) : (
                                <span className="text-rose-400 font-black">Expired</span>
                            )}
                        </span>
                    )}
                </div>
                <span className="text-[10px] font-black text-white/30 uppercase tracking-wider font-mono">
                    Host: Variant Bot
                </span>
            </div>

            <div className="relative z-10 flex flex-col">
                <h3 className="text-base font-black text-white uppercase tracking-tight group-hover:translate-x-1 transition-transform duration-300 flex items-center gap-2">
                    {config.title}
                </h3>
                <div className="flex items-end justify-between gap-4">
                    <p className="text-[11px] text-white/50 mt-0.5 font-medium leading-relaxed">
                        {config.description}
                    </p>
                    <span className={`text-[10px] font-black uppercase tracking-wider ${config.textAccent} flex items-center gap-1 group-hover:gap-2 transition-all shrink-0 mb-0.5`}>
                        Play Now &rarr;
                    </span>
                </div>
            </div>


        </motion.button>
    );
};
