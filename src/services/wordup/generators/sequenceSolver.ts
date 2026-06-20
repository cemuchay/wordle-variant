import { type QuizGenerator, type BaseQuestion } from "../../../types/generators";
import { createSeededRandom, seededShuffle } from "../seededRandom";

interface SequencePattern {
   label: string;
   generate: (rng: () => number) => { sequence: number[]; answer: number };
   difficulty: number;
}

const PATTERNS: SequencePattern[] = [
   {
      label: "add 2",
      generate: (rng) => {
         const start = Math.floor(rng() * 10) + 1;
         const seq = Array.from({ length: 4 }, (_, i) => start + i * 2);
         return { sequence: seq, answer: seq[3] + 2 };
      },
      difficulty: 1,
   },
   {
      label: "add 3",
      generate: (rng) => {
         const start = Math.floor(rng() * 10) + 1;
         const seq = Array.from({ length: 4 }, (_, i) => start + i * 3);
         return { sequence: seq, answer: seq[3] + 3 };
      },
      difficulty: 1,
   },
   {
      label: "multiply by 2",
      generate: (rng) => {
         const start = Math.floor(rng() * 5) + 1;
         const seq = Array.from({ length: 4 }, (_, i) => start * Math.pow(2, i));
         return { sequence: seq, answer: seq[3] * 2 };
      },
      difficulty: 2,
   },
   {
      label: "squares",
      generate: () => {
         const start = Math.floor(Math.random() * 5) + 1;
         const seq = Array.from({ length: 4 }, (_, i) => (start + i) ** 2);
         return { sequence: seq, answer: (start + 4) ** 2 };
      },
      difficulty: 3,
   },
   {
      label: "fibonacci style",
      generate: (rng) => {
         const a = Math.floor(rng() * 5) + 1;
         const b = Math.floor(rng() * 5) + 1;
         const seq = [a, b, a + b, a + 2 * b];
         return { sequence: seq, answer: 2 * a + 3 * b };
      },
      difficulty: 4,
   },
   {
      label: "subtract 5",
      generate: (rng) => {
         const start = Math.floor(rng() * 30) + 30;
         const seq = Array.from({ length: 4 }, (_, i) => start - i * 5);
         return { sequence: seq, answer: seq[3] - 5 };
      },
      difficulty: 1,
   },
   {
      label: "add increasing",
      generate: (rng) => {
         const start = Math.floor(rng() * 5) + 1;
         const seq = [start, start + 1, start + 3, start + 6];
         return { sequence: seq, answer: start + 10 };
      },
      difficulty: 4,
   },
   {
      label: "multiply by 3 then add 1",
      generate: (rng) => {
         const start = Math.floor(rng() * 3) + 1;
         const seq = Array.from({ length: 4 }, (_, i) => start * Math.pow(3, i) + i);
         return { sequence: seq, answer: start * Math.pow(3, 4) + 4 };
      },
      difficulty: 5,
   },
];

export const sequenceSolverGenerator: QuizGenerator = {
   id: "sequence_solver",
   weight: 1,
   supports(category: string) {
      return category === "sequence_solver";
   },
   generate(seed: string): BaseQuestion {
      const rng = createSeededRandom(seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0));
      const pattern = PATTERNS[Math.floor(rng() * PATTERNS.length)];
      const { sequence, answer } = pattern.generate(rng);

      const correct = String(answer);
      const fakes = [answer + 1, answer - 1, answer + 2, answer - 2, answer + 5, answer - 5]
         .filter((x) => x >= 0 && x !== answer)
         .slice(0, 3)
         .map(String);

      const options = seededShuffle([correct, ...fakes], rng);

      return {
         id: seed,
         question: `What is the next number in the sequence: ${sequence.join(", ")}?`,
         options,
         answer: correct,
         metadata: { generatorId: "sequence_solver" },
      };
   },
};
