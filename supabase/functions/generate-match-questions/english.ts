import { createSeededRandom, seededShuffle } from "./utils.ts";

export function generateEnglishQuestion(seed: string, entity: any, allEntities: any[], rng: () => number, variant: number): any {
   // Mix: 50% chance of procedural grammar quiz, 50% chance of DB vocabulary words (if available)
   const useDB = entity && (rng() > 0.5);

   if (!useDB || !entity) {
      const qIdx = Math.floor(rng() * 4);
      if (qIdx === 0) {
         // Verb Subject Agreement
         const sentences = [
            { s: "Every morning, my father ___ the newspaper.", c: "reads", f: ["read", "reading", "readed"] },
            { s: "Neither of the boys ___ there yesterday.", c: "was", f: ["were", "are", "been"] },
            { s: "The pack of wolves ___ through the forest.", c: "runs", f: ["run", "running", "runner"] },
            { s: "She and her sister ___ soccer on weekends.", c: "play", f: ["plays", "playing", "played"] }
         ];
         const choice = sentences[Math.floor(rng() * sentences.length)];
         const correct = choice.c;
         return {
            type: "english_grammar",
            prompt: `Choose the correct word to complete the sentence:\n"${choice.s}"`,
            choices: seededShuffle([...new Set([correct, ...choice.f])].slice(0, 4), rng),
            answer: correct
         };
      }
      
      if (qIdx === 1) {
         // Plurals
         const plurals = [
            { word: "child", c: "children", f: ["childs", "childrens", "childes"] },
            { word: "cactus", c: "cacti", f: ["cactuses", "cactus", "cactii"] },
            { word: "ox", c: "oxen", f: ["oxes", "oxs", "oxens"] },
            { word: "criterion", c: "criteria", f: ["criterions", "criterias", "criteriones"] },
            { word: "phenomenon", c: "phenomena", f: ["phenomenons", "phenomenas", "phenomenon"] }
         ];
         const choice = plurals[Math.floor(rng() * plurals.length)];
         const correct = choice.c;
         return {
            type: "english_plural",
            prompt: `What is the correct plural form of the word "${choice.word}"?`,
            choices: seededShuffle([...new Set([correct, ...choice.f])].slice(0, 4), rng),
            answer: correct
         };
      }
      
      if (qIdx === 2) {
         // Spelling
         const spellings = [
            { c: "definitely", f: ["definately", "definitly", "definatley"] },
            { c: "necessary", f: ["neccessary", "necesary", "neccesary"] },
            { c: "receive", f: ["recieve", "receve", "recive"] },
            { c: "separate", f: ["seperate", "seperet", "separat"] },
            { c: "calendar", f: ["calender", "colendar", "calandar"] }
         ];
         const choice = spellings[Math.floor(rng() * spellings.length)];
         const correct = choice.c;
         return {
            type: "english_spelling",
            prompt: "Identify the correct spelling among the options:",
            choices: seededShuffle([...new Set([correct, ...choice.f])].slice(0, 4), rng),
            answer: correct
         };
      }

      // Tenses
      const tenses = [
         { s: "They had already ___ when I arrived.", c: "eaten", f: ["ate", "eat", "eating"] },
         { s: "She has ___ three miles today.", c: "run", f: ["ran", "running", "runs"] },
         { s: "The book was ___ by a famous author.", c: "written", f: ["wrote", "write", "writing"] },
         { s: "He has ___ all his water.", c: "drunk", f: ["drank", "drink", "drinking"] }
      ];
      const choice = tenses[Math.floor(rng() * tenses.length)];
      const correct = choice.c;
      return {
         type: "english_tense",
         prompt: `Complete the sentence with the correct tense:\n"${choice.s}"`,
         choices: seededShuffle([...new Set([correct, ...choice.f])].slice(0, 4), rng),
         answer: correct
      };
   }

   // If using DB entity, the parent executor will parse it via standard generateQuestion handler
   return null;
}
