import { describe, it, expect } from "vitest";
import {
   matchWordEffect,
   normalizeEffectEmoji,
   normalizeTriggerWord,
   type DmWordEffect,
} from "../utils/wordEffects";

const makeEffect = (id: string, trigger_word: string, emoji: string): DmWordEffect => ({
   id,
   group_id: "dm-1",
   trigger_word,
   emoji,
   created_by: "user-1",
   created_at: "2026-11-20T00:00:00Z",
});

describe("wordEffects utilities", () => {
   it("normalizes trigger words by trimming, collapsing spaces, and lowercasing", () => {
      expect(normalizeTriggerWord("  Happy   Birthday!  ")).toBe("happy birthday!");
      expect(normalizeTriggerWord("GG")).toBe("gg");
   });

   it("extracts a single emoji grapheme", () => {
      expect(normalizeEffectEmoji("  🔥🎉 ")).toBe("🔥");
      expect(normalizeEffectEmoji("   ")).toBe("");
   });

   it("matches words case-insensitively with whole-word boundaries", () => {
      const effects = [makeEffect("1", "cat", "🐱"), makeEffect("2", "gg", "🏆")];

      expect(matchWordEffect("I love my CAT!", effects)?.emoji).toBe("🐱");
      expect(matchWordEffect("Going on vacation", effects)).toBeNull();
      expect(matchWordEffect("GG bro", effects)?.emoji).toBe("🏆");
      expect(matchWordEffect("eggplant", effects)).toBeNull();
   });

   it("prioritizes longer multi-word phrases over shorter sub-words", () => {
      const effects = [
         makeEffect("1", "happy", "😊"),
         makeEffect("2", "happy birthday", "🎂"),
      ];

      expect(matchWordEffect("Wishing you a Happy Birthday!", effects)?.emoji).toBe("🎂");
      expect(matchWordEffect("I am so happy today", effects)?.emoji).toBe("😊");
   });

   it("ignores system rows and media placeholders", () => {
      const effects = [
         makeEffect("1", "reaction", "❤️"),
         makeEffect("2", "voice", "🎤"),
         makeEffect("3", "poll", "📊"),
      ];

      expect(matchWordEffect("[reaction:❤️]", effects)).toBeNull();
      expect(matchWordEffect("[Voice Message]", effects)).toBeNull();
      expect(matchWordEffect("[poll:abc123]", effects)).toBeNull();
      expect(matchWordEffect("", effects)).toBeNull();
   });
});
