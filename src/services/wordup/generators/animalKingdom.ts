import { type QuizGenerator, type BaseQuestion, type EntitySeed } from "../../../types/generators";
import { createSeededRandom, seededShuffle } from "../seededRandom";

const ENTITIES: EntitySeed[] = [
   { id: "1", type: "animal_kingdom", label: "Lion", metadata: { class: "Mammal", habitat: "Savanna", diet: "Carnivore" }, difficulty: 1, tags: ["big-cat"] },
   { id: "2", type: "animal_kingdom", label: "Eagle", metadata: { class: "Bird", habitat: "Mountains", diet: "Carnivore" }, difficulty: 1, tags: ["raptor"] },
   { id: "3", type: "animal_kingdom", label: "Dolphin", metadata: { class: "Mammal", habitat: "Ocean", diet: "Carnivore" }, difficulty: 1, tags: ["marine"] },
   { id: "4", type: "animal_kingdom", label: "Elephant", metadata: { class: "Mammal", habitat: "Savanna", diet: "Herbivore" }, difficulty: 1, tags: ["large"] },
   { id: "5", type: "animal_kingdom", label: "Penguin", metadata: { class: "Bird", habitat: "Antarctica", diet: "Carnivore" }, difficulty: 1, tags: ["flightless"] },
   { id: "6", type: "animal_kingdom", label: "Kangaroo", metadata: { class: "Mammal", habitat: "Australia", diet: "Herbivore" }, difficulty: 2, tags: ["marsupial"] },
   { id: "7", type: "animal_kingdom", label: "Octopus", metadata: { class: "Cephalopod", habitat: "Ocean", diet: "Carnivore" }, difficulty: 2, tags: ["marine"] },
   { id: "8", type: "animal_kingdom", label: "Giraffe", metadata: { class: "Mammal", habitat: "Savanna", diet: "Herbivore" }, difficulty: 1, tags: ["tall"] },
   { id: "9", type: "animal_kingdom", label: "Crocodile", metadata: { class: "Reptile", habitat: "Swamps", diet: "Carnivore" }, difficulty: 2, tags: ["reptile"] },
   { id: "10", type: "animal_kingdom", label: "Butterfly", metadata: { class: "Insect", habitat: "Gardens", diet: "Herbivore" }, difficulty: 1, tags: ["insect"] },
   { id: "11", type: "animal_kingdom", label: "Great White Shark", metadata: { class: "Fish", habitat: "Ocean", diet: "Carnivore" }, difficulty: 2, tags: ["marine"] },
   { id: "12", type: "animal_kingdom", label: "Polar Bear", metadata: { class: "Mammal", habitat: "Arctic", diet: "Carnivore" }, difficulty: 2, tags: ["bear"] },
   { id: "13", type: "animal_kingdom", label: "Chimpanzee", metadata: { class: "Mammal", habitat: "Jungle", diet: "Omnivore" }, difficulty: 2, tags: ["primate"] },
   { id: "14", type: "animal_kingdom", label: "Komodo Dragon", metadata: { class: "Reptile", habitat: "Islands", diet: "Carnivore" }, difficulty: 3, tags: ["lizard"] },
   { id: "15", type: "animal_kingdom", label: "Blue Whale", metadata: { class: "Mammal", habitat: "Ocean", diet: "Carnivore" }, difficulty: 2, tags: ["marine", "large"] },
   { id: "16", type: "animal_kingdom", label: "Chameleon", metadata: { class: "Reptile", habitat: "Rainforest", diet: "Carnivore" }, difficulty: 2, tags: ["lizard"] },
   { id: "17", type: "animal_kingdom", label: "Honey Bee", metadata: { class: "Insect", habitat: "Meadows", diet: "Herbivore" }, difficulty: 1, tags: ["insect"] },
   { id: "18", type: "animal_kingdom", label: "Red Fox", metadata: { class: "Mammal", habitat: "Forests", diet: "Omnivore" }, difficulty: 1, tags: ["canine"] },
   { id: "19", type: "animal_kingdom", label: "Platypus", metadata: { class: "Mammal", habitat: "Australia", diet: "Carnivore" }, difficulty: 4, tags: ["monotreme"] },
   { id: "20", type: "animal_kingdom", label: "Axolotl", metadata: { class: "Amphibian", habitat: "Mexico", diet: "Carnivore" }, difficulty: 4, tags: ["neotenic"] },
];

export const animalKingdomGenerator: QuizGenerator = {
   id: "animal_kingdom",
   weight: 1,
   supports(category: string) {
      return category === "animal_kingdom";
   },
   generate(seed: string, entity?: EntitySeed): BaseQuestion {
      const rng = createSeededRandom(seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0));
      const idx = Math.floor(rng() * ENTITIES.length);
      const chosen = entity || ENTITIES[idx];
      const correct = chosen.label;
      const animalClass = chosen.metadata.class as string;
      const habitat = chosen.metadata.habitat as string;
      const diet = chosen.metadata.diet as string;

      const variant = Math.floor(rng() * 3);
      const distractors = ENTITIES
         .filter((e) => e.label !== correct)
         .sort(() => rng() - 0.5)
         .slice(0, 3)
         .map((e) => e.label);

      const options = seededShuffle([correct, ...distractors], rng);

      let question: string;
      if (variant === 0) {
         question = `Which animal is a ${animalClass.toLowerCase()} that lives in ${habitat.toLowerCase()} and is a ${diet.toLowerCase()}?`;
      } else if (variant === 1) {
         const classOptions = seededShuffle(
            [animalClass, ...["Mammal", "Bird", "Reptile", "Fish", "Amphibian", "Insect"].filter((c) => c !== animalClass).sort(() => rng() - 0.5).slice(0, 3)],
            rng
         );
         return {
            id: seed,
            question: `What biological class does the ${correct} belong to?`,
            options: classOptions,
            answer: animalClass,
            explanation: `The ${correct} is a ${animalClass.toLowerCase()}.`,
            metadata: { generatorId: "animal_kingdom", entityId: chosen.id },
         };
      } else {
         question = `${correct} is native to which habitat?`;
         const habitatOpts = seededShuffle(
            [habitat, ...["Savanna", "Ocean", "Forests", "Desert", "Arctic", "Jungle", "Australia", "Mountains"].filter((h) => h !== habitat).sort(() => rng() - 0.5).slice(0, 3)],
            rng
         );
         return {
            id: seed,
            question,
            options: habitatOpts,
            answer: habitat,
            explanation: `The ${correct} lives in ${habitat.toLowerCase()}.`,
            metadata: { generatorId: "animal_kingdom", entityId: chosen.id },
         };
      }

      return {
         id: seed,
         question,
         options,
         answer: correct,
         metadata: { generatorId: "animal_kingdom", entityId: chosen.id },
      };
   },
};
