import { generateWordUpQuestions } from "../../utils/wordupQuestionGenerator";
import { type BaseQuestion } from "../../types/generators";

export async function generateLegacyWordQuestion(category: string, seed: string): Promise<BaseQuestion> {
   const questions = await generateWordUpQuestions(category);
   const q = questions[0];
   return {
      id: seed,
      question: q.prompt,
      options: q.choices,
      answer: q.answer,
      explanation: q.explanation || q.subPrompt,
      metadata: { generatorId: "legacy", entityId: seed },
   };
}

export async function generateLegacyBatch(category: string, seed: string): Promise<BaseQuestion[]> {
   const questions = await generateWordUpQuestions(category);
   return questions.map((q, i) => ({
      id: `${seed}-${i}`,
      question: q.prompt,
      options: q.choices,
      answer: q.answer,
      explanation: q.explanation || q.subPrompt,
      metadata: { generatorId: "legacy", entityId: `${seed}-${i}` },
   }));
}
