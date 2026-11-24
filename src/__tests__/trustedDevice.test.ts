import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
   TRUSTED_DEVICE_TTL_MS,
   clearTrustedDeviceStamp,
   getCachedDailyConfigSync,
   getTrustedDeviceStamp,
   isTrustedDeviceBoot,
   saveCachedDailyConfigSync,
   saveTrustedDeviceStamp,
} from "../utils/trustedDevice";
import { safeLocalStorage } from "../utils/storage";
import { useActions } from "../hooks/useGameEngine/useActions";
import {
   bootOrchestrator,
   runWithFailSafeRetry,
} from "../services/bootOrchestrator";
import { QueryClient } from "@tanstack/react-query";
import { useChallengeStore } from "../store/useChallengeStore";

describe("Trusted Device 24-Hour Boot & Background Revalidation Action Gate", () => {
   beforeEach(() => {
      safeLocalStorage.clear();
      vi.clearAllMocks();
   });

   it("returns false for isTrustedDeviceBoot on a first-time visit", () => {
      expect(isTrustedDeviceBoot()).toBe(false);
      expect(getTrustedDeviceStamp()).toBeNull();
   });

   it("returns true for isTrustedDeviceBoot when returning within 24 hours", () => {
      const baseTime = 1_750_000_000_000;
      saveTrustedDeviceStamp({
         nowMs: baseTime,
         date: "2026-06-15",
         isAuthenticated: true,
         user: { id: "user-123", email: "player@example.com" },
         guestOptedIn: false,
      });

      // Returning 12 hours later (< 24h)
      const twelveHoursLater = baseTime + 12 * 60 * 60 * 1000;
      expect(isTrustedDeviceBoot(twelveHoursLater)).toBe(true);

      const stamp = getTrustedDeviceStamp(twelveHoursLater);
      expect(stamp).not.toBeNull();
      expect(stamp?.user?.id).toBe("user-123");
      expect(stamp?.isAuthenticated).toBe(true);
   });

   it("expires the Trusted Device stamp after 24 hours", () => {
      const baseTime = 1_750_000_000_000;
      saveTrustedDeviceStamp({
         nowMs: baseTime,
         date: "2026-06-15",
         isAuthenticated: true,
         user: { id: "user-123" },
      });

      // Returning 24 hours + 1ms later
      const expiredTime = baseTime + TRUSTED_DEVICE_TTL_MS + 1;
      expect(isTrustedDeviceBoot(expiredTime)).toBe(false);
      expect(getTrustedDeviceStamp(expiredTime)).toBeNull();
   });

   it("clears the Trusted Device stamp on clearTrustedDeviceStamp", () => {
      saveTrustedDeviceStamp({
         date: "2026-06-15",
         isAuthenticated: true,
         user: { id: "user-123" },
      });
      expect(isTrustedDeviceBoot()).toBe(true);

      clearTrustedDeviceStamp();
      expect(isTrustedDeviceBoot()).toBe(false);
   });

   it("synchronously caches and restores daily GameConfig with word obfuscation", () => {
      const date = "2026-06-15";
      const userId = "user-123";
      const config = { word: "COOKED", length: 6 as const, maxAttempts: 6 };

      saveCachedDailyConfigSync(date, true, userId, config);

      // Verify raw stored value does not expose plaintext word
      const raw = safeLocalStorage.getItem(`variant_daily_config_${date}_auth`);
      expect(raw).toBeTruthy();
      expect(raw).not.toContain("COOKED");

      // Verify synchronous restoration deobfuscates accurately
      const restored = getCachedDailyConfigSync(date, true, userId);
      expect(restored).toEqual(config);
   });

   it("blocks Submit Guess (onEnter) and Hint (handleHint) while background revalidation is in flight", async () => {
      const dispatch = vi.fn();
      const triggerToast = vi.fn();
      const performSync = vi.fn().mockResolvedValue(true);

      const baseProps = {
         state: {
            isGameOver: false,
            currentGuess: "TRUST",
            cursorIndex: 5,
            guesses: [
               [
                  { letter: "S", status: "absent" },
                  { letter: "L", status: "absent" },
                  { letter: "A", status: "absent" },
                  { letter: "T", status: "present" },
                  { letter: "E", status: "absent" },
               ],
               [
                  { letter: "C", status: "absent" },
                  { letter: "O", status: "absent" },
                  { letter: "U", status: "present" },
                  { letter: "N", status: "absent" },
                  { letter: "T", status: "correct" },
               ],
            ],
            usedHint: false,
            hintRecord: null,
            gameMessage: "",
         },
         dispatch,
         config: { word: "TRUST", length: 5, maxAttempts: 6 },
         date: "2026-05-26",
         user: { id: "user-123" },
         preferences: { allowRoasts: false },
         triggerToast,
         ask: vi.fn().mockResolvedValue(true),
         performSync,
         updateOptimistically: vi.fn(),
         refresh: vi.fn().mockResolvedValue(undefined),
         isRevalidating: true,
      };

      const { result } = renderHook(() => useActions(baseProps));

      // Non-mutating typing actions should still work immediately
      act(() => {
         result.current.onChar("A");
         result.current.onDelete();
      });
      expect(dispatch).toHaveBeenCalledWith({
         type: "ADD_LETTER",
         char: "A",
         maxLength: 5,
      });
      expect(dispatch).toHaveBeenCalledWith({ type: "DELETE_LETTER" });

      dispatch.mockClear();

      // Mutating actions (onEnter / handleHint) MUST be blocked while isRevalidating === true
      await act(async () => {
         await result.current.onEnter();
      });
      expect(dispatch).not.toHaveBeenCalledWith(
         expect.objectContaining({ type: "SUBMIT_GUESS" }),
      );
      expect(triggerToast).toHaveBeenCalledWith(
         expect.stringContaining("Syncing latest game state"),
         expect.any(Number),
      );

      triggerToast.mockClear();

      await act(async () => {
         await result.current.handleHint();
      });
      expect(dispatch).not.toHaveBeenCalledWith(
         expect.objectContaining({ type: "SET_HINT" }),
      );
      expect(triggerToast).toHaveBeenCalledWith(
         expect.stringContaining("Syncing latest game state"),
         expect.any(Number),
      );
   });

   it("runWithFailSafeRetry retries transient failures and resolves when operation succeeds", async () => {
      let attempts = 0;
      const result = await runWithFailSafeRetry(
         async () => {
            attempts++;
            if (attempts < 3) {
               throw new Error("Transient network failure");
            }
            return "recovered-data";
         },
         { maxRetries: 3, baseDelayMs: 5 },
      );

      expect(result).toBe("recovered-data");
      expect(attempts).toBe(3);
   });

   it("bootOrchestrator duration-tiered visibility handler skips network spam on quick (<30s) tab switches and reconciles on long absences", () => {
      const queryClient = new QueryClient();
      const refetchSpy = vi.spyOn(queryClient, "refetchQueries");
      const visibilityEvents: Event[] = [];
      const listener = (e: Event) => visibilityEvents.push(e);
      window.addEventListener("app-visibility-visible", listener);

      try {
         // 1. Hide tab
         bootOrchestrator.handleVisibilityChange({
            isVisible: false,
            userId: "user-123",
            queryClient,
            wasDisconnected: false,
            clearDisconnectedFlag: () => {},
         });

         // 2. Refocus immediately (< 30s): should NOT trigger server-date refetch or app-visibility-visible
         bootOrchestrator.handleVisibilityChange({
            isVisible: true,
            userId: "user-123",
            queryClient,
            wasDisconnected: false,
            clearDisconnectedFlag: () => {},
         });

         expect(refetchSpy).not.toHaveBeenCalled();
         expect(visibilityEvents).toHaveLength(0);

         // 3. Refocus after disconnection: should trigger full reconciliation
         let clearedFlag = false;
         bootOrchestrator.handleVisibilityChange({
            isVisible: true,
            userId: "user-123",
            queryClient,
            wasDisconnected: true,
            clearDisconnectedFlag: () => {
               clearedFlag = true;
            },
         });

         expect(refetchSpy).toHaveBeenCalledWith({
            queryKey: ["server-date"],
            type: "active",
         });
         expect(visibilityEvents).toHaveLength(1);
         expect(clearedFlag).toBe(true);
      } finally {
         window.removeEventListener("app-visibility-visible", listener);
      }
   });

   it("persists open challenge snapshot in useChallengeStore so returning to Challenges populates immediately without loading screen", () => {
      const mockChallenge: any = {
         id: "challenge-abc",
         creator_id: "user-123",
         mode: "ANYTIME",
         word_length: 5,
         target_word: "OBFUSCATED",
         salt: "salt",
         max_time: null,
         expires_at: "2027-01-01T00:00:00Z",
         created_at: "2026-06-01T00:00:00Z",
         participants: [],
      };
      const mockParticipation: any = {
         id: "part-1",
         challenge_id: "challenge-abc",
         user_id: "user-123",
         status: "playing",
         score: 420,
         attempts: 2,
         guesses: [],
         hints_used: false,
         hint_record: null,
      };

      useChallengeStore.getState().setSelectedChallenge(mockChallenge);
      useChallengeStore.getState().setMyParticipation(mockParticipation);

      const snapshotRaw = safeLocalStorage.getItem("wordle_open_challenge_snapshot");
      expect(snapshotRaw).toBeTruthy();
      const parsed = JSON.parse(snapshotRaw!);
      expect(parsed.selectedChallenge.id).toBe("challenge-abc");
      expect(parsed.myParticipation.score).toBe(420);

      // Clearing selectedChallenge (e.g. clicking Back to List) removes the open snapshot
      useChallengeStore.getState().setSelectedChallenge(null);
      expect(safeLocalStorage.getItem("wordle_open_challenge_snapshot")).toBeNull();
   });
});
