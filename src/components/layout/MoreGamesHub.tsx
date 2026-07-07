import { Swords, Trophy, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

interface MoreGamesHubProps {
    onSelectGame: (game: 'wordup' | 'challenges') => void;
    challengeUnreadCount: number;
    wordupUnreadCount: number;
}

export const MoreGamesHub = ({
    onSelectGame,
    challengeUnreadCount,
    wordupUnreadCount
}: MoreGamesHubProps) => {
    const games = [
        {
            id: 'wordup' as const,
            title: 'WordUp Battle',
            description: 'Compete in fast-paced real-time trivia or async turn-based word battles.',
            icon: Swords,
            badge: wordupUnreadCount,
            colorClass: 'from-correct/20 to-correct/5 border-correct/30 text-correct shadow-correct/10',
            iconBg: 'bg-correct/10 border-correct/20 text-correct',
            btnBg: 'bg-correct text-black hover:bg-correct/90'
        },
        {
            id: 'challenges' as const,
            title: 'Challenges',
            description: 'Create custom lobby challenges against friends or practice against bots in Marathon mode.',
            icon: Trophy,
            badge: challengeUnreadCount,
            colorClass: 'from-indigo-500/20 to-indigo-500/5 border-indigo-500/30 text-indigo-400 shadow-indigo-500/10',
            iconBg: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
            btnBg: 'bg-indigo-600 text-white hover:bg-indigo-500'
        }
    ];

    return (
        <div className="h-full w-full flex flex-col justify-start items-center p-4 overflow-y-auto bg-dark select-none max-w-lg mx-auto">
            {/* Header section */}
            <div className="w-full text-center py-6 space-y-2 shrink-0">
                <h2 className="text-xl font-black uppercase tracking-wider text-white">More Game Modes</h2>
                <p className="text-xs text-gray-400 max-w-xs mx-auto">
                    Challenge your mind and friends in other competitive multiplayer modes.
                </p>
            </div>

            {/* Games grid/stack */}
            <div className="w-full flex-1 flex flex-col gap-4 py-2">
                {games.map((game, index) => {
                    const Icon = game.icon;

                    return (
                        <motion.div
                            key={game.id}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1, duration: 0.3 }}
                            onClick={() => onSelectGame(game.id)}
                            className={`w-full flex flex-col p-5 rounded-3xl bg-linear-to-b border shadow-xl relative cursor-pointer group transition-all duration-300 hover:-translate-y-1 hover:bg-white/5 ${game.colorClass}`}
                        >
                            {/* Card Top: Icon & Badge */}
                            <div className="flex justify-between items-start w-full mb-3">
                                <div className={`p-3 rounded-2xl border ${game.iconBg}`}>
                                    <Icon size={24} className="stroke-[2.5]" />
                                </div>

                                {game.badge > 0 && (
                                    <span className="bg-red-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full border border-black shadow-[0_0_12px_rgba(239,68,68,0.6)] animate-pulse">
                                        {game.badge} {game.badge === 1 ? 'INVITE' : 'INVITES'}
                                    </span>
                                )}
                            </div>

                            {/* Card Content */}
                            <div className="flex-1 space-y-1 pr-4">
                                <h3 className="text-base font-black uppercase tracking-wider text-white group-hover:text-correct transition-colors duration-300">
                                    {game.title}
                                </h3>
                                <p className="text-xs text-gray-400 leading-relaxed font-medium">
                                    {game.description}
                                </p>
                            </div>

                            {/* Action Indicator Row */}
                            <div className="flex items-center justify-between w-full mt-4 pt-3 border-t border-white/5">
                                <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 group-hover:text-gray-300 transition-colors duration-300">
                                    Launch Game
                                </span>
                                <div className={`p-1.5 rounded-xl transition-all duration-300 ${game.iconBg} group-hover:translate-x-1`}>
                                    <ChevronRight size={14} className="stroke-3" />
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
};
