/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Trophy, Swords, Users } from 'lucide-react';
import formatUsername from '../../utils/formatUsername';

interface MarathonBannerProps {
    challenges: any[];
    onClick: (challenge: any) => void;
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

const URGENT_CONFIG = {
    bg: 'from-red-600/30 via-rose-600/30 to-red-700/30',
    border: 'border-red-500/40',
    hoverBorder: 'hover:border-red-400/60',
    accent: 'bg-red-600',
    textAccent: 'text-red-400',
    title: 'Ending Soon! 🔥',
    description: 'Today\'s marathon is about to expire. Join the race before it\'s too late!'
};

const BannerItem = ({ challenge, onClick, showTimer, navigation }: { challenge: any, onClick: (c: any) => void, showTimer: boolean, navigation?: React.ReactNode }) => {
    const [timeLeft, setTimeLeft] = useState<string>('');
    const [isUrgent, setIsUrgent] = useState(false);
    const dayIndex = new Date().getDay();
    const config = isUrgent ? URGENT_CONFIG : DAILY_CONFIG[dayIndex];

    useEffect(() => {
        const expiresAtStr = challenge?.expires_at || challenge?.challenge?.expires_at;
        if (!expiresAtStr) return;

        const calculateTimeLeft = () => {
            const expiresAt = new Date(expiresAtStr).getTime();
            const now = new Date().getTime();
            const difference = expiresAt - now;

            if (difference <= 0) {
                setTimeLeft('Expired');
                setIsUrgent(false);
                return;
            }

            const hoursLeft = difference / (1000 * 60 * 60);
            setIsUrgent(hoursLeft < 18);

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

    const participants = challenge?.challenge?.participants || [];

    const participantCount = participants.length;
    const gamesPlayed = participants.reduce((sum: number, p: any) => {
        return sum + (p.marathon_progress?.filter((g: any) => g.status === 'completed' || g.status === 'timed_out').length || 0);
    }, 0);
    const leader = [...participants].filter((p: any) => p.profiles?.username).sort((a: any, b: any) => (b.score || 0) - (a.score || 0))[0];

    return (
        <div
            onClick={() => onClick(challenge)}
            className={`w-full text-left bg-linear-to-r ${config.bg} border ${config.border} p-3 sm:p-4 rounded-2xl ${config.hoverBorder} transition-all duration-300 relative overflow-hidden flex flex-col gap-3 shadow-xl backdrop-blur-md group cursor-pointer`}
        >
            <div className={`absolute top-0 right-0 h-16 w-36 bg-white/5 blur-3xl -mr-12 -mt-12 pointer-events-none group-hover:bg-white/10 transition-colors duration-500`} />

            <div className="flex items-center justify-between w-full relative z-10">
                <div className="flex items-center gap-2">
                    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest ${config.accent} text-white border border-white/10 shadow-[0_0_10px_rgba(255,255,255,0.1)]`}>
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
                {navigation ? navigation : (
                    <span className=" text-[8px] sm:text-[10px] font-black text-white/30 uppercase tracking-wider font-mono">
                        Host: Variant Bot
                    </span>
                )}
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
                {participantCount > 0 && (
                    <div className="flex items-center gap-3 text-[10px] text-white/30 mt-1">
                        {leader && leader.score > 0 && (
                            <span className="flex items-center gap-1 text-white">
                                <Trophy size={11} className={config.textAccent} />
                                <span className="font-medium text-white uppercase">{formatUsername(leader.profiles.username)}</span>
                                <span className="font-black tabular-nums">{leader.score}</span>
                            </span>
                        )}
                        <span className="flex items-center gap-1 text-white">
                            <Swords size={11} />
                            <span className="font-black tabular-nums">{gamesPlayed}</span>
                            <span className="text-white/20">games</span>
                        </span>
                        <span className="flex items-center gap-1 text-white">
                            <Users size={11} />
                            <span className="font-black tabular-nums">{participantCount}</span>

                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

export const MarathonBanner = ({ challenges, onClick, className, showTimer = true }: MarathonBannerProps) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [direction, setDirection] = useState(0);

    const sortedChallenges = useMemo(() => {
        return [...challenges].sort((a, b) => {
            const dateA = new Date(a.expires_at || a.challenge?.expires_at).getTime();
            const dateB = new Date(b.expires_at || b.challenge?.expires_at).getTime();
            return dateA - dateB;
        });
    }, [challenges]);

    const paginate = (newDirection: number) => {
        setDirection(newDirection);
        setCurrentIndex((prev) => (prev + newDirection + sortedChallenges.length) % sortedChallenges.length);
    };

    if (sortedChallenges.length === 0) return null;

    const navigationUI = sortedChallenges.length > 1 ? (
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            <div className="bg-black/40 backdrop-blur-sm px-1.5 py-0.5 rounded-md border border-white/10 flex items-center gap-1">
                <span className="text-[9px] font-black text-white/90">
                    {currentIndex + 1}/{sortedChallenges.length}
                </span>
            </div>
            <div className="flex gap-1">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        paginate(-1);
                    }}
                    className="w-5 h-5 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-full border border-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
                >
                    &larr;
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        paginate(1);
                    }}
                    className="w-5 h-5 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-full border border-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
                >
                    &rarr;
                </button>
            </div>
        </div>
    ) : undefined;

    const variants = {
        enter: (direction: number) => ({
            opacity: 0,
            x: direction > 0 ? 100 : -100,
            filter: 'blur(10px)'
        }),
        center: {
            opacity: 1,
            x: 0,
            filter: 'blur(0px)'
        },
        exit: (direction: number) => ({
            opacity: 0,
            x: direction > 0 ? -100 : 100,
            filter: 'blur(10px)'
        })
    };

    return (
        <div className={`relative w-full overflow-hidden ${className}`}>
            <AnimatePresence mode="popLayout" initial={false} custom={direction}>
                <motion.div
                    key={sortedChallenges[currentIndex].id || sortedChallenges[currentIndex].challenge?.id}
                    custom={direction}
                    variants={variants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 30,
                        opacity: { duration: 0.2 }
                    }}
                    drag={sortedChallenges.length > 1 ? "x" : false}
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.7}
                    onDragEnd={(_, info) => {
                        if (info.offset.x < -50) {
                            paginate(1);
                        } else if (info.offset.x > 50) {
                            paginate(-1);
                        }
                    }}
                    className="w-full touch-pan-y"
                >
                    <BannerItem
                        challenge={sortedChallenges[currentIndex]}
                        onClick={onClick}
                        showTimer={showTimer}
                        navigation={navigationUI}
                    />
                </motion.div>
            </AnimatePresence>
        </div>
    );
};
