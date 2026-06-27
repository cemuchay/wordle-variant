export type SuperCategory = "biography" | "creative_work" | "science_facts" | "calculations" | "language_arts";

export interface Question {
   type: string;
   prompt: string;
   choices: string[];
   answer: string;
   subPrompt?: string;
   explanation?: string;
   imageUrl?: string;
}

export interface Entity {
   id: string;
   type: string;
   label: string;
   metadata: Record<string, any>;
   difficulty?: number;
   tags?: string[];
}

export const CATEGORY_SUPER_MAP: Record<string, SuperCategory> = {
   // Science & General Facts
   capitals_clash: "science_facts",
   currency_exchange: "science_facts",
   flag_bearer: "science_facts",
   element_arena: "science_facts",
   animal_kingdom: "science_facts",
   cosmic_frontier: "science_facts",
   history_milestones: "science_facts",
   unn_lions: "science_facts",
   nysc_trivia: "science_facts",
   us_tech_trivia: "science_facts",
   
   // Biography (focused on individuals)
   naija_celebs: "biography",
   elon_musk: "biography",
   
   // Creative Works (movies, books, music)
   cinephile_trivia: "creative_work",
   naija_music: "creative_work",
   
     // Unified topics
     maths: "calculations",
     english_language: "language_arts",
     english_fundamentals: "language_arts",
     
      // Entity-based science categories
      physics: "science_facts",
      chemistry: "science_facts",
      biology: "science_facts"
};


