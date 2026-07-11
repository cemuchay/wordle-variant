import { type QuizGenerator, type BaseQuestion, type EntitySeed } from "../../../types/generators";
import { createSeededRandom, seededShuffle, hashSeed } from "../seededRandom";
import { getFlagCode } from "../../../utils/wordupQuestionPostProcessor";

const ENTITIES: EntitySeed[] = [
   { id: "1", type: "flag_bearer", label: "Nigeria", metadata: { colors: "Green, White, Green", stripes: 3, continent: "Africa" }, difficulty: 1, tags: ["africa"] },
   { id: "2", type: "flag_bearer", label: "France", metadata: { colors: "Blue, White, Red", stripes: 3, continent: "Europe" }, difficulty: 1, tags: ["europe"] },
   { id: "3", type: "flag_bearer", label: "Japan", metadata: { colors: "White, Red", stripes: 0, continent: "Asia" }, difficulty: 1, tags: ["asia"] },
   { id: "4", type: "flag_bearer", label: "United States", metadata: { colors: "Red, White, Blue", stripes: 13, continent: "North America" }, difficulty: 2, tags: ["north-america"] },
   { id: "5", type: "flag_bearer", label: "Brazil", metadata: { colors: "Green, Yellow, Blue, White", stripes: 0, continent: "South America" }, difficulty: 2, tags: ["south-america"] },
   { id: "6", type: "flag_bearer", label: "India", metadata: { colors: "Saffron, White, Green", stripes: 3, continent: "Asia" }, difficulty: 2, tags: ["asia"] },
   { id: "7", type: "flag_bearer", label: "United Kingdom", metadata: { colors: "Red, White, Blue", stripes: 0, continent: "Europe" }, difficulty: 2, tags: ["europe"] },
   { id: "8", type: "flag_bearer", label: "Germany", metadata: { colors: "Black, Red, Gold", stripes: 3, continent: "Europe" }, difficulty: 2, tags: ["europe"] },
   { id: "9", type: "flag_bearer", label: "South Africa", metadata: { colors: "Black, Green, Yellow, White, Red, Blue", stripes: 0, continent: "Africa" }, difficulty: 3, tags: ["africa"] },
   { id: "10", type: "flag_bearer", label: "Canada", metadata: { colors: "Red, White", stripes: 0, continent: "North America" }, difficulty: 2, tags: ["north-america"] },
   { id: "11", type: "flag_bearer", label: "Australia", metadata: { colors: "Blue, Red, White", stripes: 0, continent: "Oceania" }, difficulty: 3, tags: ["oceania"] },
   { id: "12", type: "flag_bearer", label: "China", metadata: { colors: "Red, Yellow", stripes: 0, continent: "Asia" }, difficulty: 2, tags: ["asia"] },
   { id: "13", type: "flag_bearer", label: "Italy", metadata: { colors: "Green, White, Red", stripes: 3, continent: "Europe" }, difficulty: 1, tags: ["europe"] },
   { id: "14", type: "flag_bearer", label: "Argentina", metadata: { colors: "Light Blue, White", stripes: 3, continent: "South America" }, difficulty: 3, tags: ["south-america"] },
   { id: "15", type: "flag_bearer", label: "Switzerland", metadata: { colors: "Red, White", stripes: 0, continent: "Europe" }, difficulty: 3, tags: ["europe"] },
   { id: "16", type: "flag_bearer", label: "Jamaica", metadata: { colors: "Black, Green, Yellow", stripes: 0, continent: "North America" }, difficulty: 3, tags: ["north-america"] },
   { id: "17", type: "flag_bearer", label: "Ghana", metadata: { colors: "Red, Yellow, Green, Black", stripes: 3, continent: "Africa" }, difficulty: 2, tags: ["africa"] },
   { id: "18", type: "flag_bearer", label: "Russia", metadata: { colors: "White, Blue, Red", stripes: 3, continent: "Europe" }, difficulty: 2, tags: ["europe"] },
   { id: "19", type: "flag_bearer", label: "Kenya", metadata: { colors: "Black, Red, Green, White", stripes: 0, continent: "Africa" }, difficulty: 3, tags: ["africa"] },
   { id: "20", type: "flag_bearer", label: "South Korea", metadata: { colors: "White, Red, Blue, Black", stripes: 0, continent: "Asia" }, difficulty: 3, tags: ["asia"] },
];

export const flagBearerGenerator: QuizGenerator = {
   id: "flag_bearer",
   weight: 1,
   supports(category: string) {
      return category === "flag_bearer";
   },
   generate(seed: string, entity?: EntitySeed): BaseQuestion {
      const rng = createSeededRandom(hashSeed(seed));
      const idx = Math.floor(rng() * ENTITIES.length);
      const chosen = entity || ENTITIES[idx];
      const correct = chosen.label;
      const colors = chosen.metadata.colors as string;

      const distractors = ENTITIES
         .filter((e) => e.label !== correct)
         .sort(() => rng() - 0.5)
         .slice(0, 3)
         .map((e) => e.label);

      const options = seededShuffle([correct, ...distractors], rng);
      const flagCode = getFlagCode(correct);
      const imageUrl = flagCode ? `https://flagcdn.com/${flagCode.toLowerCase()}.svg` : undefined;

      return {
         id: seed,
         question: `Which country does this flag belong to?`,
         options,
         answer: correct,
         explanation: `The flag of ${correct} features ${colors.toLowerCase()}.`,
         imageUrl,
         metadata: { generatorId: "flag_bearer", entityId: chosen.id },
      };
   },
};
