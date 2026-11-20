import { describe, it, expect } from "vitest";
import {
   MAX_DM_NICKNAME_LENGTH,
   normalizeNickname,
   resolveDmDisplayName,
   type DmNicknamesMap,
} from "../utils/dmNicknames";

describe("dmNicknames utilities", () => {
   it("normalizes nicknames by trimming, collapsing spaces, and clamping max length", () => {
      expect(normalizeNickname("  Best   Buddy  ")).toBe("Best Buddy");
      expect(normalizeNickname("a".repeat(50))).toHaveLength(MAX_DM_NICKNAME_LENGTH);
   });

   it("resolves custom nicknames per DM conversation and falls back to username", () => {
      const map: DmNicknamesMap = {
         "dm-1": {
            "user-b": "Wordle Wizard",
            "user-a": "Champ",
         },
      };

      expect(resolveDmDisplayName("dm-1", "user-b", "bob", map)).toBe("Wordle Wizard");
      expect(resolveDmDisplayName("dm-1", "user-a", "alice", map)).toBe("Champ");
      // Different DM does not leak nicknames
      expect(resolveDmDisplayName("dm-2", "user-b", "bob", map)).toBe("bob");
      // Missing group or user falls back cleanly
      expect(resolveDmDisplayName(null, "user-b", "bob", map)).toBe("bob");
      expect(resolveDmDisplayName("dm-1", undefined, "bob", map)).toBe("bob");
   });
});
