import { Gamepad2, Trophy, BarChart2, HelpCircle, MessageSquare } from 'lucide-react';

interface AppNavigationProps {
    activeItem: 'play' | 'chat' | 'leaderboard' | 'challenges' | 'info';
    onNavigate: (item: 'play' | 'chat' | 'leaderboard' | 'challenges' | 'info') => void;
    challengeUnreadCount: number;
    chatUnreadCount: number;
}

export const AppNavigation = ({
    activeItem,
    onNavigate,
    challengeUnreadCount,
    chatUnreadCount
}: AppNavigationProps) => {
    const navItems = [
        {
            id: 'play' as const,
            label: 'Play',
            icon: Gamepad2,
        },
        {
            id: 'chat' as const,
            label: 'Chat',
            icon: MessageSquare,
            badge: chatUnreadCount,
        },
        {
            id: 'leaderboard' as const,
            label: 'Leaderboard',
            icon: BarChart2,
        },
        {
            id: 'challenges' as const,
            label: 'Challenges',
            icon: Trophy,
            badge: challengeUnreadCount,
        },
        {
            id: 'info' as const,
            label: 'Rules',
            icon: HelpCircle,
        }
    ];

    return (
        <nav className="w-full z-[140] bg-dark border-t border-white/10 px-1 py-1.5 sm:self-center sm:mb-4 sm:rounded-2xl sm:border sm:border-white/10 sm:max-w-lg sm:px-6 sm:py-2 sm:shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] transition-all duration-300">
            <div className="flex items-center justify-around w-full max-w-lg mx-auto sm:max-w-none">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeItem === item.id;

                    return (
                        <button
                            key={item.id}
                            onClick={() => onNavigate(item.id)}
                            className="flex flex-col items-center justify-center gap-0.5 py-0.5 px-1 sm:px-3 rounded-xl transition-all duration-300 relative group cursor-pointer focus:outline-none min-w-[60px] sm:min-w-[72px]"
                        >
                            {/* Icon Wrapper with bounce-on-hover / active scale */}
                            <div
                                className={`transition-all duration-300 transform group-hover:scale-110 group-active:scale-95 ${isActive
                                    ? 'text-correct scale-110 drop-shadow-[0_0_8px_rgba(46,204,113,0.4)]'
                                    : 'text-gray-400 group-hover:text-white'
                                    }`}
                            >
                                <Icon size={18} className="stroke-[2.5]" />
                            </div>

                            {/* Badge */}
                            {item.badge !== undefined && item.badge > 0 && (
                                <span className={`absolute top-0.5 right-1.5 sm:right-3 text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-black animate-pulse ${item.id === 'chat'
                                    ? 'bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.8)] '
                                    : 'bg-correct text-black shadow-[0_0_10px_rgba(46,204,113,0.5)]'
                                    }`}>
                                    {item.id === "chat"? '*': item.badge}
                                </span>
                            )}

                            {/* Text label */}
                            <span
                                className={`text-[9px] uppercase font-black tracking-wider transition-colors duration-300 ${isActive
                                    ? 'text-white'
                                    : 'text-gray-500 group-hover:text-gray-300'
                                    }`}
                            >
                                {item.label}
                            </span>

                            {/* Active Indicator Line */}
                            {isActive && (
                                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-[2.5px] bg-correct rounded-full shadow-[0_0_6px_rgba(46,204,113,0.8)] animate-in fade-in zoom-in duration-300" />
                            )}
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};
