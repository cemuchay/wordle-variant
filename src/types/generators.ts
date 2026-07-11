export interface BaseQuestion {
   id: string;
   question: string;
   options: string[];
   answer: string;
   explanation?: string;
   imageUrl?: string;
   imageUrls?: string[];
   metadata?: {
      generatorId: string;
      entityId?: string;
   };
}

export interface QuizGenerator {
   id: string;
   weight: number;
   supports(category: string): boolean;
   generate(seed: string, entity?: EntitySeed): BaseQuestion;
}

export interface EntitySeed {
   id: string;
   type: string;
   label: string;
   metadata: Record<string, unknown>;
   difficulty: number;
   tags: string[];
}
