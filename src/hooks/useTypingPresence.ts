import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

export interface ActivityPresenceSession {
   isTyping?: boolean;
   isRecordingVoice?: boolean;
   username?: string;
   ts?: number;
}

/**
 * Lightweight per-room typing & voice recording presence for chat rooms.
 *
 * Subscribes only while `enabled`.
 * Broadcasts own typing & voice recording state and tracks active typing & recording users.
 */
export function useTypingPresence(
   groupId: string | null,
   selfId: string | undefined,
   enabled: boolean,
   username?: string | null,
) {
   const [typingNames, setTypingNames] = useState<string[]>([]);
   const [recordingNames, setRecordingNames] = useState<string[]>([]);
   const channelRef = useRef<RealtimeChannel | null>(null);
   const isTypingRef = useRef(false);
   const isRecordingRef = useRef(false);
   const clearTimerRef = useRef<number | null>(null);
   const usernameRef = useRef<string | null | undefined>(username);

   useEffect(() => {
      usernameRef.current = username;
   }, [username]);

   useEffect(() => {
      if (!groupId || !selfId || !enabled) {
         setTypingNames([]);
         setRecordingNames([]);
         return;
      }

      const channel = supabase.channel(`chat_presence_${groupId}`, {
         config: { presence: { key: selfId } },
      });

      channel
         .on("presence", { event: "sync" }, () => {
            const state = channel.presenceState() as Record<string, ActivityPresenceSession[]>;
            const typing = new Set<string>();
            const recording = new Set<string>();

            Object.keys(state).forEach((key) => {
               if (key === selfId) return;
               const sessions = state[key];
               if (!sessions || sessions.length === 0) return;

               // Get the latest presence event for this user
               const latest = [...sessions].sort((a, b) => (b.ts || 0) - (a.ts || 0))[0];
               if (!latest) return;

               const displayName = latest.username && latest.username.trim().length > 0
                  ? latest.username
                  : "Someone";

               if (latest.isRecordingVoice) {
                  recording.add(displayName);
               } else if (latest.isTyping) {
                  typing.add(displayName);
               }
            });

            const nextTyping = Array.from(typing).sort();
            const nextRecording = Array.from(recording).sort();

            setTypingNames((prev) =>
               prev.length === nextTyping.length && prev.every((n, i) => n === nextTyping[i])
                  ? prev
                  : nextTyping,
            );

            setRecordingNames((prev) =>
               prev.length === nextRecording.length && prev.every((n, i) => n === nextRecording[i])
                  ? prev
                  : nextRecording,
            );
         })
         .subscribe();

      channelRef.current = channel;

      return () => {
         if (isTypingRef.current || isRecordingRef.current) {
            channel.track({
               isTyping: false,
               isRecordingVoice: false,
               username: usernameRef.current || "Someone",
               ts: Date.now(),
            });
         }
         supabase.removeChannel(channel);
         channelRef.current = null;
         if (clearTimerRef.current) {
            window.clearTimeout(clearTimerRef.current);
            clearTimerRef.current = null;
         }
         isTypingRef.current = false;
         isRecordingRef.current = false;
      };
   }, [groupId, selfId, enabled]);

   const setSelfTyping = useCallback((on: boolean) => {
      const channel = channelRef.current;
      const uname = usernameRef.current || "Someone";

      if (!on) {
         if (clearTimerRef.current) {
            window.clearTimeout(clearTimerRef.current);
            clearTimerRef.current = null;
         }
         if (isTypingRef.current) {
            isTypingRef.current = false;
            channel?.track({
               isTyping: false,
               isRecordingVoice: isRecordingRef.current,
               username: uname,
               ts: Date.now(),
            });
         }
         return;
      }

      if (!channel) return;
      isTypingRef.current = true;
      channel.track({
         isTyping: true,
         isRecordingVoice: false,
         username: uname,
         ts: Date.now(),
      });

      if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = window.setTimeout(() => {
         isTypingRef.current = false;
         channelRef.current?.track({
            isTyping: false,
            isRecordingVoice: isRecordingRef.current,
            username: uname,
            ts: Date.now(),
         });
      }, 3000);
   }, []);

   const setSelfRecording = useCallback((on: boolean) => {
      const channel = channelRef.current;
      const uname = usernameRef.current || "Someone";

      if (!on) {
         if (isRecordingRef.current) {
            isRecordingRef.current = false;
            channel?.track({
               isTyping: false,
               isRecordingVoice: false,
               username: uname,
               ts: Date.now(),
            });
         }
         return;
      }

      if (!channel) return;
      // When recording starts, clear typing
      if (clearTimerRef.current) {
         window.clearTimeout(clearTimerRef.current);
         clearTimerRef.current = null;
      }
      isTypingRef.current = false;
      isRecordingRef.current = true;

      channel.track({
         isTyping: false,
         isRecordingVoice: true,
         username: uname,
         ts: Date.now(),
      });
   }, []);

   return {
      typingNames: enabled ? typingNames : [],
      recordingNames: enabled ? recordingNames : [],
      setSelfTyping,
      setSelfRecording,
   };
}
