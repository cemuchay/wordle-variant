import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTypingPresence } from "../../hooks/useTypingPresence";
import { supabase } from "../../lib/supabaseClient";

// Hoisted mocks container
const { mockTrack, mockChannel, getPresenceCallback, setPresenceState } = vi.hoisted(() => {
   let presenceSyncCallback: (() => void) | null = null;
   let presenceState: Record<string, any[]> = {};
   const trackFn = vi.fn();

   const channelObj: any = {
      on: vi.fn((_type: string, opts: any, cb?: any) => {
         if (opts?.event === "sync") {
            presenceSyncCallback = cb || opts;
         }
         return channelObj;
      }),
      subscribe: vi.fn(() => channelObj),
      presenceState: vi.fn(() => presenceState),
      track: trackFn,
   };

   return {
      mockTrack: trackFn,
      mockChannel: channelObj,
      getPresenceCallback: () => presenceSyncCallback,
      setPresenceState: (newState: Record<string, any[]>) => {
         presenceState = newState;
      },
   };
});

vi.mock("../../lib/supabaseClient", () => {
   return {
      supabase: {
         channel: vi.fn(() => mockChannel),
         removeChannel: vi.fn(),
      },
   };
});

describe("useTypingPresence Hook", () => {
   beforeEach(() => {
      vi.useFakeTimers();
      setPresenceState({});
      mockTrack.mockClear();
      vi.clearAllMocks();
   });

   afterEach(() => {
      vi.clearAllTimers();
      vi.useRealTimers();
   });

   it("subscribes to channel and parses typing & voice recording peer presence", () => {
      const { result } = renderHook(() =>
         useTypingPresence("room-123", "self-id", true, "SelfUser")
      );

      expect(supabase.channel).toHaveBeenCalledWith("chat_presence_room-123", {
         config: { presence: { key: "self-id" } },
      });

      // Peer 1 is typing, Peer 2 is recording voice
      setPresenceState({
         "self-id": [{ isTyping: true, username: "SelfUser", ts: 100 }],
         "peer-1": [{ isTyping: true, username: "Alice", ts: 101 }],
         "peer-2": [{ isRecordingVoice: true, username: "Bob", ts: 102 }],
      });

      act(() => {
         getPresenceCallback()?.();
      });

      expect(result.current.typingNames).toEqual(["Alice"]);
      expect(result.current.recordingNames).toEqual(["Bob"]);
   });

   it("fallbacks to 'Someone' if peer username is missing/empty", () => {
      const { result } = renderHook(() =>
         useTypingPresence("room-123", "self-id", true, "SelfUser")
      );

      setPresenceState({
         "peer-1": [{ isTyping: true, username: "", ts: 101 }],
      });

      act(() => {
         getPresenceCallback()?.();
      });

      expect(result.current.typingNames).toEqual(["Someone"]);
   });

   it("immediately tracks typing and clears after 3 seconds of inactivity", () => {
      const { result } = renderHook(() =>
         useTypingPresence("room-123", "self-id", true, "SelfUser")
      );

      act(() => {
         result.current.setSelfTyping(true);
      });

      expect(mockTrack).toHaveBeenCalledWith(
         expect.objectContaining({ isTyping: true, isRecordingVoice: false, username: "SelfUser" })
      );

      // Fast forward 3 seconds
      act(() => {
         vi.advanceTimersByTime(3000);
      });

      expect(mockTrack).toHaveBeenLastCalledWith(
         expect.objectContaining({ isTyping: false, isRecordingVoice: false, username: "SelfUser" })
      );
   });

   it("immediately broadcasts isTyping: false when setSelfTyping(false) is called on send", () => {
      const { result } = renderHook(() =>
         useTypingPresence("room-123", "self-id", true, "SelfUser")
      );

      act(() => {
         result.current.setSelfTyping(true);
      });

      act(() => {
         result.current.setSelfTyping(false);
      });

      expect(mockTrack).toHaveBeenLastCalledWith(
         expect.objectContaining({ isTyping: false, username: "SelfUser" })
      );
   });

   it("broadcasts isRecordingVoice: true when setSelfRecording(true) is called", () => {
      const { result } = renderHook(() =>
         useTypingPresence("room-123", "self-id", true, "SelfUser")
      );

      act(() => {
         result.current.setSelfRecording(true);
      });

      expect(mockTrack).toHaveBeenCalledWith(
         expect.objectContaining({ isTyping: false, isRecordingVoice: true, username: "SelfUser" })
      );

      act(() => {
         result.current.setSelfRecording(false);
      });

      expect(mockTrack).toHaveBeenLastCalledWith(
         expect.objectContaining({ isTyping: false, isRecordingVoice: false, username: "SelfUser" })
      );
   });

   it("unsubscribes and cleans up channel on unmount", () => {
      const { unmount } = renderHook(() =>
         useTypingPresence("room-123", "self-id", true, "SelfUser")
      );

      unmount();
      expect(supabase.removeChannel).toHaveBeenCalledWith(mockChannel);
   });
});
