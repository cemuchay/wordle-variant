/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

export interface ChallengeMessage {
    id: string;
    challenge_id: string;
    sender_id: string | null;
    guest_sender_id: string | null;
    sender_name: string;
    content: string;
    created_at: string;
    is_edited?: boolean;
    is_deleted?: boolean;
    reactions?: Record<string, string>;
    voice_url?: string | null;
}

export const useChallengeChat = (challengeId: string | undefined, effectiveUser: any, isGuest: boolean) => {
    const [messages, setMessages] = useState<ChallengeMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const [typingUsers, setTypingUsers] = useState<string[]>([]);
    
    const channelRef = useRef<any>(null);
    const typingTimeoutRef = useRef<any>(null);
    const isCurrentlyTypingLocally = useRef(false);

    const fetchMessages = useCallback(async () => {
        if (!challengeId) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('challenge_messages')
                .select('*')
                .eq('challenge_id', challengeId)
                .order('created_at', { ascending: true });
            if (error) throw error;
            setMessages(data || []);
        } catch (err) {
            console.error('Failed to fetch challenge messages:', err);
        } finally {
            setLoading(false);
        }
    }, [challengeId]);

    useEffect(() => {
        if (!challengeId) return;
        fetchMessages();

        const channelName = `challenge_chat_${challengeId}`;
        const existingChannel = supabase.getChannels().find(c => (c as any).topic === `realtime:${channelName}`);
        if (existingChannel) {
            supabase.removeChannel(existingChannel);
        }

        const channel = supabase
            .channel(channelName)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'challenge_messages',
                filter: `challenge_id=eq.${challengeId}`
            }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    const newMsg = payload.new as ChallengeMessage;
                    setMessages(prev => {
                        if (prev.some(m => m.id === newMsg.id)) return prev;
                        return [...prev, newMsg];
                    });
                } else if (payload.eventType === 'UPDATE') {
                    const updatedMsg = payload.new as ChallengeMessage;
                    setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
                }
            })
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                const typingNames = new Set<string>();
                const currentUsername = effectiveUser?.username || effectiveUser?.user_metadata?.full_name || 'Player';

                Object.keys(state).forEach((key) => {
                    const sessions = state[key] as any[];
                    const latest = sessions.sort((a, b) => (b.ts || 0) - (a.ts || 0))[0];
                    if (latest?.isTyping && latest?.username && latest?.username !== currentUsername) {
                        typingNames.add(latest.username);
                    }
                });
                setTypingUsers(Array.from(typingNames));
            })
            .subscribe();

        channelRef.current = channel;

        return () => {
            supabase.removeChannel(channel);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        };
    }, [challengeId, fetchMessages, effectiveUser]);

    const setTyping = useCallback((isTyping: boolean) => {
        if (!channelRef.current || !effectiveUser) return;
        const username = effectiveUser.username || effectiveUser.user_metadata?.full_name || 'Player';

        if (!isTyping) {
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            isCurrentlyTypingLocally.current = false;
            channelRef.current.track({ isTyping: false, username, ts: Date.now() });
            return;
        }

        if (!isCurrentlyTypingLocally.current) {
            isCurrentlyTypingLocally.current = true;
            channelRef.current.track({ isTyping: true, username, ts: Date.now() });
        }

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            isCurrentlyTypingLocally.current = false;
            channelRef.current?.track({
                isTyping: false,
                username,
                ts: Date.now(),
            });
        }, 2000);
    }, [effectiveUser]);

    const sendMessage = useCallback(async (content: string) => {
        if (!content.trim() || !challengeId || !effectiveUser) return;

        const tempId = crypto.randomUUID();
        const msgData: any = {
            id: tempId,
            challenge_id: challengeId,
            sender_name: effectiveUser.username || effectiveUser.user_metadata?.full_name || 'Player',
            content: content.trim()
        };

        if (isGuest) {
            msgData.guest_sender_id = effectiveUser.id;
            msgData.sender_id = null;
        } else {
            msgData.sender_id = effectiveUser.id;
            msgData.guest_sender_id = null;
        }

        // Optimistic update
        const optimisticMsg: ChallengeMessage = {
            ...msgData,
            created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, optimisticMsg]);

        try {
            const { error } = await supabase.from('challenge_messages').insert([msgData]);
            if (error) throw error;
        } catch (err) {
            console.error('Failed to send message:', err);
            // Remove optimistic message on error
            setMessages(prev => prev.filter(m => m.id !== tempId));
        }
    }, [challengeId, effectiveUser, isGuest]);

    const editMessage = useCallback(async (messageId: string, newContent: string) => {
        if (!newContent.trim()) return;
        const msg = messages.find(m => m.id === messageId);
        if (!msg) return;

        const elapsed = Date.now() - new Date(msg.created_at).getTime();
        if (elapsed > 5 * 60 * 1000) return;

        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: newContent, is_edited: true } : m));

        try {
            const { error } = await supabase
                .from('challenge_messages')
                .update({ content: newContent, is_edited: true })
                .eq('id', messageId);
            if (error) throw error;
        } catch (err) {
            console.error('Failed to edit challenge message:', err);
        }
    }, [messages]);

    const deleteMessage = useCallback(async (messageId: string) => {
        const msg = messages.find(m => m.id === messageId);
        if (!msg) return;

        const elapsed = Date.now() - new Date(msg.created_at).getTime();
        if (elapsed > 5 * 60 * 1000) return;

        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: '🚫 This message was deleted', is_deleted: true, voice_url: null, reactions: {} } : m));

        try {
            const { error } = await supabase
                .from('challenge_messages')
                .update({ 
                    content: '🚫 This message was deleted', 
                    is_deleted: true, 
                    voice_url: null, 
                    reactions: {} 
                })
                .eq('id', messageId);
            if (error) throw error;
        } catch (err) {
            console.error('Failed to delete challenge message:', err);
        }
    }, [messages]);

    return { messages, sendMessage, editMessage, deleteMessage, loading, typingUsers, setTyping };
};
