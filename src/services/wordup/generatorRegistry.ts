/* eslint-disable @typescript-eslint/no-explicit-any */
import { type QuizGenerator, type BaseQuestion } from "../../types/generators";
import { generateLegacyBatch } from "./legacyWordEngine";
import { capitalsClashGenerator } from "./generators/capitalsClash";
import { currencyExchangeGenerator } from "./generators/currencyExchange";
import { flagBearerGenerator } from "./generators/flagBearer";
import { mentalMathBlitzGenerator } from "./generators/mentalMathBlitz";
import { sequenceSolverGenerator } from "./generators/sequenceSolver";
import { elementArenaGenerator } from "./generators/elementArena";
import { animalKingdomGenerator } from "./generators/animalKingdom";
import { cosmicFrontierGenerator } from "./generators/cosmicFrontier";
import { cinephileTriviaGenerator } from "./generators/cinephileTrivia";
import { historyMilestonesGenerator } from "./generators/historyMilestones";

const LEGACY_CATEGORIES = new Set([
   "mixed", "3_letters", "4_letters", "5_letters", "6_letters", "7_plus",
   "vowel_drop", "anagram_scrambled", "reverse_wordle", "missing_letter",
   "word_ladder", "rhyme_match", "letter_count",
]);

export function isLegacyCategory(category: string): boolean {
   return LEGACY_CATEGORIES.has(category);
}

export function isProceduralCategory(category: string): boolean {
   return !LEGACY_CATEGORIES.has(category);
}

export class GeneratorRegistry {
   private static proceduralGenerators: Map<string, QuizGenerator> = new Map();

   static initialize(): void {
      const generators = [
         capitalsClashGenerator,
         currencyExchangeGenerator,
         flagBearerGenerator,
         mentalMathBlitzGenerator,
         sequenceSolverGenerator,
         elementArenaGenerator,
         animalKingdomGenerator,
         cosmicFrontierGenerator,
         cinephileTriviaGenerator,
         historyMilestonesGenerator,
      ];
      for (const gen of generators) {
         this.proceduralGenerators.set(gen.id, gen);
      }
   }

   static getProceduralGenerators(): Map<string, QuizGenerator> {
      if (this.proceduralGenerators.size === 0) {
         this.initialize();
      }
      return this.proceduralGenerators;
   }

   static async compileMatchQuestions(
      category: string,
      seed: string,
      fetchEntities?: (type: string, count: number) => Promise<any[]>,
   ): Promise<BaseQuestion[]> {
      // Legacy word categories → client-side engine
      if (isLegacyCategory(category)) {
          return await generateLegacyBatch(category, seed);
      }

      // Procedural routing
      const generator = this.getProceduralGenerators().get(category);
      if (!generator) {
         console.warn(`[GeneratorRegistry] No generator found for category "${category}". Falling back to legacy.`);
         return await generateLegacyBatch("mixed", seed);
      }

      let entities: any[] = [];
      if (fetchEntities) {
         try {
            entities = await fetchEntities(category, 7);
         } catch (err) {
            console.warn("[GeneratorRegistry] Entity fetch failed, using fallback:", err);
         }
      }

      const questions: BaseQuestion[] = [];
      for (let i = 0; i < 7; i++) {
         const entitySeed = `${seed}-${i}`;
         const entity = entities[i] || undefined;
         questions.push(generator.generate(entitySeed, entity));
      }

      return questions;
   }
}
