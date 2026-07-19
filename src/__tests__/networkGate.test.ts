import { describe, it, expect, vi, beforeEach } from "vitest";
import { networkGate } from "../lib/networkGate";
import { supabase } from "../lib/supabaseClient";

vi.mock("../lib/supabaseClient", () => {
   return {
      supabase: {
         from: vi.fn(() => ({
            select: vi.fn(() => ({
               eq: vi.fn(() => ({
                  maybeSingle: vi
                     .fn()
                     .mockResolvedValue({ data: { test: "val" }, error: null }),
               })),
            })),
            upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
         })),
      },
   };
});

describe("NetworkGate", () => {
   beforeEach(() => {
      vi.clearAllMocks();
      localStorage.clear();
   });

   it("processes enqueued queries sequentially and returns expected data", async () => {
      const p1 = networkGate.enqueue(
         "test_action_1",
         {
            type: "supabase",
            table: "scores",
            operation: "select",
            payload: { select: "test" },
            query: { eq: { id: "1" }, maybeSingle: true },
         },
         true,
      );

      const res1 = await p1;
      expect(res1).toEqual({ test: "val" });
      expect(supabase.from).toHaveBeenCalledWith("scores");
   });

   it("retries up to 3 times on supabase errors before failing", async () => {
      let callCount = 0;
      vi.mocked(supabase.from).mockImplementation((() => ({
         upsert: vi.fn(() => {
            callCount++;
            return Promise.resolve({
               data: null,
               error: new Error("Network Err"),
            });
         }),
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
      })) as any);

      const p2 = networkGate.enqueue(
         "test_fail_action",
         {
            type: "supabase",
            table: "scores",
            operation: "upsert",
            payload: { id: "2" },
         },
         true,
      );

      await expect(p2).rejects.toThrow("Network Err");
      expect(callCount).toBe(3);
   });
});
