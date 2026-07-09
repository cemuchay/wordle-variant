export interface WordUpQuestion {
   type:
      | "real_fake"
      | "length"
      | "missing_letter"
      | "reverse_wordle"
      | "definition"
      | "anagram"
      | "anagram_scrambled"
      | "pattern"
      | "math"
      | "odd_one_out"
      | "vowel_drop"
      | "rhyme_match"
      | "letter_count"
      | "word_ladder"
      | "synonym_match"
      | "word_chain"
      | "letter_shift"
      | "compound_break"
      | "word_within"
      | "cryptogram"
      | "category_sort"
      | "letter_add_remove";
   prompt: string;
   subPrompt?: string; // Additional context (e.g., target word in reverse Wordle)
   choices: string[];
   answer: string;
   explanation?: string; // Shown after the game to explain why the correct answer is right
   imageUrl?: string; // Optional URL pointing to the Supabase Storage bucket asset
   imageUrls?: string[]; // Optional array of image codes/urls for multi-image questions
}

export const getQuestionImageUrl = (path: string): string => {
   const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
   return `${supabaseUrl}/storage/v1/object/public/wordup-questions/${path}`;
};
