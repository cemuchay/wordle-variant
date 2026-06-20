import { generateWordUpQuestions } from "../../utils/wordupQuestionGenerator";
import { type BaseQuestion } from "../../types/generators";

export function generateLegacyWordQuestion(category: string, seed: string): BaseQuestion {
   const questions = generateWordUpQuestions(category);
   const q = questions[0];
   return {
      id: seed,
      question: q.prompt,
      options: q.choices,
      answer: q.answer,
      explanation: q.subPrompt,
      metadata: { generatorId: "legacy", entityId: seed },
   };
}

export function generateLegacyBatch(category: string, seed: string): BaseQuestion[] {
   const questions = generateWordUpQuestions(category);
   return questions.map((q, i) => ({
      id: `${seed}-${i}`,
      question: q.prompt,
      options: q.choices,
      answer: q.answer,
      explanation: q.subPrompt,
      metadata: { generatorId: "legacy", entityId: `${seed}-${i}` },
   }));
}
