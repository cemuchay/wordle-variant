import { type QuizGenerator, type BaseQuestion, type EntitySeed } from "../../../types/generators";
import { createSeededRandom, seededShuffle, hashSeed } from "../seededRandom";

const ENTITIES: EntitySeed[] = [
   { id: "1", type: "cosmic_frontier", label: "Mars", metadata: { type: "Planet", distance: "225M km", fact: "The Red Planet" }, difficulty: 1, tags: ["planet"] },
   { id: "2", type: "cosmic_frontier", label: "Moon", metadata: { type: "Satellite", distance: "384K km", fact: "Earth's only natural satellite" }, difficulty: 1, tags: ["satellite"] },
   { id: "3", type: "cosmic_frontier", label: "Sun", metadata: { type: "Star", distance: "149.6M km", fact: "Our solar system's star" }, difficulty: 1, tags: ["star"] },
   { id: "4", type: "cosmic_frontier", label: "Saturn", metadata: { type: "Planet", distance: "1.4B km", fact: "Known for its rings" }, difficulty: 1, tags: ["planet"] },
   { id: "5", type: "cosmic_frontier", label: "Andromeda", metadata: { type: "Galaxy", distance: "2.5M ly", fact: "Nearest major galaxy" }, difficulty: 2, tags: ["galaxy"] },
   { id: "6", type: "cosmic_frontier", label: "Neptune", metadata: { type: "Planet", distance: "4.5B km", fact: "The windiest planet" }, difficulty: 2, tags: ["planet"] },
   { id: "7", type: "cosmic_frontier", label: "Venus", metadata: { type: "Planet", distance: "108M km", fact: "Hottest planet" }, difficulty: 2, tags: ["planet"] },
   { id: "8", type: "cosmic_frontier", label: "Halley's Comet", metadata: { type: "Comet", distance: "varies", fact: "Visible every 75-76 years" }, difficulty: 2, tags: ["comet"] },
   { id: "9", type: "cosmic_frontier", label: "Jupiter", metadata: { type: "Planet", distance: "778M km", fact: "Largest planet" }, difficulty: 1, tags: ["planet"] },
   { id: "10", type: "cosmic_frontier", label: "Betelgeuse", metadata: { type: "Star", distance: "642 ly", fact: "A red supergiant" }, difficulty: 3, tags: ["star"] },
   { id: "11", type: "cosmic_frontier", label: "Pluto", metadata: { type: "Dwarf Planet", distance: "5.9B km", fact: "Reclassified in 2006" }, difficulty: 2, tags: ["dwarf"] },
   { id: "12", type: "cosmic_frontier", label: "Milky Way", metadata: { type: "Galaxy", distance: "0 ly", fact: "Our home galaxy" }, difficulty: 1, tags: ["galaxy"] },
   { id: "13", type: "cosmic_frontier", label: "Titan", metadata: { type: "Satellite", distance: "1.4B km", fact: "Saturn's largest moon" }, difficulty: 3, tags: ["satellite"] },
   { id: "14", type: "cosmic_frontier", label: "Black Hole", metadata: { type: "Phenomenon", distance: "varies", fact: "Nothing escapes its gravity" }, difficulty: 2, tags: ["phenomenon"] },
   { id: "15", type: "cosmic_frontier", label: "Mercury", metadata: { type: "Planet", distance: "57.9M km", fact: "Smallest planet" }, difficulty: 2, tags: ["planet"] },
   { id: "16", type: "cosmic_frontier", label: "Supernova", metadata: { type: "Phenomenon", distance: "varies", fact: "A star's explosive death" }, difficulty: 3, tags: ["phenomenon"] },
   { id: "17", type: "cosmic_frontier", label: "International Space Station", metadata: { type: "Station", distance: "408 km", fact: "Orbiting laboratory" }, difficulty: 2, tags: ["human"] },
   { id: "18", type: "cosmic_frontier", label: "Uranus", metadata: { type: "Planet", distance: "2.9B km", fact: "Rotates on its side" }, difficulty: 3, tags: ["planet"] },
   { id: "19", type: "cosmic_frontier", label: "Proxima Centauri", metadata: { type: "Star", distance: "4.24 ly", fact: "Nearest star to the Sun" }, difficulty: 4, tags: ["star"] },
   { id: "20", type: "cosmic_frontier", label: "Pulsar", metadata: { type: "Star", distance: "varies", fact: "A rotating neutron star" }, difficulty: 5, tags: ["star"] },
];

export const cosmicFrontierGenerator: QuizGenerator = {
   id: "cosmic_frontier",
   weight: 1,
   supports(category: string) {
      return category === "cosmic_frontier";
   },
   generate(seed: string, entity?: EntitySeed): BaseQuestion {
      const rng = createSeededRandom(hashSeed(seed));
      const idx = Math.floor(rng() * ENTITIES.length);
      const chosen = entity || ENTITIES[idx];
      const correct = chosen.label;
      const type = chosen.metadata.type as string;
      const fact = chosen.metadata.fact as string;

      const variant = Math.floor(rng() * 3);
      const distractors = ENTITIES
         .filter((e) => e.label !== correct)
         .sort(() => rng() - 0.5)
         .slice(0, 3)
         .map((e) => e.label);

      const options = seededShuffle([correct, ...distractors], rng);

      let question: string;
      if (variant === 0) {
         question = `"${fact}" — what space object does this describe?`;
      } else if (variant === 1) {
         const typeOptions = seededShuffle(
            [type, ...["Planet", "Star", "Galaxy", "Satellite", "Comet", "Dwarf Planet", "Phenomenon", "Station"].filter((t) => t !== type).sort(() => rng() - 0.5).slice(0, 3)],
            rng
         );
         return {
            id: seed,
            question: `What type of space object is ${correct}?`,
            options: typeOptions,
            answer: type,
            explanation: `${correct} is a ${type.toLowerCase()}.`,
            metadata: { generatorId: "cosmic_frontier", entityId: chosen.id },
         };
      } else {
         question = `Which space object is known as "${fact}"?`;
      }

      return {
         id: seed,
         question,
         options,
         answer: correct,
         metadata: { generatorId: "cosmic_frontier", entityId: chosen.id },
      };
   },
};
