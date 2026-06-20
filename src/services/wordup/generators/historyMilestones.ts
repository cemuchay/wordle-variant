import { type QuizGenerator, type BaseQuestion, type EntitySeed } from "../../../types/generators";
import { createSeededRandom, seededShuffle, hashSeed } from "../seededRandom";

const ENTITIES: EntitySeed[] = [
   { id: "1", type: "history_milestones", label: "World War II", metadata: { year: 1939, endYear: 1945, era: "20th Century" }, difficulty: 1, tags: ["war"] },
   { id: "2", type: "history_milestones", label: "The French Revolution", metadata: { year: 1789, endYear: 1799, era: "18th Century" }, difficulty: 2, tags: ["revolution"] },
   { id: "3", type: "history_milestones", label: "The Moon Landing", metadata: { year: 1969, endYear: 1969, era: "20th Century" }, difficulty: 1, tags: ["space"] },
   { id: "4", type: "history_milestones", label: "The Industrial Revolution", metadata: { year: 1760, endYear: 1840, era: "18th Century" }, difficulty: 2, tags: ["technology"] },
   { id: "5", type: "history_milestones", label: "The Fall of the Berlin Wall", metadata: { year: 1989, endYear: 1989, era: "20th Century" }, difficulty: 2, tags: ["cold-war"] },
   { id: "6", type: "history_milestones", label: "The Renaissance", metadata: { year: 1300, endYear: 1600, era: "Medieval" }, difficulty: 2, tags: ["culture"] },
   { id: "7", type: "history_milestones", label: "The American Civil War", metadata: { year: 1861, endYear: 1865, era: "19th Century" }, difficulty: 2, tags: ["war"] },
   { id: "8", type: "history_milestones", label: "The Discovery of America", metadata: { year: 1492, endYear: 1492, era: "15th Century" }, difficulty: 1, tags: ["exploration"] },
   { id: "9", type: "history_milestones", label: "World War I", metadata: { year: 1914, endYear: 1918, era: "20th Century" }, difficulty: 1, tags: ["war"] },
   { id: "10", type: "history_milestones", label: "The Signing of Magna Carta", metadata: { year: 1215, endYear: 1215, era: "Medieval" }, difficulty: 3, tags: ["law"] },
   { id: "11", type: "history_milestones", label: "The Invention of the Internet", metadata: { year: 1983, endYear: 1983, era: "20th Century" }, difficulty: 2, tags: ["technology"] },
   { id: "12", type: "history_milestones", label: "The Ancient Egyptian Pyramids", metadata: { year: -2560, endYear: -2560, era: "Ancient" }, difficulty: 2, tags: ["ancient"] },
   { id: "13", type: "history_milestones", label: "The Cold War", metadata: { year: 1947, endYear: 1991, era: "20th Century" }, difficulty: 2, tags: ["war"] },
   { id: "14", type: "history_milestones", label: "The Wright Brothers' First Flight", metadata: { year: 1903, endYear: 1903, era: "20th Century" }, difficulty: 2, tags: ["technology"] },
   { id: "15", type: "history_milestones", label: "The Black Death", metadata: { year: 1347, endYear: 1351, era: "Medieval" }, difficulty: 3, tags: ["disease"] },
   { id: "16", type: "history_milestones", label: "The Apollo Program", metadata: { year: 1961, endYear: 1972, era: "20th Century" }, difficulty: 2, tags: ["space"] },
   { id: "17", type: "history_milestones", label: "The Fall of the Roman Empire", metadata: { year: 476, endYear: 476, era: "Ancient" }, difficulty: 3, tags: ["empire"] },
   { id: "18", type: "history_milestones", label: "The Manhattan Project", metadata: { year: 1942, endYear: 1945, era: "20th Century" }, difficulty: 3, tags: ["war", "science"] },
   { id: "19", type: "history_milestones", label: "The Berlin Airlift", metadata: { year: 1948, endYear: 1949, era: "20th Century" }, difficulty: 4, tags: ["cold-war"] },
   { id: "20", type: "history_milestones", label: "The Treaty of Westphalia", metadata: { year: 1648, endYear: 1648, era: "17th Century" }, difficulty: 5, tags: ["diplomacy"] },
];

export const historyMilestonesGenerator: QuizGenerator = {
   id: "history_milestones",
   weight: 1,
   supports(category: string) {
      return category === "history_milestones";
   },
   generate(seed: string, entity?: EntitySeed): BaseQuestion {
      const rng = createSeededRandom(hashSeed(seed));
      const idx = Math.floor(rng() * ENTITIES.length);
      const chosen = entity || ENTITIES[idx];
      const correct = chosen.label;
      const year = chosen.metadata.year as number;
      const era = chosen.metadata.era as string;

      const variant = Math.floor(rng() * 3);
      const distractors = ENTITIES
         .filter((e) => e.label !== correct)
         .sort(() => rng() - 0.5)
         .slice(0, 3)
         .map((e) => e.label);

      const options = seededShuffle([correct, ...distractors], rng);

      if (variant === 0) {
         const yearStr = year < 0 ? `${Math.abs(year)} BC` : String(year);
         return {
            id: seed,
            question: `Which historical event occurred in the year ${yearStr}?`,
            options,
            answer: correct,
            explanation: `${correct} took place around ${yearStr}.`,
            metadata: { generatorId: "history_milestones", entityId: chosen.id },
         };
      } else if (variant === 1) {
         const yearCandidates = [year + 1, year - 1, year + 5, year - 5, year + 10, year - 10]
            .filter((y) => y > -3000 && y < 2025 && y !== year)
            .slice(0, 3)
            .map((y) => y < 0 ? `${Math.abs(y)} BC` : String(y));
         const yearStr = year < 0 ? `${Math.abs(year)} BC` : String(year);
         const yearOptions = seededShuffle([yearStr, ...yearCandidates], rng);
         return {
            id: seed,
            question: `In what year did ${correct} occur?`,
            options: yearOptions,
            answer: yearStr,
            metadata: { generatorId: "history_milestones", entityId: chosen.id },
         };
      } else {
         return {
            id: seed,
            question: `"${correct}" belongs to which historical era?`,
            options: seededShuffle(
               [era, ...["Ancient", "Medieval", "15th Century", "17th Century", "18th Century", "19th Century", "20th Century", "21st Century"]
                  .filter((e) => e !== era)
                  .sort(() => rng() - 0.5)
                  .slice(0, 3)],
               rng
            ),
            answer: era,
            explanation: `${correct} took place during the ${era.toLowerCase()} era.`,
            metadata: { generatorId: "history_milestones", entityId: chosen.id },
         };
      }
   },
};
