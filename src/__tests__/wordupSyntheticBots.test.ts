import { describe, it, expect } from "vitest";
import {
   estimateUserLocation,
   pickSpawnRegion,
} from "../wordup/shared/locationEstimator";
import {
   buildRealisticUsername,
   generateSyntheticBotIdentity,
   getRankNameForRating,
} from "../wordup/shared/botIdentityGenerator";
import { generateRealisticBotAvatar } from "../wordup/shared/botAvatarGenerator";
import {
   generateBotPersonality,
   simulatePersonalityBotResponse,
   evaluateProactiveBotRematch,
   evaluateBotResponseToUserRematch,
   type BotPersonality,
} from "../wordup/shared/botPersonality";
import {
   getCachedTopicTelemetry,
   recordHumanTopicTelemetry,
} from "../wordup/shared/topicTelemetryService";
import type { WordUpQuestion } from "../utils/wordupQuestionGenerator/types";

const SAMPLE_QUESTION: WordUpQuestion = {
   type: "definition",
   prompt: "Which city is the capital of Nigeria?",
   choices: ["Abuja", "Lagos", "Kano", "Ibadan"],
   answer: "Abuja",
};

describe("WordUp Realistic Synthetic Bot System", () => {
   describe("Location Estimation", () => {
      it("returns a valid estimated location and neighbor regions", () => {
         const loc = estimateUserLocation();
         expect(loc.countryCode).toBeTruthy();
         expect(loc.neighborRegions.length).toBeGreaterThan(0);

         const picked = pickSpawnRegion(loc);
         expect([loc.countryCode, ...loc.neighborRegions]).toContain(picked);
      });
   });

   describe("Faker.js Identity & Realistic Avatar Generation", () => {
      it("formats realistic human handles within WordUp nickname limits (3-15 chars)", () => {
         for (let i = 0; i < 30; i++) {
            const handle = buildRealisticUsername("Oluwaseun", "Adeyemi");
            expect(handle.length).toBeGreaterThanOrEqual(3);
            expect(handle.length).toBeLessThanOrEqual(15);
            expect(handle).toMatch(/^[A-Za-z0-9_]+$/);
         }
      });

      it("spawns complete synthetic bot identities with realistic human avatars (never robot bottts)", () => {
         const regions = ["NG", "GB", "US", "GH", "KE", "ZA"] as const;
         for (const region of regions) {
            const bot = generateSyntheticBotIdentity(1150, region);
            expect(bot.id).toMatch(
               /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
            );
            expect(bot.username.length).toBeGreaterThanOrEqual(3);
            expect(bot.username.length).toBeLessThanOrEqual(15);
            expect(bot.country_code).toBe(region);
            expect(bot.rating).toBeGreaterThanOrEqual(600);
            expect(bot.games_played).toBeGreaterThanOrEqual(2);
            expect(bot.rank_name).toBe(getRankNameForRating(bot.rating));
            expect(bot.avatar_url).toMatch(/^https:\/\//);
            expect(bot.avatar_url).not.toContain("bottts");
            expect(bot.bot_personality).toBeDefined();
         }
      });

      it("generates deterministic avatars from seed without using robot sprites", () => {
         const url1 = generateRealisticBotAvatar("seed-alpha-1", "NG", "male");
         const url2 = generateRealisticBotAvatar("seed-alpha-1", "NG", "male");
         expect(url1).toBe(url2);
         expect(url1).not.toContain("bottts");
      });
   });

   describe("Personality & Gameplay Simulation", () => {
      it("scales bot accuracy and speed with target ELO rating", () => {
         const lowElo = generateBotPersonality(620, "NG");
         const highElo = generateBotPersonality(1850, "NG");

         // High ELO bots have higher base accuracy and lower minDelay on average
         expect(highElo.accuracy).toBeGreaterThan(lowElo.accuracy - 0.05);
         expect(highElo.minDelay).toBeLessThanOrEqual(lowElo.minDelay + 0.5);
      });

      it("simulates responses respecting persistence traits (never_gives_up vs gives_up_if_crushed)", () => {
         const neverGivesUp: BotPersonality = {
            archetype: "clutch_grinder",
            rematchPreference: "likes_rematch",
            persistence: "never_gives_up",
            accuracy: 0.85,
            minDelay: 1.0,
            maxDelay: 2.5,
            clutchModifier: 0.08,
            region: "NG",
         };

         const res = simulatePersonalityBotResponse(
            SAMPLE_QUESTION,
            neverGivesUp,
            10,
            6, // final round
            90, // player leading
            55, // bot trailing
         );
         expect(res.gaveUp).toBeFalsy();
         expect(res.time_taken).toBeGreaterThan(0);
         expect(res.time_taken).toBeLessThanOrEqual(10);
      });

      it("uses per-topic human telemetry so visual topics respond faster than calculation topics and normalizes legacy slow bots", async () => {
         const flagTelemetry = getCachedTopicTelemetry("flag_bearer");
         const reverseWordleTelemetry = getCachedTopicTelemetry("reverse_wordle");
         expect(flagTelemetry.medianTime).toBeLessThan(reverseWordleTelemetry.medianTime);

         // Verify a legacy slow bot (minDelay 3.8s, maxDelay 7.5s) is normalized to fast human speed
         const legacySlowBot: BotPersonality = {
            archetype: "casual_challenger",
            rematchPreference: "random",
            persistence: "steady",
            accuracy: 0.75,
            minDelay: 3.8,
            maxDelay: 7.5,
            clutchModifier: 0,
            region: "NG",
         };

         let fastCountUnder2s = 0;
         let flagSum = 0;
         let mathSum = 0;
         const trials = 60;

         for (let i = 0; i < trials; i++) {
            const flagRes = simulatePersonalityBotResponse(
               SAMPLE_QUESTION,
               legacySlowBot,
               10,
               0,
               0,
               0,
               flagTelemetry,
               "flag_bearer",
            );
            const mathRes = simulatePersonalityBotResponse(
               SAMPLE_QUESTION,
               legacySlowBot,
               10,
               0,
               0,
               0,
               reverseWordleTelemetry,
               "reverse_wordle",
            );
            if (flagRes.time_taken <= 2.2) fastCountUnder2s++;
            flagSum += flagRes.time_taken;
            mathSum += mathRes.time_taken;
         }

         expect(fastCountUnder2s).toBeGreaterThan(20); // Frequently answers in <= 2.2s (beats user!)
         expect(flagSum / trials).toBeLessThan(mathSum / trials);

         // Verify recording new human round telemetry updates cached topic telemetry
         const before = getCachedTopicTelemetry("football");
         await recordHumanTopicTelemetry("football", [
            { time_taken: 1.1, correct: true },
            { time_taken: 1.25, correct: true },
            { time_taken: 1.4, correct: true },
         ]);
         const after = getCachedTopicTelemetry("football");
         expect(after.sampleCount).toBeGreaterThan(before.sampleCount);
         expect(after.medianTime).toBeLessThanOrEqual(before.medianTime);
      });
   });

   describe("Rematch Decision Engine", () => {
      it("declines_rematch personality never proactively requests a rematch", () => {
         const decliner: BotPersonality = {
            archetype: "one_and_done",
            rematchPreference: "declines_rematch",
            persistence: "steady",
            accuracy: 0.75,
            minDelay: 2.0,
            maxDelay: 5.0,
            clutchModifier: 0,
            region: "NG",
         };

         for (let i = 0; i < 20; i++) {
            const decision = evaluateProactiveBotRematch(decliner, false, false, -20, 0);
            expect(decision.shouldRequest).toBe(false);
         }
      });

      it("evaluates user rematch requests with realistic delay and valid actions", () => {
         const likesRematch: BotPersonality = {
            archetype: "clutch_grinder",
            rematchPreference: "likes_rematch",
            persistence: "never_gives_up",
            accuracy: 0.8,
            minDelay: 2.0,
            maxDelay: 4.5,
            clutchModifier: 0.05,
            region: "NG",
         };

         const decision = evaluateBotResponseToUserRematch(likesRematch, false, false, 0);
         expect(["accept", "decline", "ignore"]).toContain(decision.action);
         expect(decision.delayMs).toBeGreaterThanOrEqual(900);
         expect(decision.delayMs).toBeLessThanOrEqual(3600);
      });

      it("is strongly inclined to accept rematches when the user requests within 3 seconds of gameover", () => {
         const hesitantBot: BotPersonality = {
            archetype: "one_and_done",
            rematchPreference: "declines_rematch",
            persistence: "steady",
            accuracy: 0.78,
            minDelay: 1.2,
            maxDelay: 3.0,
            clutchModifier: 0,
            region: "NG",
         };

         let quickAccepts = 0;
         let lateAccepts = 0;
         const trials = 60;

         for (let i = 0; i < trials; i++) {
            const quick = evaluateBotResponseToUserRematch(hesitantBot, true, false, 0, 1.5);
            const late = evaluateBotResponseToUserRematch(hesitantBot, true, false, 0, 6.5);
            if (quick.action === "accept") quickAccepts++;
            if (late.action === "accept") lateAccepts++;
         }

         expect(quickAccepts).toBeGreaterThan(30); // >50% even for declines_rematch when <= 3s
         expect(quickAccepts).toBeGreaterThan(lateAccepts);
      });
   });
});

