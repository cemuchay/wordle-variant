import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

interface TypingSession {
   isTyping?: boolean;
   username?: string;
   ts?: number;
}

/**
 * Lightweight per-room typing presence for FloatingChatBubble.
 *
 * Subscribes only while `enabled`, broadcasts own typing state on the
 * false→true transition plus a 2s clear (never per keystroke), and reports
 * the sorted names of other members currently typing.
 */
export function useTypingPresence(
   groupId: string | null,
   selfId: string | undefined,
   enabled: boolean,
   username?: string | null,
) {
   const [typingNames, setTypingNames] = useState<string[]>([]);
   const channelRef = useRef<RealtimeChannel | null>(null);
   const isTypingRef = useRef(false);
   const clearTimerRef = useRef<number | null>(null);
   const usernameRef = useRef<string | null | undefined>(username);

   useEffect(() => {
      usernameRef.current = username;
   }, [username]);

   useEffect(() => {
      if (!groupId || !selfId || !enabled) return;

      const channel = supabase.channel(`chat_room_${groupId}`, {
         config: { presence: { key: selfId } },
      });

      channel
         .on("presence", { event: "sync" }, () => {
            const state = channel.presenceState() as Record<string, TypingSession[]>;
            const names = new Set<string>();
            Object.keys(state).forEach((key) => {
               if (key === selfId) return;
               const latest = [...state[key]].sort((a, b) => (b.ts || 0) - (a.ts || 0))[0];
               if (latest?.isTyping && latest?.username) names.add(latest.username);
            });
            const next = Array.from(names).sort();
            setTypingNames((prev) =>
               prev.length === next.length && prev.every((n, i) => n === next[i])
                  ? prev
                  : next,
            );
         })
         .subscribe();

      channelRef.current = channel;

      return () => {
         supabase.removeChannel(channel);
         channelRef.current = null;
         if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
         clearTimerRef.current = null;
         isTypingRef.current = false;
      };
   }, [groupId, selfId, enabled]);

   const setSelfTyping = useCallback((on: boolean) => {
      const channel = channelRef.current;
      if (!channel) return;
      const uname = usernameRef.current || "Someone";

      if (!on) {
         if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
         clearTimerRef.current = null;
         if (isTypingRef.current) {
            isTypingRef.current = false;
            channel.track({ isTyping: false, username: uname, ts: Date.now() });
         }
         return;
      }

      if (!isTypingRef.current) {
         isTypingRef.current = true;
         channel.track({ isTyping: true, username: uname, ts: Date.now() });
      }
      if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = window.setTimeout(() => {
         isTypingRef.current = false;
         channelRef.current?.track({ isTyping: false, username: uname, ts: Date.now() });
      }, 2000);
   }, []);

   // While disabled (overlay closed / no room selected) never report names
   return { typingNames: enabled ? typingNames : [], setSelfTyping };
}
