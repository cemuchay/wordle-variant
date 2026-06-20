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
   { id: "letter_count", name: "Letter Counter", desc: "Count vowels or consonants rapidly", type: "game_type" }
];
