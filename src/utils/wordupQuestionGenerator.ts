// src/utils/wordupQuestionGenerator.ts

import { getWordLists } from "../data/words";

export interface WordUpQuestion {
   type:
      | "real_fake"
      | "length"
      | "missing_letter"
      | "reverse_wordle"
      | "definition"
      | "anagram"
      | "anagram_scrambled"
      | "pattern";
   prompt: string;
   subPrompt?: string; // Additional context (e.g., target word in reverse Wordle)
   choices: string[];
   answer: string;
}

// -------------------------------------------------------------
// 1. Encryption / Decryption Helpers (XOR Base64)
// -------------------------------------------------------------

export const generateSecretKey = (): string => {
   const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
   let key = "";
   for (let i = 0; i < 16; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
   }
   return key;
};

export const encryptQuestions = (
   questions: WordUpQuestion[],
   key: string,
): string => {
   const str = JSON.stringify(questions);
   let result = "";
   for (let i = 0; i < str.length; i++) {
      result += String.fromCharCode(
         str.charCodeAt(i) ^ key.charCodeAt(i % key.length),
      );
   }
   return btoa(encodeURIComponent(result));
};

export const decryptQuestions = (
   encryptedStr: string,
   key: string,
): WordUpQuestion[] => {
   const decoded = decodeURIComponent(atob(encryptedStr));
   let result = "";
   for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(
         decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length),
      );
   }
   return JSON.parse(result);
};

// -------------------------------------------------------------
// 2. Pre-curated Definitions Database (for Question Type 5)
// -------------------------------------------------------------
const DEFINITIONS: Record<string, string> = {
   AUTHOR: "A person who writes books, stories, or articles.",
   PILOT: "A person who operates the flying controls of an aircraft.",
   DOCTOR: "A qualified practitioner of medicine; a physician.",
   POET: "A person who writes poems.",
   COMPUTER: "An electronic device for storing and processing data.",
   OCEAN: "A very large expanse of sea, in particular, each of the main areas of saline water.",
   ELEPHANT:
      "A very large plant-eating mammal with a prehensile trunk and long ivory tusks.",
   GUITAR:
      "A stringed musical instrument, with six or twelve strings, played by plucking or strumming.",
   ASTRONAUT: "A person who is trained to travel in a spacecraft.",
   BAKER: "A person who makes and sells bread, cake, and pastry.",
   TEACHER:
      "A person who helps students to acquire knowledge, competence, or virtue.",
   LIBRARY:
      "A building or room containing collections of books, periodicals, and sometimes films.",
   MOUNTAIN:
      "A large natural elevation of the earth's surface rising abruptly from the surrounding level.",
   VOLCANO:
      "A mountain or hill, typically conical, having a crater or vent through which lava, rock fragments, hot vapor, and gas are or have been erupted from the earth's crust.",
   JOURNALIST:
      "A person who writes for newspapers, magazines, or news websites or prepares news to be broadcast.",
   CHEMIST:
      "An expert in chemistry, or a person engaged in chemical research or experiments.",
   SCIENTIST:
      "A person who is studying or has expert knowledge of one or more of the natural or physical sciences.",
   SOLDIER: "A person who serves in an army.",
   DENTIST:
      "A person qualified to treat the diseases and other conditions that affect the teeth and gums.",
   ENGINEER:
      "A person who designs, builds, or maintains engines, machines, or public works.",
   FIREMAN: "A person whose job is to extinguish fires.",
   LAWYER: "A person who practices or studies law; an attorney or counselor.",
   ARTIST:
      "A person who creates paintings or drawings as a profession or hobby.",
   ACTOR: "A person whose profession is acting on the stage, in films, or on television.",
   MUSICIAN:
      "A person who plays a musical instrument, especially as a profession, or is musically talented.",
   FARMER: "A person who owns or manages a farm.",
   CHEF: "A professional cook, typically the chief cook in a restaurant or hotel.",
   WAITER:
      "A man whose job is to serve customers at their tables in a restaurant.",
   NURSE: "A person trained to care for the sick or infirm, especially in a hospital.",
   POLICE:
      "The civil force of a state or municipal government, responsible for the prevention and detection of crime.",
   BREAD: "Food made of flour, water, and yeast mixed together and baked.",
   CHEESE: "A food made from the pressed curds of milk.",
   APPLE: "The round fruit of a tree of the rose family, which typically has thin green or red skin and crisp white flesh.",
   BANANA:
      "A long curved fruit which grows in clusters and has soft pulpy flesh and yellow skin.",
   COFFEE:
      "A hot drink made from the roasted and ground seeds (coffee beans) of a tropical shrub.",
   CHICKEN: "A domestic fowl kept for its eggs or meat.",
   SCHOOL: "An institution for educating children.",
   CAMERA:
      "A device for recording visual images in the form of photographs, film, or video signals.",
   TELEPHONE:
      "A system for transmitting voices over a distance using wire or radio.",
   BICYCLE:
      "A vehicle consisting of two wheels held in a frame one behind the other, propelled by pedals.",
   JOLLOF: "A rice dish cooked with tomatoes, peppers, onions, and spices.",
   PLANTAIN:
      "A starchy fruit similar to a banana, usually cooked before eating.",
   YAM: "A starchy edible tuber cultivated in tropical regions.",
   CASSAVA: "A tropical shrub cultivated for its edible starchy root.",
   OKRA: "A flowering plant cultivated for its edible green seed pods.",
   PEPPER: "The pungent fruit of various plants used as a spice or vegetable.",
   PALMOIL: "Edible oil extracted from the fruit of oil palm trees.",
   GROUNDNUT: "Another name for the peanut, an edible legume.",
   MOIMOI: "A steamed pudding made from ground beans and spices.",
   AKARA: "Deep-fried bean cakes made from peeled beans.",
   SUYA: "Spiced grilled meat prepared on skewers.",
   GARAGE: "A place where buses and taxis gather to pick up passengers.",
   MARKET: "A place where people buy and sell goods.",
   MOSQUE: "A place of worship for Muslims.",
   CHURCH: "A building used for Christian worship.",
   CAMPUS: "The grounds and buildings of a university or college.",
   HOSTEL:
      "A place providing inexpensive accommodation for students or travelers.",
   LECTURER: "A person who teaches at a university or college.",
   STUDENT: "A person who is studying at a school or university.",
   PREFECT: "A student appointed to maintain order or supervise others.",
   UNIFORM:
      "Distinctive clothing worn by members of the same organization or school.",
   KIOSK: "A small booth or shop selling goods.",
   TAILOR: "A person who makes or alters clothes.",
   BARBER: "A person who cuts and styles hair.",
   MECHANIC: "A person skilled in repairing machinery or vehicles.",
   TRADER: "A person who buys and sells goods.",
   VENDOR: "A person offering goods for sale.",
   BANKER: "A person employed by a bank.",
   ACCOUNTANT: "A person who keeps or inspects financial accounts.",
   CLERK: "An office worker responsible for records or administrative tasks.",
   PHARMACY: "A shop or department where medicines are dispensed.",
   HOSPITAL: "An institution providing medical treatment and care.",
   AMBULANCE: "A vehicle equipped for transporting sick or injured people.",
   TRAFFIC: "Vehicles moving along roads or highways.",
   HIGHWAY: "A main road, especially one connecting major towns or cities.",
   BRIDGE: "A structure built to span a river, road, or obstacle.",
   AIRPORT: "A complex where aircraft take off and land.",
   RUNWAY: "A strip of ground where aircraft take off and land.",
   PASSPORT: "An official document identifying a citizen traveling abroad.",
   VILLAGE: "A group of houses and associated buildings in a rural area.",
   CAPITAL:
      "The city that serves as the seat of government of a country or state.",
   LAGOON: "A stretch of salt water separated from the sea by a barrier.",
   RAINFALL: "The amount of rain that falls in a particular area.",
   SUNSHINE: "Direct light and heat from the sun.",
   HARMATTAN: "A dry, dusty seasonal wind that blows across West Africa.",
   GENERATOR: "A machine that produces electricity.",
   ELECTRIC: "Powered by or producing electricity.",
   BATTERY: "A device that stores and supplies electrical energy.",
   CHARGER: "A device used to recharge a battery.",
   INTERNET:
      "A global computer network providing information and communication.",
   KEYBOARD: "A panel of keys used to operate a computer.",
   MONITOR: "A screen used to display computer output.",
   PRINTER: "A machine that produces text or images on paper.",
   NOTEBOOK: "A book of blank pages for writing notes.",
   BACKPACK: "A bag carried on the back using shoulder straps.",
   UMBRELLA: "A device used for protection against rain or sunlight.",
   SANDALS: "Open shoes fastened by straps.",
   SLIPPERS: "Light footwear easily slipped on and off.",
   CEMENT: "A binding material used in construction.",
   BUILDING: "A permanent structure with walls and a roof.",
   LANDLORD: "A person who rents property to others.",
   TENANT: "A person who occupies rented property.",
   NEIGHBOR: "A person living near another.",
   COMMUNITY:
      "A group of people living in the same place or sharing common interests.",
   FESTIVAL: "An organized celebration or series of events.",
   MARRIAGE: "The legally recognized union of two people as partners.",
   BIRTHDAY: "The anniversary of the day on which a person was born.",
   HOLIDAY: "A day set aside for celebration or recreation.",
   FAMILY: "A group consisting of parents and their children.",
   COUSIN: "A child of one's aunt or uncle.",
   UNCLE: "The brother of one's parent or the husband of one's aunt.",
   AUNT: "The sister of one's parent or the wife of one's uncle.",
   GRANDMOTHER: "The mother of one's father or mother.",
   GRANDFATHER: "The father of one's father or mother.",
   ABACUS: "A frame with beads used for counting and arithmetic.",
   ACCOUNT: "A record or statement of financial transactions.",
   AIRLINE: "A company that provides air transport services.",
   ALMANAC: "An annual publication containing useful facts and statistics.",
   ANCHOR: "A heavy object used to keep a ship from drifting.",
   APRON: "A protective garment worn over clothing.",
   ARCHIVE: "A collection of historical documents or records.",
   ATHLETE: "A person trained in sports or physical exercise.",
   BALANCE: "A state in which different elements are equal or stable.",
   BALLOON:
      "A flexible bag filled with gas, often used for decoration or flight.",
   BANKING: "The business of managing money and financial services.",
   BASKET: "A container made of woven material used for carrying items.",
   BEVERAGE: "A drink other than water.",
   BLACKBOARD: "A dark board used for writing with chalk.",
   BLANKET: "A large piece of cloth used for warmth.",
   BOOKLET: "A small book with a paper cover.",
   BOTTLE: "A container with a narrow neck used for liquids.",
   BRICK: "A rectangular block used in building construction.",
   BROCHURE: "A small booklet used for advertising or information.",
   BROOM: "A cleaning tool made of stiff fibers attached to a handle.",
   BUCKET: "A round container used for carrying liquids or materials.",
   BULB: "The glass part of an electric lamp that produces light.",
   CABINET: "A cupboard or storage unit with shelves or drawers.",
   CALENDAR: "A chart showing the days, weeks, and months of the year.",
   CAPTAIN: "The person in command of a ship, aircraft, or team.",
   CARPENTER: "A person skilled in working with wood.",
   CARPET: "A thick woven floor covering.",
   CASHIER: "A person who receives payments in a shop or bank.",
   CATTLE: "Large farm animals raised for meat or milk.",
   CEILING: "The overhead interior surface of a room.",
   CELLAR: "An underground storage room.",
   CEREMONY: "A formal event performed on a special occasion.",
   CHARITY: "The voluntary giving of help to those in need.",
   CHECKUP: "A routine medical examination.",
   CHIMNEY: "A vertical passage through which smoke escapes.",
   CITIZEN: "A legally recognized member of a country.",
   CLASSROOM: "A room where teaching takes place.",
   CLIMATE: "The usual weather conditions of an area.",
   CLINIC: "A healthcare facility for outpatient treatment.",
   COLLEGE: "An institution of higher education.",
   COMPASS: "An instrument used for navigation and direction.",
   CONDUCTOR:
      "A person who collects fares on public transport or leads musicians.",
   CONTRACT: "A legally binding agreement.",
   COOKING: "The process of preparing food by heating.",
   COTTON: "A soft fiber obtained from the cotton plant.",
   COURT: "A place where legal cases are heard.",
   CULTURE: "The customs and traditions of a society.",
   CURTAIN: "A piece of fabric hung to cover a window.",
   CUSTOMER: "A person who buys goods or services.",
   CYCLIST: "A person who rides a bicycle.",
   DAIRY: "Food made from milk or a place where milk products are processed.",
   DANGER: "The possibility of harm or injury.",
   DELIVERY: "The act of transporting goods to a destination.",
   DESERT: "A dry region with little rainfall.",
   DIAMOND: "A precious gemstone made of crystallized carbon.",
   DINNER: "The main meal of the day.",
   DIPLOMA: "A certificate awarded after completing a course of study.",
   DISCOUNT: "A reduction in price.",
   DONATION: "Something given to help a person or cause.",
   DRIVER: "A person who operates a motor vehicle.",
   DROUGHT: "A prolonged period of unusually low rainfall.",
   ECLIPSE:
      "The partial or complete blocking of one celestial body by another.",
   ECONOMY: "The system of production and consumption in a country.",
   EDITION: "A particular version of a published work.",
   ELECTION: "The process of choosing leaders by voting.",
   EMBASSY: "The official residence or offices of an ambassador.",
   EMERGENCY: "A serious situation requiring immediate action.",
   EMPLOYEE: "A person who works for wages or salary.",
   ENTRANCE: "A place or way of entering.",
   ENVELOPE: "A paper cover for a letter.",
   EXAMINE: "To inspect or study carefully.",
   FACTORY: "A building where goods are manufactured.",
   FARMHOUSE: "The main house on a farm.",
   FASHION: "A popular style of dress or behavior.",
   FEATHER: "One of the soft growths covering a bird.",
   FERTILE: "Capable of producing abundant crops or offspring.",
   FINANCE: "The management of money and investments.",
   FISHERMAN: "A person who catches fish.",
   FOOTBALL: "A game played by two teams aiming to score goals with a ball.",
   FOUNTAIN: "A structure that sends water into the air.",
   FURNITURE: "Movable objects such as tables and chairs used in a home.",
   GARDENER: "A person who grows and cares for plants.",
   GASOLINE: "Fuel used in internal combustion engines.",
   GLASSES: "Lenses worn to improve vision.",
   GROCERY: "A shop selling food and household items.",
   HANDSHAKE: "A greeting in which two people clasp hands.",
   HARVEST: "The process of gathering mature crops.",
   HEADMASTER: "The principal of a school.",
   HEADMISTRESS: "The female principal of a school.",
   HELMET: "Protective headgear.",
   HIGHLAND: "An area of elevated land.",
   HOLSTER: "A holder for carrying a tool or weapon.",
   HUNTER: "A person who hunts animals.",
   ICEBERG: "A large floating mass of ice.",
   INVOICE: "A document requesting payment for goods or services.",
   JACKET: "A short coat worn on the upper body.",
   JANITOR: "A person responsible for cleaning and maintaining a building.",
   JEWELRY: "Decorative items worn for personal adornment.",
   JOURNEY: "An act of traveling from one place to another.",
   JUSTICE: "Fair treatment according to law.",
};

// -------------------------------------------------------------
// 3. Wordle Pattern Calculator (for Question Type 4)
// -------------------------------------------------------------
export const calculateWordlePattern = (
   target: string,
   guess: string,
): string => {
   const len = target.length;
   const result = new Array(len).fill("⬜");
   const targetUsed = new Array(len).fill(false);
   const guessUsed = new Array(len).fill(false);

   // Green pass
   for (let i = 0; i < len; i++) {
      if (guess[i] === target[i]) {
         result[i] = "🟩";
         targetUsed[i] = true;
         guessUsed[i] = true;
      }
   }

   // Yellow pass
   for (let i = 0; i < len; i++) {
      if (guessUsed[i]) continue;
      for (let j = 0; j < len; j++) {
         if (targetUsed[j]) continue;
         if (guess[i] === target[j]) {
            result[i] = "🟨";
            targetUsed[j] = true;
            break;
         }
      }
   }

   return result.join("");
};

// -------------------------------------------------------------
// 4. Mutation Helper (for Question Type 1: Real/Fake)
// -------------------------------------------------------------
const mutateToFakeWord = (word: string, validSet: Set<string>): string => {
   const vowels = ["A", "E", "I", "O", "U"];
   const consonants = [
      "B",
      "C",
      "D",
      "F",
      "G",
      "H",
      "J",
      "K",
      "L",
      "M",
      "N",
      "P",
      "Q",
      "R",
      "S",
      "T",
      "V",
      "W",
      "X",
      "Y",
      "Z",
   ];
   const wordChars = word.split("");

   for (let attempt = 0; attempt < 50; attempt++) {
      const idx = Math.floor(Math.random() * wordChars.length);
      const originalChar = wordChars[idx];
      const pool = vowels.includes(originalChar) ? vowels : consonants;
      const filteredPool = pool.filter((c) => c !== originalChar);
      const replacement =
         filteredPool[Math.floor(Math.random() * filteredPool.length)];

      const copy = [...wordChars];
      copy[idx] = replacement;
      const candidate = copy.join("");

      if (!validSet.has(candidate)) {
         return candidate;
      }
   }

   return word + "R"; // fallback fake suffix
};

// -------------------------------------------------------------
// 5. Main Question Generator Engine
// -------------------------------------------------------------
export const generateWordUpQuestions = (category: string): WordUpQuestion[] => {
   // Determine word lengths to sample based on matchmaking category
   let allowedLengths = [3, 4, 5, 6, 7, 8, 9, 10];
   if (category === "3_letters") allowedLengths = [3];
   else if (category === "4_letters") allowedLengths = [4];
   else if (category === "5_letters") allowedLengths = [5];
   else if (category === "6_letters") allowedLengths = [6];
   else if (category === "7_plus") allowedLengths = [7, 8, 9, 10];
   else if (category === "mixed" || category === "quick_match")
      allowedLengths = [4, 5, 6, 7];

   const questions: WordUpQuestion[] = [];

   const getTypeByWeight = (): WordUpQuestion["type"] => {
      const typeWeights: { type: WordUpQuestion["type"]; weight: number }[] = [
         { type: "anagram", weight: 0.6 },
         { type: "anagram_scrambled", weight: 0.6 },
         { type: "real_fake", weight: 0.9 },
         { type: "pattern", weight: 0.9 },
         { type: "length", weight: 1.0 },
         { type: "missing_letter", weight: 1.0 },
         { type: "reverse_wordle", weight: 1.0 },
         { type: "definition", weight: 1.0 },
      ];
      const totalWeight = typeWeights.reduce(
         (sum, item) => sum + item.weight,
         0,
      );
      let randomVal = Math.random() * totalWeight;
      for (const item of typeWeights) {
         if (randomVal < item.weight) {
            return item.type;
         }
         randomVal -= item.weight;
      }
      return "anagram";
   };

   for (let i = 0; i < 7; i++) {
      // Pick type
      const type = getTypeByWeight();
      const length =
         type === "anagram"
            ? [3, 4, 5, 6, 7, 8, 9, 10][Math.floor(Math.random() * 8)]
            : allowedLengths[Math.floor(Math.random() * allowedLengths.length)];
      const { official, valid } = getWordLists(length);

      const randomWord = () =>
         official[Math.floor(Math.random() * official.length)];

      if (type === "real_fake") {
         const isReal = Math.random() > 0.5;
         const word = randomWord();
         if (isReal) {
            questions.push({
               type: "real_fake",
               prompt: word,
               choices: ["Real", "Fake"],
               answer: "Real",
            });
         } else {
            const fake = mutateToFakeWord(word, valid);
            questions.push({
               type: "real_fake",
               prompt: fake,
               choices: ["Real", "Fake"],
               answer: "Fake",
            });
         }
      } else if (type === "length") {
         const word = randomWord();
         const correctLen = word.length;
         const choices = new Set<string>();
         choices.add(String(correctLen));

         while (choices.size < 4) {
            const offset = Math.floor(Math.random() * 5) - 2; // -2 to +2
            const val = correctLen + offset;
            if (val >= 3 && val <= 11) {
               choices.add(String(val));
            }
         }

         questions.push({
            type: "length",
            prompt: word,
            choices: Array.from(choices).sort((a, b) => Number(a) - Number(b)),
            answer: String(correctLen),
         });
      } else if (type === "missing_letter") {
         const word = randomWord();
         const missingIdx = Math.floor(Math.random() * word.length);
         const correctLetter = word[missingIdx];

         const promptChars = word.split("");
         promptChars[missingIdx] = "_";
         const promptStr = promptChars.join("");

         const choices = new Set<string>();
         choices.add(correctLetter);
         while (choices.size < 4) {
            const code = 65 + Math.floor(Math.random() * 26); // A-Z
            choices.add(String.fromCharCode(code));
         }

         questions.push({
            type: "missing_letter",
            prompt: promptStr,
            choices: Array.from(choices).sort(() => Math.random() - 0.5),
            answer: correctLetter,
         });
      } else if (type === "reverse_wordle") {
         // Target word
         const target = randomWord();
         // Choose a guess word of the same length
         let guess = randomWord();
         let pattern = calculateWordlePattern(target, guess);

         // We want a pattern that is not all white or all green (to make it interesting)
         let attempts = 0;
         while (
            (pattern.replace(/⬜/g, "").length === 0 ||
               pattern.replace(/🟩/g, "").length === 0) &&
            attempts < 10
         ) {
            guess = randomWord();
            pattern = calculateWordlePattern(target, guess);
            attempts++;
         }

         const choices = new Set<string>();
         choices.add(guess);

         // Add 3 incorrect guesses of the same length
         while (choices.size < 4) {
            const dummy = randomWord();
            if (calculateWordlePattern(target, dummy) !== pattern) {
               choices.add(dummy);
            }
         }

         questions.push({
            type: "reverse_wordle",
            prompt: pattern,
            subPrompt: `Target: ${target}`,
            choices: Array.from(choices).sort(() => Math.random() - 0.5),
            answer: guess,
         });
      } else if (type === "definition") {
         // Find a word in our definition list
         const keys = Object.keys(DEFINITIONS);
         const chosenWord = keys[Math.floor(Math.random() * keys.length)];
         const definition = DEFINITIONS[chosenWord];

         const choices = new Set<string>();
         choices.add(chosenWord);

         while (choices.size < 4) {
            const dummy = keys[Math.floor(Math.random() * keys.length)];
            choices.add(dummy);
         }

         questions.push({
            type: "definition",
            prompt: definition,
            choices: Array.from(choices).sort(() => Math.random() - 0.5),
            answer: chosenWord,
         });
      } else if (type === "anagram") {
         const word = randomWord();
         // Scramble word characters
         let scrambled = word
            .split("")
            .sort(() => Math.random() - 0.5)
            .join("");
         while (scrambled === word && word.length > 2) {
            scrambled = word
               .split("")
               .sort(() => Math.random() - 0.5)
               .join("");
         }

         const choices = new Set<string>();
         choices.add(word);

         // Add 3 other words of same length
         while (choices.size < 4) {
            const dummy = randomWord();
            choices.add(dummy);
         }

         questions.push({
            type: "anagram",
            prompt: scrambled,
            choices: Array.from(choices).sort(() => Math.random() - 0.5),
            answer: word,
         });
      } else if (type === "anagram_scrambled") {
         const word = randomWord();
         // Scramble word characters
         let scrambled = word
            .split("")
            .sort(() => Math.random() - 0.5)
            .join("");
         while (scrambled === word && word.length > 2) {
            scrambled = word
               .split("")
               .sort(() => Math.random() - 0.5)
               .join("");
         }

         const choices = new Set<string>();
         choices.add(scrambled); // The correct scramble

         const scrambleWord = (w: string) => {
            return w
               .split("")
               .sort(() => Math.random() - 0.5)
               .join("");
         };

         // 1. Add another scramble of the word itself (e.g. RHEAT)
         let attempts = 0;
         while (choices.size < 2 && attempts < 20) {
            const extraScramble = scrambleWord(word);
            if (extraScramble !== word && extraScramble !== scrambled) {
               choices.add(extraScramble);
            }
            attempts++;
         }

         // 2. Add scrambles of the word with 1 letter replaced (e.g. RHEAY)
         attempts = 0;
         while (choices.size < 4 && attempts < 50) {
            const chars = word.split("");
            const replaceIdx = Math.floor(Math.random() * chars.length);
            let replacement = chars[replaceIdx];
            while (replacement === chars[replaceIdx]) {
               replacement = String.fromCharCode(
                  65 + Math.floor(Math.random() * 26),
               );
            }
            chars[replaceIdx] = replacement;
            const mutatedScramble = scrambleWord(chars.join(""));
            choices.add(mutatedScramble);
            attempts++;
         }

         // Fallback
         while (choices.size < 4) {
            choices.add(scrambleWord(word) + "X");
         }

         questions.push({
            type: "anagram_scrambled",
            prompt: word,
            choices: Array.from(choices).sort(() => Math.random() - 0.5),
            answer: scrambled,
         });
      } else {
         // type === "pattern"
         const word = randomWord();
         const patternsList = [
            { query: "Contains 'PH'?", test: (w: string) => w.includes("PH") },
            {
               query: "Contains 'ING'?",
               test: (w: string) => w.includes("ING"),
            },
            {
               query: "Contains exactly double letters?",
               test: (w: string) => {
                  const counts: Record<string, number> = {};
                  for (const char of w) {
                     counts[char] = (counts[char] || 0) + 1;
                  }
                  return Object.values(counts).includes(2);
               },
            },
            {
               query: "Contains exactly triple letters?",
               test: (w: string) => {
                  const counts: Record<string, number> = {};
                  for (const char of w) {
                     counts[char] = (counts[char] || 0) + 1;
                  }
                  return Object.values(counts).includes(3);
               },
            },
            { query: "Contains 'QU'?", test: (w: string) => w.includes("QU") },
            {
               query: "Has exactly 2 vowels?",
               test: (w: string) => {
                  const v = w.match(/[AEIOU]/g);
                  return v ? v.length === 2 : false;
               },
            },
            {
               query: "Contains the letter 'X', 'Z', or 'Q'?",
               test: (w: string) => /[XZQ]/.test(w),
            },
         ];

         const p =
            patternsList[Math.floor(Math.random() * patternsList.length)];
         const answerBool = p.test(word);

         questions.push({
            type: "pattern",
            prompt: word,
            subPrompt: p.query,
            choices: ["True", "False"],
            answer: answerBool ? "True" : "False",
         });
      }
   }

   // Randomly shuffle choices for all generated questions to prevent fixed coherent positions
   questions.forEach((q) => {
      q.choices = [...q.choices].sort(() => Math.random() - 0.5);
   });

   return questions;
};

// -------------------------------------------------------------
// 6. Bot Behavior Simulation Configurations
// -------------------------------------------------------------
export interface BotProfile {
   name: string;
   accuracy: number; // 0 to 1
   minDelay: number; // in seconds
   maxDelay: number; // in seconds
}

export const BOT_PROFILES: Record<string, BotProfile> = {
   slow_thinker: {
      name: "Sloths ",
      accuracy: 0.6,
      minDelay: 6.0,
      maxDelay: 9.0,
   },
   average: {
      name: "Player",
      accuracy: 0.75,
      minDelay: 4.0,
      maxDelay: 7.5,
   },
   fast: { name: "Speedy", accuracy: 0.85, minDelay: 2.0, maxDelay: 5.0 },
   master: {
      name: "Zeeny",
      accuracy: 0.95,
      minDelay: 1.5,
      maxDelay: 3.5,
   },
   impossible: {
      name: "Variant",
      accuracy: 1.0,
      minDelay: 0.5,
      maxDelay: 1.8,
   },
};

export const getRandomBotProfile = (): string => {
   const keys = Object.keys(BOT_PROFILES);
   return keys[Math.floor(Math.random() * keys.length)];
};
export const simulateBotResponse = (
   _question: WordUpQuestion,
   profileKey: string,
): { correct: boolean; time_taken: number; points: number } => {
   const profile = BOT_PROFILES[profileKey] || BOT_PROFILES.average;
   const correct = Math.random() < profile.accuracy;

   // Random delay
   const time_taken = parseFloat(
      (
         Math.random() * (profile.maxDelay - profile.minDelay) +
         profile.minDelay
      ).toFixed(2),
   );

   let points = 0;
   if (correct) {
      // Correct = 100 points
      // Speed bonus = up to +50 points (linearly scales from 0s to 10s)
      const speedBonus = Math.max(
         0,
         Math.round((1.0 - time_taken / 10.0) * 50),
      );
      points = 100 + speedBonus;
   }

   return { correct, time_taken, points };
};
