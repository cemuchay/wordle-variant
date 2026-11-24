import { useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '../store/useAppStore';
import { getSharedAuthSession } from './useAuth';
import { bootOrchestrator } from '../services/bootOrchestrator';
import { clearTrustedDeviceStamp, saveTrustedDeviceStamp } from '../utils/trustedDevice';

/**
 * Orchestrator hook that syncs Supabase Auth state with TanStack Query, Zustand, and BootOrchestrator.
 */
export const useAppInit = () => {
    const queryClient = useQueryClient();
    const setPreferences = useAppStore(state => state.setPreferences);

    useEffect(() => {
        // Stage 0: Seed hot cache synchronously on mount
        bootOrchestrator.seedHotCacheSync(queryClient);

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                if (session?.user) {
                    saveTrustedDeviceStamp({
                        isAuthenticated: true,
                        user: {
                            id: session.user.id,
                            email: session.user.email,
                            user_metadata: session.user.user_metadata,
                            app_metadata: session.user.app_metadata,
                            aud: session.user.aud,
                            created_at: session.user.created_at,
                            updated_at: session.user.updated_at,
                        },
                    });
                    queryClient.invalidateQueries({ queryKey: ['profile', session.user.id] });
                    queryClient.invalidateQueries({ queryKey: ['challenge-unread', session.user.id] });
                }
            } else if (event === 'SIGNED_OUT') {
                clearTrustedDeviceStamp();
                queryClient.clear();
            }
        });

        // Deduplicated session check + Stage 1/2 bootstrap
        getSharedAuthSession().then(({ data: { session } }) => {
            if (session?.user) {
                bootOrchestrator.bootstrapUserSession(session.user.id, queryClient);
            }
        }).catch(() => {});

        return () => subscription.unsubscribe();
    }, [queryClient, setPreferences]);
};
