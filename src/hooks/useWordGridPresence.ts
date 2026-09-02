// src/hooks/useWordGridPresence.ts

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

export interface PlayerPresenceState {
  userId: string;
  username: string;
  inGame: boolean;
  isPlacing: boolean;
  ts: number;
}

/**
 * Real-time presence & live action tracker for WordGrid matches.
 * Tracks who is actively viewing the match and whether an opponent is currently placing/arranging tiles.
 */
export function useWordGridPresence(
  matchId: string | null | undefined,
  selfId: string | undefined,
  username?: string | null,
  enabled: boolean = true
) {
  const [presenceMap, setPresenceMap] = useState<Record<string, PlayerPresenceState>>({});
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isPlacingRef = useRef(false);
  const clearPlacingTimerRef = useRef<number | null>(null);
  const usernameRef = useRef(username);

  useEffect(() => {
    usernameRef.current = username;
  }, [username]);

  useEffect(() => {
    if (!matchId || !selfId || !enabled || matchId.startsWith('bot_')) {
      setPresenceMap({});
      return;
    }

    const channel = supabase.channel(`wordgrid_presence_${matchId}`, {
      config: { presence: { key: selfId } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState() as Record<string, PlayerPresenceState[]>;
        const updated: Record<string, PlayerPresenceState> = {};

        Object.entries(state).forEach(([key, entries]) => {
          if (Array.isArray(entries) && entries.length > 0) {
            // Sort to get the most recent presence heartbeat
            const latest = [...entries].sort((a, b) => (b.ts || 0) - (a.ts || 0))[0];
            if (latest) {
              updated[key] = {
                ...latest,
                userId: key,
              };
            }
          }
        });

        setPresenceMap(updated);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId: selfId,
            username: usernameRef.current || 'Player',
            inGame: true,
            isPlacing: false,
            ts: Date.now(),
          });
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
      if (clearPlacingTimerRef.current) window.clearTimeout(clearPlacingTimerRef.current);
      clearPlacingTimerRef.current = null;
      isPlacingRef.current = false;
      setPresenceMap({});
    };
  }, [matchId, selfId, enabled]);

  /**
   * Broadcasts whether the local player is currently interacting with/placing tiles.
   */
  const setSelfPlacing = useCallback((placing: boolean) => {
    const channel = channelRef.current;
    if (!channel || !selfId) return;
    const uname = usernameRef.current || 'Player';

    if (!placing) {
      if (clearPlacingTimerRef.current) window.clearTimeout(clearPlacingTimerRef.current);
      clearPlacingTimerRef.current = null;
      if (isPlacingRef.current) {
        isPlacingRef.current = false;
        channel.track({
          userId: selfId,
          username: uname,
          inGame: true,
          isPlacing: false,
          ts: Date.now(),
        });
      }
      return;
    }

    // Entering placing state
    if (!isPlacingRef.current) {
      isPlacingRef.current = true;
      channel.track({
        userId: selfId,
        username: uname,
        inGame: true,
        isPlacing: true,
        ts: Date.now(),
      });
    }

    // Auto-clear placing state after 4 seconds of idle
    if (clearPlacingTimerRef.current) window.clearTimeout(clearPlacingTimerRef.current);
    clearPlacingTimerRef.current = window.setTimeout(() => {
      isPlacingRef.current = false;
      channelRef.current?.track({
        userId: selfId,
        username: uname,
        inGame: true,
        isPlacing: false,
        ts: Date.now(),
      });
    }, 4000);
  }, [selfId]);

  return {
    presenceMap,
    setSelfPlacing,
  };
}
