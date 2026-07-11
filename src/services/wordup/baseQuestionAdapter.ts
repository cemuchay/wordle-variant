import type { BaseQuestion } from "../../types/generators";
import type { WordUpQuestion } from "../../utils/wordupQuestionGenerator";

/**
 * Converts a BaseQuestion (from service-layer generators like capitalsClash,
 * flagBearer, etc.) into a WordUpQuestion consumable by the game pipeline.
 *
 * BaseQuestion fields map as:
 *   question  → prompt
 *   options   → choices
 *   answer    → answer
 *   explanation → explanation
 *
 * The `type` field is set to "definition" since entity-based generators
 * produce definition-style questions. If the generator's id is a known
 * WordUpQuestion type, it is used instead.
 */
const KNOWN_TYPES = new Set([
  "real_fake", "length", "missing_letter", "reverse_wordle", "definition",
  "anagram", "anagram_scrambled", "pattern", "math", "odd_one_out",
  "vowel_drop", "rhyme_match", "letter_count", "word_ladder",
  "synonym_match", "word_chain", "letter_shift", "compound_break",
  "word_within", "cryptogram", "category_sort", "letter_add_remove",
]);

export function baseQuestionToWordUpQuestion(
  base: BaseQuestion,
  typeHint?: string,
): WordUpQuestion {
  const type = typeHint && KNOWN_TYPES.has(typeHint as WordUpQuestion["type"])
    ? (typeHint as WordUpQuestion["type"])
    : "definition";

  return {
    type,
    prompt: base.question,
    choices: base.options,
    answer: base.answer,
    explanation: base.explanation,
    imageUrl: base.imageUrl,
    imageUrls: base.imageUrls,
  };
}

export function baseQuestionsToWordUpQuestions(
  bases: BaseQuestion[],
  typeHint?: string,
): WordUpQuestion[] {
  return bases.map((b) => baseQuestionToWordUpQuestion(b, typeHint));
}
