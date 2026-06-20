import { type QuizGenerator, type BaseQuestion } from "../../../types/generators";
import { createSeededRandom, seededShuffle } from "../seededRandom";

interface MathEntity {
   a: number;
   b: number;
   op: "+" | "-" | "x" | "/";
   answer: number;
   difficulty: number;
}

function generateEntities(rng: () => number): MathEntity[] {
   const entities: MathEntity[] = [];
   for (let i = 0; i < 50; i++) {
      const opIdx = Math.floor(rng() * 4);
      let a: number, b: number, answer: number;
      switch (opIdx) {
         case 0:
            a = Math.floor(rng() * 90) + 10;
            b = Math.floor(rng() * 90) + 10;
            answer = a + b;
            break;
         case 1:
            a = Math.floor(rng() * 80) + 20;
            b = Math.floor(rng() * (a - 10)) + 10;
            answer = a - b;
            break;
         case 2:
            a = Math.floor(rng() * 12) + 2;
            b = Math.floor(rng() * 12) + 2;
            answer = a * b;
            break;
         default:
            b = Math.floor(rng() * 10) + 2;
            answer = Math.floor(rng() * 15) + 2;
            a = b * answer;
            break;
      }
      const ops = ["+", "-", "x", "/"];
      entities.push({ a, b, op: ops[opIdx] as MathEntity["op"], answer, difficulty: Math.max(1, Math.min(5, Math.floor(answer / 20) + 1)) });
   }
   return entities;
}

function smartFakeAnswers(correct: number, rng: () => number): number[] {
   const candidates = [
      correct + 1, correct - 1, correct + 2, correct - 2,
      correct + 5, correct - 5, correct + 10, correct - 10,
      Math.floor(correct * 0.9), Math.ceil(correct * 1.1),
      correct + Math.floor(rng() * 20) - 10,
   ].filter((x) => x >= 0 && x !== correct);
   return [...new Set(candidates)].sort(() => rng() - 0.5).slice(0, 3);
}

export const mentalMathBlitzGenerator: QuizGenerator = {
   id: "mental_math_blitz",
   weight: 1,
   supports(category: string) {
      return category === "mental_math_blitz";
   },
   generate(seed: string): BaseQuestion {
      const rng = createSeededRandom(seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0));
      const entities = generateEntities(rng);
      const chosen = entities[Math.floor(rng() * entities.length)];
      const correct = String(chosen.answer);

      const fakes = smartFakeAnswers(chosen.answer, rng).map(String);
      const options = seededShuffle([correct, ...fakes].slice(0, 4), rng);

      return {
         id: seed,
         question: `${chosen.a} ${chosen.op} ${chosen.b} = ?`,
         options,
         answer: correct,
         metadata: { generatorId: "mental_math_blitz" },
      };
   },
};
