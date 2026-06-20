export const CATEGORIES = [
   { id: "mixed", name: "Quick Match (Mixed)", desc: "All question types, random word lengths", type: "general" },

   // Length-based categories
   { id: "3_letters", name: "3-Letter Words", desc: "Short & fast-paced challenges", type: "length" },
   { id: "4_letters", name: "4-Letter Words", desc: "Standard patterns", type: "length" },
   { id: "5_letters", name: "5-Letter Words", desc: "Perfect for Wordle masters", type: "length" },
   { id: "6_letters", name: "6-Letter Words", desc: "Advanced length patterns", type: "length" },
   { id: "7_plus", name: "7+ Letters (Diamond)", desc: "Long and complex vocabulary", type: "length" },

   // Game-type specific categories
   { id: "vowel_drop", name: "Vowel Drop Mode", desc: "Test word recognition without vowels", type: "game_type" },
   { id: "anagram_scrambled", name: "Anagram Scramble", desc: "Decipher scrambled letters", type: "game_type" },
   { id: "reverse_wordle", name: "Reverse Wordle", desc: "Deduce target words from match grids", type: "game_type" },
   { id: "missing_letter", name: "Missing Letters", desc: "Identify the correct missing letter", type: "game_type" },
   { id: "word_ladder", name: "Word Ladder", desc: "Find words exactly one letter edit away", type: "game_type" },
   { id: "rhyme_match", name: "Rhyme Matcher", desc: "Spot rhyming words programmatically", type: "game_type" },
   { id: "letter_count", name: "Letter Counter", desc: "Count vowels or consonants rapidly", type: "game_type" },

   // Procedural knowledge categories
   { id: "capitals_clash", name: "Capital Cities", desc: "Test your knowledge of world capitals", type: "procedural" },
   { id: "currency_exchange", name: "Currencies", desc: "Match currencies to their countries", type: "procedural" },
   { id: "flag_bearer", name: "Flags", desc: "Identify countries by their flag colors", type: "procedural" },
   { id: "mental_math_blitz", name: "Mental Math", desc: "Quick arithmetic challenges", type: "procedural" },
   { id: "sequence_solver", name: "Number Sequences", desc: "Find the next number in the pattern", type: "procedural" },
   { id: "element_arena", name: "Periodic Table", desc: "Questions about chemical elements", type: "procedural" },
   { id: "animal_kingdom", name: "Animal Kingdom", desc: "Facts about animals and their habitats", type: "procedural" },
   { id: "cosmic_frontier", name: "Space & Astronomy", desc: "Explore the cosmos and celestial objects", type: "procedural" },
   { id: "cinephile_trivia", name: "Movies & Media", desc: "Trivia from classic and modern films", type: "procedural" },
   { id: "history_milestones", name: "History Eras", desc: "Key events that shaped our world", type: "procedural" },
];
