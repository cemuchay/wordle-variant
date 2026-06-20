import { type QuizGenerator, type BaseQuestion, type EntitySeed } from "../../../types/generators";
import { createSeededRandom, seededShuffle, hashSeed } from "../seededRandom";

const ENTITIES: EntitySeed[] = [
   { id: "1", type: "element_arena", label: "Hydrogen", metadata: { symbol: "H", number: 1, group: "Nonmetal" }, difficulty: 1, tags: ["nonmetal"] },
   { id: "2", type: "element_arena", label: "Helium", metadata: { symbol: "He", number: 2, group: "Noble Gas" }, difficulty: 1, tags: ["noble-gas"] },
   { id: "3", type: "element_arena", label: "Carbon", metadata: { symbol: "C", number: 6, group: "Nonmetal" }, difficulty: 1, tags: ["nonmetal"] },
   { id: "4", type: "element_arena", label: "Oxygen", metadata: { symbol: "O", number: 8, group: "Nonmetal" }, difficulty: 1, tags: ["nonmetal"] },
   { id: "5", type: "element_arena", label: "Iron", metadata: { symbol: "Fe", number: 26, group: "Transition Metal" }, difficulty: 2, tags: ["metal"] },
   { id: "6", type: "element_arena", label: "Gold", metadata: { symbol: "Au", number: 79, group: "Transition Metal" }, difficulty: 2, tags: ["metal"] },
   { id: "7", type: "element_arena", label: "Silver", metadata: { symbol: "Ag", number: 47, group: "Transition Metal" }, difficulty: 2, tags: ["metal"] },
   { id: "8", type: "element_arena", label: "Sodium", metadata: { symbol: "Na", number: 11, group: "Alkali Metal" }, difficulty: 2, tags: ["metal"] },
   { id: "9", type: "element_arena", label: "Chlorine", metadata: { symbol: "Cl", number: 17, group: "Halogen" }, difficulty: 2, tags: ["halogen"] },
   { id: "10", type: "element_arena", label: "Nitrogen", metadata: { symbol: "N", number: 7, group: "Nonmetal" }, difficulty: 2, tags: ["nonmetal"] },
   { id: "11", type: "element_arena", label: "Uranium", metadata: { symbol: "U", number: 92, group: "Actinide" }, difficulty: 3, tags: ["radioactive"] },
   { id: "12", type: "element_arena", label: "Mercury", metadata: { symbol: "Hg", number: 80, group: "Transition Metal" }, difficulty: 3, tags: ["metal", "liquid"] },
   { id: "13", type: "element_arena", label: "Copper", metadata: { symbol: "Cu", number: 29, group: "Transition Metal" }, difficulty: 2, tags: ["metal"] },
   { id: "14", type: "element_arena", label: "Aluminum", metadata: { symbol: "Al", number: 13, group: "Post-Transition Metal" }, difficulty: 2, tags: ["metal"] },
   { id: "15", type: "element_arena", label: "Calcium", metadata: { symbol: "Ca", number: 20, group: "Alkaline Earth Metal" }, difficulty: 2, tags: ["metal"] },
   { id: "16", type: "element_arena", label: "Lead", metadata: { symbol: "Pb", number: 82, group: "Post-Transition Metal" }, difficulty: 3, tags: ["metal"] },
   { id: "17", type: "element_arena", label: "Platinum", metadata: { symbol: "Pt", number: 78, group: "Transition Metal" }, difficulty: 3, tags: ["metal", "precious"] },
   { id: "18", type: "element_arena", label: "Silicon", metadata: { symbol: "Si", number: 14, group: "Metalloid" }, difficulty: 2, tags: ["metalloid"] },
   { id: "19", type: "element_arena", label: "Xenon", metadata: { symbol: "Xe", number: 54, group: "Noble Gas" }, difficulty: 4, tags: ["noble-gas"] },
   { id: "20", type: "element_arena", label: "Tungsten", metadata: { symbol: "W", number: 74, group: "Transition Metal" }, difficulty: 4, tags: ["metal"] },
];

export const elementArenaGenerator: QuizGenerator = {
   id: "element_arena",
   weight: 1,
   supports(category: string) {
      return category === "element_arena";
   },
   generate(seed: string, entity?: EntitySeed): BaseQuestion {
      const rng = createSeededRandom(hashSeed(seed));
      const idx = Math.floor(rng() * ENTITIES.length);
      const chosen = entity || ENTITIES[idx];
      const correct = chosen.label;
      const symbol = chosen.metadata.symbol as string;
      const number = chosen.metadata.number as number;
      const group = chosen.metadata.group as string;

      const variant = Math.floor(rng() * 3);
      const distractors = ENTITIES
         .filter((e) => e.label !== correct)
         .sort(() => rng() - 0.5)
         .slice(0, 3)
         .map((e) => e.label);

      const options = seededShuffle([correct, ...distractors], rng);

      let question: string;
      if (variant === 0) {
         question = `What is the chemical symbol for ${correct}?`;
         const symbolOpts = seededShuffle(
            [symbol, ...ENTITIES.filter((e) => e.label !== correct).sort(() => rng() - 0.5).slice(0, 3).map((e) => e.metadata.symbol as string)],
            rng
         );
         return {
            id: seed,
            question,
            options: symbolOpts,
            answer: symbol,
            explanation: `${correct} has the symbol ${symbol} and atomic number ${number}.`,
            metadata: { generatorId: "element_arena", entityId: chosen.id },
         };
      } else if (variant === 1) {
         question = `"${symbol}" is the chemical symbol for which element?`;
      } else {
         question = `Which element is in the ${group} group with atomic number ${number}?`;
      }

      return {
         id: seed,
         question,
         options,
         answer: correct,
         explanation: `${correct} (${symbol}) is a ${group.toLowerCase()} with atomic number ${number}.`,
         metadata: { generatorId: "element_arena", entityId: chosen.id },
      };
   },
};
