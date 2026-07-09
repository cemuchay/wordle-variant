import type { WordUpQuestion } from "../types";

export const getDiffCount = (a: string, b: string): number => {
   let diff = 0;
   const len = Math.max(a.length, b.length);
   for (let i = 0; i < len; i++) {
      if (a[i] !== b[i]) {
         diff++;
      }
   }
   return diff;
};

export const isValidFake = (correct: string, fake: string): boolean => {
   if (correct.length > 4) {
      return getDiffCount(correct, fake) >= 2;
   }
   return correct !== fake;
};

export const rand = (min: number, max: number) =>
   Math.floor(Math.random() * (max - min + 1)) + min;

export const shuffle = <T>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);

function smartFakeAnswers(correct: number) {
   const candidates = [
      correct - 1, correct + 1, correct - 2, correct + 2,
      correct - 5, correct + 5, correct - 10, correct + 10,
      Math.floor(correct * 0.9), Math.ceil(correct * 1.1),
   ].filter((x) => x >= 0 && x !== correct);
   return shuffle([...new Set(candidates)]).slice(0, 3);
}

interface MathQuestion {
   question: string;
   answer: number;
   fakeAnswers: number[];
}

interface MathTemplate {
   generate: () => MathQuestion;
}

const MATH_TEMPLATES: MathTemplate[] = [
   {
      generate: () => {
         const a = rand(10, 99);
         const b = rand(10, 99);
         return { question: `${a} + ${b}`, answer: a + b, fakeAnswers: smartFakeAnswers(a + b) };
      },
   },
   {
      generate: () => {
         const a = rand(20, 100);
         const b = rand(5, 20);
         return { question: `${a} - ${b}`, answer: a - b, fakeAnswers: smartFakeAnswers(a - b) };
      },
   },
   {
      generate: () => {
         const a = rand(2, 15);
         const b = rand(2, 15);
         return { question: `${a} × ${b}`, answer: a * b, fakeAnswers: smartFakeAnswers(a * b) };
      },
   },
   {
      generate: () => {
         const b = rand(2, 12);
         const answer = rand(2, 20);
         const a = b * answer;
         return { question: `${a} ÷ ${b}`, answer, fakeAnswers: smartFakeAnswers(answer) };
      },
   },
];

const MATH_DEFINITIONS = [
   { question: "What is 25% of 80?", answer: 20 },
   { question: "Half of 96 is", answer: 48 },
   { question: "Double 37", answer: 74 },
   { question: "Three quarters of 40", answer: 30 },
   { question: "One DOZEN equals", answer: 12 },
   { question: "One SCORE equals", answer: 20 },
   { question: "The square of 12 is", answer: 144 },
   { question: "The cube of 4 is", answer: 64 },
   { question: "The square root of 81 is", answer: 9 },
   { question: "10² equals", answer: 100 },
   { question: "2³ equals", answer: 8 },
   { question: "The next prime number after 17 is", answer: 19 },
   { question: "The Roman numeral X represents", answer: 10 },
   { question: "The Roman numeral L represents", answer: 50 },
   { question: "A century contains", answer: 100 },
   { question: "A decade contains", answer: 10 },
   { question: "One million has how many zeros?", answer: 6 },
   { question: "One billion has how many zeros?", answer: 9 },
   { question: "360 divided by 12 equals", answer: 30 },
   { question: "15 × 15 equals", answer: 225 },
   { question: "7² equals", answer: 49 },
];

export const generateMathQuestion = (): WordUpQuestion => {
   const useDefinition = Math.random() > 0.5;
   if (useDefinition) {
      const def = MATH_DEFINITIONS[Math.floor(Math.random() * MATH_DEFINITIONS.length)];
      const fakes = smartFakeAnswers(def.answer);
      const choicesSet = new Set<string>();
      choicesSet.add(String(def.answer));
      fakes.forEach((f) => choicesSet.add(String(f)));
      while (choicesSet.size < 4) {
         choicesSet.add(String(def.answer + rand(-5, 5)));
      }
      const choices = shuffle(Array.from(choicesSet));
      return {
         type: "math", prompt: def.question, choices, answer: String(def.answer),
         explanation: `${def.question} = ${def.answer}.`,
      };
   } else {
      const template = MATH_TEMPLATES[Math.floor(Math.random() * MATH_TEMPLATES.length)];
      const q = template.generate();
      const choicesSet = new Set<string>();
      choicesSet.add(String(q.answer));
      q.fakeAnswers.forEach((f) => choicesSet.add(String(f)));
      while (choicesSet.size < 4) {
         choicesSet.add(String(q.answer + rand(-5, 5)));
      }
      const choices = shuffle(Array.from(choicesSet));
      return {
         type: "math", prompt: q.question, choices, answer: String(q.answer),
         explanation: `${q.question} = ${q.answer}.`,
      };
   }
};
