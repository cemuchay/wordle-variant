import { SettingsIcon } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useConfirmation } from '../../hooks/useConfirmation';

interface AppHeaderProps {
    onOpenSettings: () => void;
}

export const AppHeader = ({ onOpenSettings }: AppHeaderProps) => {
    const { user, signInWithGoogle, signOut } = useAuth();
    const { ask } = useConfirmation();

    const handleSignOut = async () => {
        const confirmed = await ask({
            title: 'Sign Out',
            message: 'Are you sure you want to sign out? Your local game state and statistics will be cleared.',
            confirmLabel: 'Sign Out',
            type: 'danger'
        });

        if (confirmed) {
            signOut();
        }
    };

    return (
        <div className="w-full max-w-lg mx-auto flex flex-col gap-3 mb-4">
            <div className="flex items-center justify-between relative h-10">
                <div className="flex items-center gap-2 absolute left-0 top-1/2 -translate-y-1/2 sm:relative sm:top-auto sm:translate-y-0">
                    <div className="bg-correct/10 px-3 py-1 rounded-full border border-correct/20">
                        <h1 className="text-lg font-black uppercase tracking-[0.2em] text-white">
                            Wordle Variant<span className="text-correct">.</span>
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-3 absolute right-0 top-1/2 -translate-y-1/2 sm:relative sm:top-auto sm:translate-y-0">
                    {user ? (
                        <div className="flex items-center gap-2 bg-white/5 pl-1 pr-3 py-1 rounded-full border border-white/10 group relative">
                            <img
                                src={user.user_metadata.avatar_url}
                                alt="Profile"
                                className="w-6 h-6 rounded-full border border-white/10"
                            />
                            <span className="text-[10px] font-black uppercase text-gray-400">
                                {user.user_metadata.full_name?.split(' ')[0]}
                            </span>
                            <button
                                onClick={handleSignOut}
                                className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-red-500 text-[9px] font-black px-3 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap"
                            >
                                LOGOUT
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={signInWithGoogle}
                            className="text-[10px] font-black bg-white text-black px-4 py-1.5 rounded-full uppercase tracking-widest hover:bg-gray-200 transition-colors"
                        >
                            Login
                        </button>
                    )}

                    <button onClick={onOpenSettings} className="text-gray-500 hover:text-white transition-colors">
                        <SettingsIcon size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};
