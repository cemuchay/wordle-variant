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

  let prompt = base.question;
  let choices = [...(base.options || [])];
  let answer = base.answer;
  let explanation = base.explanation;

  // Guard against self-referential / tautological choices in relational questions
  if (prompt && answer) {
    const promptLower = prompt.toLowerCase();
    const isRelational = promptLower.includes("same continent") ||
      promptLower.includes("shares the same") ||
      promptLower.includes("in the same") ||
      promptLower.includes("shares a border with");

    if (isRelational) {
      const match = prompt.match(/(?:as|with|and)\s+([A-Z][a-z0-9\s]+?)(?:\?|\.|$|\))/i);
      const targetEntity = match ? match[1].trim().toLowerCase() : "";

      if (targetEntity) {
        if (answer.toLowerCase() === targetEntity) {
          const valid = choices.filter((c) => c.toLowerCase() !== targetEntity);
          if (valid.length > 0) {
            answer = valid[0];
            if (explanation) explanation = explanation.replace(new RegExp(targetEntity, "gi"), answer);
          }
        }
        choices = choices.filter((c) => c.toLowerCase() !== targetEntity);
        if (!choices.includes(answer)) choices.push(answer);
      }
    }
  }

  return {
    type,
    prompt,
    choices,
    answer,
    explanation,
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
