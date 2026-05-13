import { motion, AnimatePresence } from "framer-motion";

interface User {
    username: string;
    avatar_url: string;
}

interface UserSuggestionsProps {
    users: User[];
    filter: string;
    onSelect: (username: string) => void;
    isVisible: boolean;
}

const UserSuggestions = ({ users, filter, onSelect, isVisible, currentInput }: UserSuggestionsProps & { currentInput: string }) => {
    // Filter out users that are already mentioned
    const mentionedUsernames = currentInput.match(/@([\w\s]+)/g)?.map(m => m.substring(1)) || [];

    const filteredUsers = users.filter(user =>
        user.username.toLowerCase().includes(filter.toLowerCase()) &&
        !mentionedUsernames.includes(user.username)
    ).slice(0, 5);

    if (!isVisible || filteredUsers.length === 0) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-full left-4 mb-2 w-72 bg-[#233138] border border-white/5 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-2xl z-50"
            >
                <div className="p-3 border-b border-white/5 bg-white/5">
                    <p className="text-[10px] font-black text-[#8696a0] uppercase tracking-widest px-1">Mention a player</p>
                </div>
                <div className="max-h-56 overflow-y-auto py-1 scrollbar-hide">
                    {filteredUsers.map((user) => (
                        <motion.button
                            key={user.username}
                            whileHover={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}
                            onClick={() => onSelect(user.username)}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-white/2 last:border-none"
                        >
                            <img src={user.avatar_url} className="w-9 h-9 rounded-full border border-white/10" alt={user.username} />
                            <div>
                                <p className="text-[14px] font-bold text-[#e9edef]">@{user.username}</p>
                                <p className="text-[10px] text-[#8696a0]">Player</p>
                            </div>
                        </motion.button>
                    ))}
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default UserSuggestions;
