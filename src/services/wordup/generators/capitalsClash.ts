import { type QuizGenerator, type BaseQuestion, type EntitySeed } from "../../../types/generators";
import { createSeededRandom, seededShuffle } from "../seededRandom";

const ENTITIES: EntitySeed[] = [
   { id: "1", type: "capitals_clash", label: "Paris", metadata: { country: "France", continent: "Europe" }, difficulty: 1, tags: ["europe"] },
   { id: "2", type: "capitals_clash", label: "London", metadata: { country: "United Kingdom", continent: "Europe" }, difficulty: 1, tags: ["europe"] },
   { id: "3", type: "capitals_clash", label: "Berlin", metadata: { country: "Germany", continent: "Europe" }, difficulty: 1, tags: ["europe"] },
   { id: "4", type: "capitals_clash", label: "Rome", metadata: { country: "Italy", continent: "Europe" }, difficulty: 1, tags: ["europe"] },
   { id: "5", type: "capitals_clash", label: "Madrid", metadata: { country: "Spain", continent: "Europe" }, difficulty: 1, tags: ["europe"] },
   { id: "6", type: "capitals_clash", label: "Moscow", metadata: { country: "Russia", continent: "Europe" }, difficulty: 2, tags: ["europe"] },
   { id: "7", type: "capitals_clash", label: "Tokyo", metadata: { country: "Japan", continent: "Asia" }, difficulty: 2, tags: ["asia"] },
   { id: "8", type: "capitals_clash", label: "Beijing", metadata: { country: "China", continent: "Asia" }, difficulty: 2, tags: ["asia"] },
   { id: "9", type: "capitals_clash", label: "New Delhi", metadata: { country: "India", continent: "Asia" }, difficulty: 2, tags: ["asia"] },
   { id: "10", type: "capitals_clash", label: "Seoul", metadata: { country: "South Korea", continent: "Asia" }, difficulty: 2, tags: ["asia"] },
   { id: "11", type: "capitals_clash", label: "Ottawa", metadata: { country: "Canada", continent: "North America" }, difficulty: 2, tags: ["north-america"] },
   { id: "12", type: "capitals_clash", label: "Washington D.C.", metadata: { country: "United States", continent: "North America" }, difficulty: 2, tags: ["north-america"] },
   { id: "13", type: "capitals_clash", label: "Brasilia", metadata: { country: "Brazil", continent: "South America" }, difficulty: 3, tags: ["south-america"] },
   { id: "14", type: "capitals_clash", label: "Buenos Aires", metadata: { country: "Argentina", continent: "South America" }, difficulty: 3, tags: ["south-america"] },
   { id: "15", type: "capitals_clash", label: "Canberra", metadata: { country: "Australia", continent: "Oceania" }, difficulty: 3, tags: ["oceania"] },
   { id: "16", type: "capitals_clash", label: "Cairo", metadata: { country: "Egypt", continent: "Africa" }, difficulty: 3, tags: ["africa"] },
   { id: "17", type: "capitals_clash", label: "Nairobi", metadata: { country: "Kenya", continent: "Africa" }, difficulty: 3, tags: ["africa"] },
   { id: "18", type: "capitals_clash", label: "Abuja", metadata: { country: "Nigeria", continent: "Africa" }, difficulty: 3, tags: ["africa"] },
   { id: "19", type: "capitals_clash", label: "Reykjavik", metadata: { country: "Iceland", continent: "Europe" }, difficulty: 4, tags: ["europe"] },
   { id: "20", type: "capitals_clash", label: "Ulaanbaatar", metadata: { country: "Mongolia", continent: "Asia" }, difficulty: 5, tags: ["asia"] },
];

export const capitalsClashGenerator: QuizGenerator = {
   id: "capitals_clash",
   weight: 1,
   supports(category: string) {
      return category === "capitals_clash";
   },
   generate(seed: string, entity?: EntitySeed): BaseQuestion {
      const rng = createSeededRandom(seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0));
      const idx = Math.floor(rng() * ENTITIES.length);
      const chosen = entity || ENTITIES[idx];
      const correct = chosen.label;
      const country = chosen.metadata.country as string;

      const distractors = ENTITIES
         .filter((e) => e.label !== correct)
         .sort(() => rng() - 0.5)
         .slice(0, 3)
         .map((e) => e.label);

      const options = seededShuffle([correct, ...distractors], rng);

      return {
         id: seed,
         question: `What is the capital of ${country}?`,
         options,
         answer: correct,
         explanation: `${correct} is the capital of ${country}.`,
         metadata: { generatorId: "capitals_clash", entityId: chosen.id },
      };
   },
};
