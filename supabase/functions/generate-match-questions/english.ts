import { createSeededRandom, seededShuffle } from "./utils.ts";

export function generateEnglishQuestion(
   seed: string,
   entity: any,
   allEntities: any[],
   rng: () => number,
   variant: number,
   proceduralWeight: number = 0.5,
): any {
   const logPrefix = "[english.ts]";
   const useDB = entity && rng() > proceduralWeight;
   console.log(
      `${logPrefix} seed=${seed} entity=${entity?.label ?? "null"} useDB=${useDB} variant=${variant}`,
   );

   if (!useDB || !entity) {
      const qIdx = Math.floor(rng() * 4);
      console.log(`${logPrefix} Procedural question qIdx=${qIdx}`);
      if (qIdx === 0) {
         // Verb Subject Agreement
         console.log(
            `${logPrefix} Generating grammar/subject-verb agreement question`,
         );

         // Helper to pick a random item using your seeded rng
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         const getEl = (arr: string | any[]) =>
            arr[Math.floor(rng() * arr.length)];

         // Pattern 1: Routine Actions (Singular vs Plural subject)
         const genRoutine = () => {
            const time = getEl([
               "Every morning",
               "Every Sunday",
               "Each evening",
               "During the week",
               "On weekends",
            ]);
            const isSingular = rng() > 0.5;

            if (isSingular) {
               const sub = getEl([
                  "father",
                  "brother",
                  "friend",
                  "colleague",
                  "neighbor",
               ]);
               const action = getEl([
                  {
                     o: "the newspaper",
                     c: "reads",
                     f: ["read", "reading", "readed"],
                  },
                  {
                     o: "an email",
                     c: "writes",
                     f: ["write", "writing", "writed"],
                  },
                  {
                     o: "the mail",
                     c: "checks",
                     f: ["check", "checking", "checked"],
                  },
               ]);
               return {
                  s: `${time}, my ${sub} ___ ${action.o}.`,
                  c: action.c,
                  f: action.f,
               };
            } else {
               const sub = getEl([
                  "parents",
                  "brothers",
                  "friends",
                  "colleagues",
                  "neighbors",
               ]);
               const action = getEl([
                  {
                     o: "the newspaper",
                     c: "read",
                     f: ["reads", "reading", "readed"],
                  },
                  {
                     o: "emails",
                     c: "write",
                     f: ["writes", "writing", "writed"],
                  },
                  {
                     o: "the mail",
                     c: "check",
                     f: ["checks", "checking", "checked"],
                  },
               ]);
               return {
                  s: `${time}, my ${sub} ___ ${action.o}.`,
                  c: action.c,
                  f: action.f,
               };
            }
         };

         // Pattern 2: Neither/Either (Singular verb rule)
         const genNeither = () => {
            const start = getEl(["Neither of", "Either of", "One of"]);
            const group = getEl([
               "the boys",
               "the girls",
               "the students",
               "the players",
               "the members",
            ]);
            const end = getEl([
               "there yesterday",
               "at the meeting",
               "in the room",
               "prepared",
               "ready",
            ]);
            const isPast = rng() > 0.5;

            if (isPast) {
               return {
                  s: `${start} ${group} ___ ${end}.`,
                  c: "was",
                  f: ["were", "are", "been"],
               };
            } else {
               return {
                  s: `${start} ${group} ___ ${end}.`,
                  c: "is",
                  f: ["are", "were", "be"],
               };
            }
         };

         // Pattern 3: Collective Nouns (Singular verb rule)
         const genCollective = () => {
            const t = getEl([
               {
                  g: "pack of wolves",
                  v: "runs",
                  f: ["run", "running", "runner"],
                  e: "through the forest",
               },
               {
                  g: "flock of birds",
                  v: "flies",
                  f: ["fly", "flying", "flown"],
                  e: "in the sky",
               },
               {
                  g: "team of players",
                  v: "practices",
                  f: ["practice", "practicing", "practiced"],
                  e: "on the field",
               },
               {
                  g: "herd of cattle",
                  v: "grazes",
                  f: ["graze", "grazing", "grazed"],
                  e: "in the meadow",
               },
               {
                  g: "swarm of bees",
                  v: "buzzes",
                  f: ["buzz", "buzzing", "buzzed"],
                  e: "near the hive",
               },
            ]);
            return { s: `The ${t.g} ___ ${t.e}.`, c: t.v, f: t.f };
         };

         // Pattern 4: Compound Subjects connected by 'and' (Plural verb rule)
         const genCompound = () => {
            const s1 = getEl([
               "She",
               "He",
               "My brother",
               "The teacher",
               "John",
            ]);
            const s2 = getEl([
               "her sister",
               "his friend",
               "my cousin",
               "the student",
               "Sarah",
            ]);
            const action = getEl([
               {
                  o: "soccer on weekends",
                  c: "play",
                  f: ["plays", "playing", "played"],
               },
               {
                  o: "math together",
                  c: "study",
                  f: ["studies", "studying", "studied"],
               },
               {
                  o: "movies on Friday",
                  c: "watch",
                  f: ["watches", "watching", "watched"],
               },
               {
                  o: "at the cafe",
                  c: "work",
                  f: ["works", "working", "worked"],
               },
            ]);
            return {
               s: `${s1} and ${s2} ___ ${action.o}.`,
               c: action.c,
               f: action.f,
            };
         };

         // Randomly pick one of the four grammar rules to test
         const patterns = [genRoutine, genNeither, genCollective, genCompound];
         const choice = getEl(patterns)(); // Execute the chosen generator

         const correct = choice.c;
         return {
            type: "english_grammar",
            prompt: `Choose the correct word to complete the sentence:\n"${choice.s}"`,
            choices: seededShuffle(
               [...new Set([correct, ...choice.f])].slice(0, 4),
               rng,
            ),
            answer: correct,
         };
      }

      if (qIdx === 1) {
         // Plurals
         console.log(`${logPrefix} Generating plural question`);
         const plurals = [
            {
               word: "child",
               c: "children",
               f: ["childs", "childrens", "childes"],
            },
            { word: "cactus", c: "cacti", f: ["cactuses", "cactus", "cactii"] },
            { word: "ox", c: "oxen", f: ["oxes", "oxs", "oxens"] },
            {
               word: "criterion",
               c: "criteria",
               f: ["criterions", "criterias", "criteriones"],
            },
            {
               word: "phenomenon",
               c: "phenomena",
               f: ["phenomenons", "phenomenas", "phenomenon"],
            },
         ];
         const choice = plurals[Math.floor(rng() * plurals.length)];
         const correct = choice.c;
         return {
            type: "english_plural",
            prompt: `What is the correct plural form of the word "${choice.word}"?`,
            choices: seededShuffle(
               [...new Set([correct, ...choice.f])].slice(0, 4),
               rng,
            ),
            answer: correct,
         };
      }

      if (qIdx === 2) {
         // Spelling
         console.log(`${logPrefix} Generating spelling question`);
         const spellings = [
            { c: "definitely", f: ["definately", "definitly", "definatley"] },
            { c: "necessary", f: ["neccessary", "necesary", "neccesary"] },
            { c: "receive", f: ["recieve", "receve", "recive"] },
            { c: "separate", f: ["seperate", "seperet", "separat"] },
            { c: "calendar", f: ["calender", "colendar", "calandar"] },
         ];
         const choice = spellings[Math.floor(rng() * spellings.length)];
         const correct = choice.c;
         return {
            type: "english_spelling",
            prompt: "Identify the correct spelling among the options:",
            choices: seededShuffle(
               [...new Set([correct, ...choice.f])].slice(0, 4),
               rng,
            ),
            answer: correct,
         };
      }

      // Tenses (qIdx === 3)
      console.log(`${logPrefix} Generating tense question`);
      const tenses = [
         {
            s: "They had already ___ when I arrived.",
            c: "eaten",
            f: ["ate", "eat", "eating"],
         },
         {
            s: "She has ___ three miles today.",
            c: "run",
            f: ["ran", "running", "runs"],
         },
         {
            s: "The book was ___ by a famous author.",
            c: "written",
            f: ["wrote", "write", "writing"],
         },
         {
            s: "He has ___ all his water.",
            c: "drunk",
            f: ["drank", "drink", "drinking"],
         },
      ];
      const choice = tenses[Math.floor(rng() * tenses.length)];
      const correct = choice.c;
      return {
         type: "english_tense",
         prompt: `Complete the sentence with the correct tense:\n"${choice.s}"`,
         choices: seededShuffle(
            [...new Set([correct, ...choice.f])].slice(0, 4),
            rng,
         ),
         answer: correct,
      };
   }

   console.log(
      `${logPrefix} Returning null (useDB=true, entity exists) — letting parent handle via generateQuestion`,
   );

   // If using DB entity, the parent executor will parse it via standard generateQuestion handler
   return null;
}
