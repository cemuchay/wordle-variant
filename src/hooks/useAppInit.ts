import { useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '../store/useAppStore';

/**
 * Orchestrator hook that syncs Supabase Auth state with TanStack Query and Zustand.
 */
export const useAppInit = () => {
    const queryClient = useQueryClient();
    const setPreferences = useAppStore(state => state.setPreferences);

    useEffect(() => {
        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                // Invalidate profile query to refetch for new user
                queryClient.invalidateQueries({ queryKey: ['profile', session?.user.id] });
                queryClient.invalidateQueries({ queryKey: ['challenge-unread', session?.user.id] });
            } else if (event === 'SIGNED_OUT') {
                // Clear cache on logout
                queryClient.clear();
            }
        });

        return () => subscription.unsubscribe();
    }, [queryClient, setPreferences]);
};
