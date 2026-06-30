export interface CuratedSentenceTemplate {
   id: string;
   template: (string | string[])[];
}

export const CURATED_SENTENCE_TEMPLATES: CuratedSentenceTemplate[] = [
   // 3-word templates
   { id: "3_1", template: ["THE", ["CAT", "DOG", "FOX", "BEAR", "LION"], ["SLEEPS", "WALKS", "RUNS", "JUMPS", "PLAYS"]] },
   { id: "3_2", template: ["MANY", ["BIRDS", "FROGS", "DUCKS", "GEESE"], ["FLY", "SING", "SWIM", "JUMP"]] },
   { id: "3_3", template: ["YOU", ["WIN", "PLAY", "LOVE"], ["GAMES", "SPORTS", "WORDS"]] },

   // 4-word templates
   { id: "4_1", template: ["THE", ["WIND", "RAIN", "SNOW", "HEAT"], ["BLOWS", "FALLS", "COMES"], ["COLD", "FAST", "LATE", "SOON"]] },
   { id: "4_2", template: [["SOME", "MANY", "FEW"], ["BOYS", "GIRLS", "KIDS"], ["LIKE", "WANT", "LOVE"], ["TOYS", "GAMES", "BOOKS"]] },
   { id: "4_3", template: ["WILD", ["BEARS", "TIGERS", "LIONS", "WOLVES"], ["HUNT", "ROAM", "SLEEP"], ["HERE", "THERE", "TODAY"]] },

   // 5-word templates
   { id: "5_1", template: [["HAPPY", "YOUNG", "SMART"], ["KIDS", "PUPILS", "KITTENS"], ["PLAY", "STUDY", "WRITE"], ["WITH", "ABOUT", "UNDER"], ["TOYS", "BOOKS", "TREES"]] },
   { id: "5_2", template: ["THIS", ["GREAT", "CLEVER", "LOVELY"], "GAME", ["FEELS", "SEEMS", "PROVES"], ["FUN", "GOOD", "NEAT"]] },
   { id: "5_3", template: ["FRESH", ["WATER", "RIVER", "SPRING"], ["FLOWS", "RUSHES", "DRAINS"], "FROM", ["HILLS", "MOUNTAINS", "ROCKS"]] },

   // 6-word templates
   { id: "6_1", template: [["YOU", "WE", "THEY"], ["CAN", "WILL", "MUST"], ["PLAY", "ENJOY", "SHARE", "SOLVE"], "THIS", "GREAT", ["GAME", "PUZZLE", "CHALLENGE"]] },
   { id: "6_2", template: ["LIGHT", ["SHINES", "GLEAMS", "FLASHES"], "THROUGH", "THE", ["DARK", "GREY", "BLACK"], ["CLOUDS", "SHADOWS", "NIGHTS"]] },
   { id: "6_3", template: [["SMART", "YOUNG"], ["BOYS", "GIRLS"], ["RIDE", "DRIVE", "STEER"], ["FAST", "BRIGHT", "CLEAN"], ["RED", "BLUE", "GREEN"], ["BIKES", "BOATS", "CARS"]] },

   // 7-word templates
   { id: "7_1", template: ["THE", ["QUICK", "BROWN", "SLEEPY"], ["FOX", "DOG", "CAT"], ["JUMPS", "RUNS", "WALKS"], "OVER", ["LAZY", "QUIET", "YOUNG"], ["DOG", "BEAR", "COW"]] },
   { id: "7_2", template: [["THEY", "PEOPLE"], ["BUILT", "PAINTED", "BOUGHT"], ["MANY", "SHINY", "GREAT"], ["HOMES", "SHOPS", "BOATS"], ["NEAR", "ALONG", "BESIDE"], "THE", ["RIVER", "OCEAN", "FOREST"]] },

   // 8-word templates
   { id: "8_1", template: [["STRONG", "GENTLE"], ["WINDS", "BREEZES"], ["MAKE", "FORCE"], ["TALL", "YOUNG"], ["TREES", "PLANTS"], ["BEND", "SWAY"], "VERY", ["LOW", "FAST", "SLOW"]] },
   { id: "8_2", template: [["SMART", "KIND"], ["TEACHERS", "PARENTS"], ["GUIDE", "DIRECT"], ["THEIR", "YOUNG"], ["STUDENTS", "CHILDREN"], "TOWARD", ["BRIGHT", "BETTER"], ["PATHS", "GOALS"]] },

   // 9-word templates
   { id: "9_1", template: [["THREE", "SEVEN", "HAPPY"], ["SMALL", "YOUNG", "WHITE"], ["FISH", "DUCKS", "SWANS"], ["SWIM", "GLIDE"], ["UNDER", "ACROSS"], "THE", ["DEEP", "CLEAR", "BLUE"], ["LAKE", "RIVER", "POND"], ["TODAY", "DAILY"]] },
   { id: "9_2", template: ["EVERY", ["MORNING", "EVENING"], "THE", ["OLD", "KIND", "HAPPY"], ["MAN", "LADY", "CHILD"], ["WALKS", "GUIDES"], ["HIS", "THEIR"], ["LOYAL", "PLAYFUL"], ["DOG", "PONY"]] },

   // 10-word templates
   { id: "10_1", template: [["SEVEN", "COLD", "WHITE"], ["WINTER", "AUTUMN"], ["SNOWS", "STORMS"], ["COVER", "COVERS"], "THE", ["ENTIRE", "SILENT"], ["FOREST", "VALLEY"], "WITH", ["WHITE", "FRESH"], ["SHEETS", "CLOAKS"]] },
   { id: "10_2", template: [["EVERY", "EACH"], ["SINGLE", "ACTIVE"], ["MEMBER", "PLAYER"], ["WRITES", "SOLVES"], "SHORT", ["WORDS", "PUZZLES"], ["FOR", "UNDER"], ["THEIR", "DAILY"], ["CLASS", "COURSE"], ["HOURS", "TASKS"]] }
];

export function resolveSentenceTemplate(template: (string | string[])[]): string[] {
   return template.map(slot => {
      if (Array.isArray(slot)) {
         return slot[Math.floor(Math.random() * slot.length)];
      }
      return slot;
   });
}

export function getRandomCuratedSentence(wordCount: number): string[] | null {
   const candidates = CURATED_SENTENCE_TEMPLATES.filter(t => t.template.length === wordCount);
   if (candidates.length === 0) return null;
   const chosenTemplate = candidates[Math.floor(Math.random() * candidates.length)];
   return resolveSentenceTemplate(chosenTemplate.template);
}
