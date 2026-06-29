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
        // Prefetch non-critical queries during browser idle time
        const idleCallback = () => {
            if ('requestIdleCallback' in window) {
                (window as any).requestIdleCallback(() => {
                    queryClient.prefetchQuery({ queryKey: ['discover-challenges'] });
                    queryClient.prefetchQuery({ queryKey: ['profiles'] });
                }, { timeout: 3000 });
            } else {
                setTimeout(() => {
                    queryClient.prefetchQuery({ queryKey: ['discover-challenges'] });
                    queryClient.prefetchQuery({ queryKey: ['profiles'] });
                }, 2000);
            }
        };

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

        // Check if user is already signed in and schedule idle prefetch
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                idleCallback();
            }
        });

        return () => subscription.unsubscribe();
    }, [queryClient, setPreferences]);
};
