import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIsTabVisible } from "../hooks/useIsTabVisible";

describe("useIsTabVisible", () => {
   beforeEach(() => {
      vi.useFakeTimers();
      Object.defineProperty(document, "visibilityState", {
         configurable: true,
         get: () => "visible",
      });
   });

   afterEach(() => {
      vi.useRealTimers();
   });

   it("stays visible during short tab switches and turns false after graceMs", () => {
      const { result } = renderHook(() => useIsTabVisible(5000));
      expect(result.current).toBe(true);

      // Tab becomes hidden
      Object.defineProperty(document, "visibilityState", {
         configurable: true,
         get: () => "hidden",
      });
      act(() => {
         document.dispatchEvent(new Event("visibilitychange"));
      });

      // Within grace period -> still true
      act(() => {
         vi.advanceTimersByTime(3000);
      });
      expect(result.current).toBe(true);

      // Past grace period -> flips to false
      act(() => {
         vi.advanceTimersByTime(2500);
      });
      expect(result.current).toBe(false);

      // Returning to tab -> immediately true
      Object.defineProperty(document, "visibilityState", {
         configurable: true,
         get: () => "visible",
      });
      act(() => {
         document.dispatchEvent(new Event("visibilitychange"));
      });
      expect(result.current).toBe(true);
   });
});
