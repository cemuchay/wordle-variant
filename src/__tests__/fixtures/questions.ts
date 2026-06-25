import type { WordUpQuestion } from '../../utils/wordupQuestionGenerator';

export function makeQuestion(overrides: Partial<WordUpQuestion> = {}): WordUpQuestion {
  return {
    type: 'mixed',
    prompt: 'What is the capital of France?',
    choices: ['Paris', 'London', 'Berlin', 'Madrid'],
    answer: 'Paris',
    ...overrides,
  };
}

export function makeQuestionSet(count = 7): WordUpQuestion[] {
  return Array.from({ length: count }, (_, i) =>
    makeQuestion({
      type: 'mixed',
      prompt: `Question ${i + 1}`,
      choices: [`A${i}`, `B${i}`, `C${i}`, `D${i}`],
      answer: `A${i}`,
    })
  );
}

export const ENCRYPTED_KEY = 'test-encryption-key';

export function encryptedQuestions(questions: WordUpQuestion[] = makeQuestionSet()): string {
  return Buffer.from(JSON.stringify({ questions })).toString('base64');
}
