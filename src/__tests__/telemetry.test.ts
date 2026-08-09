import { describe, it, expect, beforeEach, vi } from "vitest";
import {
   getOrCreateClientHash,
   initTelemetry,
   trackSectionClick,
   trackSectionTime,
   flushTelemetry,
   resetTelemetryState,
} from "../lib/telemetry";
import { supabase } from "../lib/supabaseClient";

vi.mock("../lib/supabaseClient", () => ({
   supabase: {
      rpc: vi.fn(async () => ({ data: null, error: null })),
   },
}));

describe("Telemetry Client Manager", () => {
   beforeEach(() => {
      resetTelemetryState();
      localStorage.clear();
      vi.clearAllMocks();
   });

   it("generates and persists a unique client hash in localStorage", () => {
      const hash1 = getOrCreateClientHash();
      expect(hash1).toBeDefined();
      expect(hash1.length).toBeGreaterThan(10);

      const hash2 = getOrCreateClientHash();
      expect(hash2).toBe(hash1);
   });

   it("initializes daily bucket and persists to localStorage", async () => {
      await initTelemetry();
      const raw = localStorage.getItem("variant_telemetry_v1");
      expect(raw).not.toBeNull();

      const bucket = JSON.parse(raw!);
      expect(bucket.appOpens).toBeGreaterThanOrEqual(1);
      expect(bucket.clicksPerSection).toBeDefined();
      expect(bucket.timeSpentPerSection).toBeDefined();
   });

   it("tracks section clicks and updates bounce flag", async () => {
      await initTelemetry();
      trackSectionClick("settings-modal");
      trackSectionClick("settings-modal");
      trackSectionClick("stats-modal");

      const raw = JSON.parse(localStorage.getItem("variant_telemetry_v1")!);
      expect(raw.clicksPerSection["settings-modal"]).toBe(2);
      expect(raw.clicksPerSection["stats-modal"]).toBe(1);
      expect(raw.totalInteractions).toBe(3);
      expect(raw.isBounce).toBe(false);
   });

   it("tracks duration spent per section", async () => {
      await initTelemetry();
      trackSectionTime("daily-puzzle", 45);
      trackSectionTime("daily-puzzle", 15);

      const raw = JSON.parse(localStorage.getItem("variant_telemetry_v1")!);
      expect(raw.timeSpentPerSection["daily-puzzle"]).toBe(60);
   });

   it("retries telemetry submission up to 3 times on failure and keeps localStorage until success", async () => {
      const rpcMock = vi.spyOn(supabase, "rpc");
      rpcMock.mockResolvedValue({ data: null, error: { message: "Network error" } as any });

      const oldBucket = {
         date: "2026-08-01",
         appOpens: 2,
         timeSpentSeconds: 120,
         clicksPerSection: { "settings-modal": 3 },
         timeSpentPerSection: { "settings-modal": 120 },
         isBounce: false,
         totalInteractions: 3,
         lastActiveTimestamp: Date.now(),
         currentActiveSection: null,
         sectionStartTime: null,
      };
      localStorage.setItem("variant_telemetry_v1", JSON.stringify(oldBucket));

      const result = await flushTelemetry();
      expect(result).toBe(false);
      expect(rpcMock).toHaveBeenCalledTimes(3);

      // Local storage must NOT be cleared because submission failed!
      const stillInStorage = localStorage.getItem("variant_telemetry_v1");
      expect(stillInStorage).not.toBeNull();

      // Now simulate success on the next attempt
      rpcMock.mockResolvedValue({ data: null, error: null });
      const successResult = await flushTelemetry();
      expect(successResult).toBe(true);

      // Upon verified success for old date, local storage is cleared
      const clearedStorage = localStorage.getItem("variant_telemetry_v1");
      expect(clearedStorage).toBeNull();
   });
});
