/* eslint-disable @typescript-eslint/no-explicit-any */

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';

interface UserPreferences {
    allowRoasts: boolean;
    theme: 'dark' | 'light';
    compactMode: boolean;
}

interface AppContextType {
    profile: any | null;
    preferences: UserPreferences;
    loading: boolean;
    refreshProfile: () => Promise<void>;
    toast: {
        show: boolean, message: string, duration: number | undefined
    };
    triggerToast: ((msg: string, duration?: number) => any);
    setToast:any
}

const defaultPreferences: UserPreferences = {
    allowRoasts: true,
    theme: 'dark',
    compactMode: false,
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
    const [profile, setProfile] = useState<any | null>(null);
    const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
    const [loading, setLoading] = useState(true);

    const [toast, setToast] = useState<{
        show: boolean, message: string, duration: number | undefined
    }>({ show: false, message: "", duration: undefined });

    const triggerToast = (msg: string, duration?: number) => setToast({ show: true, message: msg, duration: duration });

    const fetchProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLoading(false);
                return;
            }

            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (!error && data) {
                setProfile(data);
                // Merge DB preferences with defaults to handle missing keys
                setPreferences({
                    ...defaultPreferences,
                    ...(data.preferences as object),
                });
            }
        } catch (err) {
            console.error('Error fetching profile:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchProfile();

        // Listen for Auth changes (Sign In / Sign Out)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
            fetchProfile();
        });

        return () => subscription.unsubscribe();
    }, []);

    return (
        <AppContext.Provider value={{
            profile,
            preferences,
            loading,
            refreshProfile: fetchProfile,
            toast,
            triggerToast,
            setToast,

        }}>
            {children}
        </AppContext.Provider>
    );
};

// Custom hook for easy access
// eslint-disable-next-line react-refresh/only-export-components
export const useApp = () => {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useApp must be used within an AppProvider');
    }
    return context;
};