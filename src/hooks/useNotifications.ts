/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { type AppNotification } from '../types/notifications';

/**
 * Hook to manage private notifications with real-time support.
 */
export const useNotifications = (userId: string | undefined, options: { enableRealtime?: boolean } = {}) => {
    const queryClient = useQueryClient();
    const { enableRealtime = true } = options;

    // 1. Fetch Notifications
    const { data: notifications = [], isLoading } = useQuery({
        queryKey: ['notifications', userId],
        queryFn: async () => {
            if (!userId) return [];
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            return data as AppNotification[];
        },
        enabled: !!userId,
    });

    // 2. Real-time Subscription
    useEffect(() => {
        if (!userId || !enableRealtime) return;

        const channel = supabase
            .channel(`private_notifications_${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`,
                },
                (payload) => {
                    const newNotif = payload.new as AppNotification;
                    
                    // Optimistically add to query cache
                    queryClient.setQueryData(['notifications', userId], (old: AppNotification[] = []) => [
                        newNotif,
                        ...old,
                    ]);

                    // Trigger a custom event for the toast popup
                    window.dispatchEvent(new CustomEvent('new-notification', { detail: newNotif }));
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`,
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`,
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId, queryClient, enableRealtime]);

    // 3. Derived State
    const unreadCount = useMemo(() => 
        notifications.filter(n => !n.is_read && n.type !== 'DM_MESSAGE').length, 
    [notifications]);

    // 4. Mutations
    const markAsRead = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
        }
    });

    const markAsUnread = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: false })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
        }
    });

    const markAllAsRead = useMutation({
        mutationFn: async () => {
            if (!userId) return;
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', userId)
                .eq('is_read', false);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
        }
    });

    const deleteNotification = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
        }
    });

    return {
        notifications,
        unreadCount,
        isLoading,
        markAsRead: markAsRead.mutate,
        markAsUnread: markAsUnread.mutate,
        markAllAsRead: markAllAsRead.mutate,
        deleteNotification: deleteNotification.mutate
    };
};
