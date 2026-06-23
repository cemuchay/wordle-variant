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
      | "pattern"
      | "math"
      | "odd_one_out"
      | "vowel_drop"
      | "rhyme_match"
      | "letter_count"
      | "word_ladder"
      | "synonym_match"
      | "word_chain"
      | "letter_shift"
      | "compound_break"
      | "word_within"
      | "cryptogram"
      | "category_sort"
      | "letter_add_remove";
   prompt: string;
   subPrompt?: string; // Additional context (e.g., target word in reverse Wordle)
   choices: string[];
   answer: string;
   imageUrl?: string; // Optional URL pointing to the Supabase Storage bucket asset
   imageUrls?: string[]; // Optional array of image codes/urls for multi-image questions
}

export const getQuestionImageUrl = (path: string): string => {
   const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
   return `${supabaseUrl}/storage/v1/object/public/wordup-questions/${path}`;
};

// -------------------------------------------------------------
// 1. Encryption / Decryption Helpers
// -------------------------------------------------------------

// AES-GCM decryption for edge function payloads
export async function decryptAESGCM(
   encryptedBase64: string,
   base64Key: string,
): Promise<string> {
   const rawKey = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0));
   const key = await crypto.subtle.importKey(
      "raw",
      rawKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"],
   );
   const combined = Uint8Array.from(atob(encryptedBase64), (c) =>
      c.charCodeAt(0),
   );
   const iv = combined.slice(0, 12);
   const data = combined.slice(12);
   const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      data,
   );
   return new TextDecoder().decode(decrypted);
}

// Unified decryption: tries AES-GCM first (edge function), falls back to XOR (legacy)
export async function decryptMatchQuestions(match: {
   encrypted_questions?: string;
   questions?: string;
   encryption_key: string;
}): Promise<WordUpQuestion[]> {
   const key = match.encryption_key;
   if (!key) throw new Error("No encryption key found on match");

   // Try the raw encrypted payload (if edge function wrote to a separate column)
   if (match.encrypted_questions) {
      try {
         const plain = await decryptAESGCM(match.encrypted_questions, key);
         return JSON.parse(plain);
      } catch (e) {
         console.warn("AES-GCM on encrypted_questions failed:", e);
      }
   }

   if (match.questions) {
      try {
         const plain = await decryptAESGCM(match.questions, key);
         return JSON.parse(plain);
      } catch {
         return decryptQuestions(match.questions, key);
      }
   }

   throw new Error("No encrypted questions found on match");
}

// XOR Base64 (legacy client-side encryption)

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
// 2b. Thematic Groups (for synonym_match + category_sort)
// -------------------------------------------------------------
const THEME_GROUPS: Record<string, string[]> = {
   MEDICAL: [
      "DOCTOR",
      "NURSE",
      "DENTIST",
      "CHEMIST",
      "HOSPITAL",
      "CLINIC",
      "PHARMACY",
      "AMBULANCE",
   ],
   EDUCATION: [
      "TEACHER",
      "STUDENT",
      "LECTURER",
      "HEADMASTER",
      "SCHOOL",
      "COLLEGE",
      "CLASSROOM",
      "CAMPUS",
      "LIBRARY",
      "NOTEBOOK",
   ],
   FOOD: [
      "BREAD",
      "CHEESE",
      "APPLE",
      "BANANA",
      "COFFEE",
      "CHICKEN",
      "BAKER",
      "CHEF",
      "WAITER",
      "GROCERY",
      "YAM",
      "CASSAVA",
      "OKRA",
      "PEPPER",
      "JOLLOF",
      "PLANTAIN",
      "MOIMOI",
      "AKARA",
      "SUYA",
   ],
   TRANSPORT: [
      "PILOT",
      "DRIVER",
      "CAPTAIN",
      "BICYCLE",
      "AIRPORT",
      "RUNWAY",
      "AIRLINE",
      "HIGHWAY",
      "BRIDGE",
      "TRAFFIC",
   ],
   CREATIVE: ["AUTHOR", "POET", "ARTIST", "MUSICIAN", "ACTOR", "JOURNALIST"],
   JUSTICE: ["LAWYER", "POLICE", "COURT", "JUSTICE", "CONTRACT"],
   NATURE: [
      "OCEAN",
      "MOUNTAIN",
      "VOLCANO",
      "DESERT",
      "LAGOON",
      "SUNSHINE",
      "RAINFALL",
      "CLIMATE",
      "DROUGHT",
      "ECLIPSE",
      "ICEBERG",
   ],
   CLOTHING: [
      "UNIFORM",
      "SANDALS",
      "SLIPPERS",
      "APRON",
      "JACKET",
      "HELMET",
      "GLASSES",
      "JEWELRY",
   ],
   TECHNOLOGY: [
      "COMPUTER",
      "KEYBOARD",
      "MONITOR",
      "PRINTER",
      "INTERNET",
      "CAMERA",
      "TELEPHONE",
      "BATTERY",
      "CHARGER",
      "GENERATOR",
   ],
   FINANCE: [
      "BANKER",
      "ACCOUNTANT",
      "CASHIER",
      "BANKING",
      "FINANCE",
      "INVOICE",
   ],
   HOME: [
      "FAMILY",
      "COUSIN",
      "UNCLE",
      "AUNT",
      "GRANDMOTHER",
      "GRANDFATHER",
      "NEIGHBOR",
      "LANDLORD",
      "TENANT",
      "FURNITURE",
   ],
   BUILDING: [
      "SCHOOL",
      "HOSPITAL",
      "CHURCH",
      "MOSQUE",
      "LIBRARY",
      "AIRPORT",
      "FACTORY",
      "GARAGE",
      "HOSTEL",
      "KIOSK",
      "MARKET",
   ],
   SPORTS: ["FOOTBALL", "ATHLETE", "CYCLIST", "BASKET", "BALLOON"],
   PROFESSION: [
      "DOCTOR",
      "NURSE",
      "TEACHER",
      "LAWYER",
      "ENGINEER",
      "SCIENTIST",
      "ARTIST",
      "MUSICIAN",
      "ACTOR",
      "PILOT",
      "CAPTAIN",
      "CARPENTER",
      "MECHANIC",
      "TAILOR",
      "BARBER",
      "FARMER",
      "BAKER",
      "CHEF",
      "JANITOR",
      "HUNTER",
      "FISHERMAN",
      "GARDENER",
      "SOLDIER",
      "FIREMAN",
      "CLERK",
   ],
};

// -------------------------------------------------------------
// 2c. Compound Words Database (for compound_break)
// -------------------------------------------------------------
const COMPOUND_PARTS: [string, string, string][] = [
   ["NOTEBOOK", "NOTE", "BOOK"],
   ["SUNFLOWER", "SUN", "FLOWER"],
   ["BIRTHDAY", "BIRTH", "DAY"],
   ["FOOTBALL", "FOOT", "BALL"],
   ["HIGHLAND", "HIGH", "LAND"],
   ["RAINFALL", "RAIN", "FALL"],
   ["SUNSHINE", "SUN", "SHINE"],
   ["CLASSROOM", "CLASS", "ROOM"],
   ["BLACKBOARD", "BLACK", "BOARD"],
   ["HEADMASTER", "HEAD", "MASTER"],
   ["AIRPORT", "AIR", "PORT"],
   ["KEYBOARD", "KEY", "BOARD"],
   ["BACKPACK", "BACK", "PACK"],
   ["FARMHOUSE", "FARM", "HOUSE"],
   ["BASKETBALL", "BASKET", "BALL"],
   ["EARTHQUAKE", "EARTH", "QUAKE"],
   ["WORKSHOP", "WORK", "SHOP"],
   ["PASSPORT", "PASS", "PORT"],
   ["RAINBOW", "RAIN", "BOW"],
   ["SAILBOAT", "SAIL", "BOAT"],
   ["SNOWBALL", "SNOW", "BALL"],
   ["STARFISH", "STAR", "FISH"],
   ["SUNSET", "SUN", "SET"],
   ["TOOTHBRUSH", "TOOTH", "BRUSH"],
   ["WATERFALL", "WATER", "FALL"],
   ["WATERMELON", "WATER", "MELON"],
   ["WRISTWATCH", "WRIST", "WATCH"],
   ["DOORSTEP", "DOOR", "STEP"],
   ["HONEYMOON", "HONEY", "MOON"],
   ["PANCAKE", "PAN", "CAKE"],
   ["PINEAPPLE", "PINE", "APPLE"],
   ["PLAYGROUND", "PLAY", "GROUND"],
   ["POPCORN", "POP", "CORN"],
   ["SIDEWALK", "SIDE", "WALK"],
   ["SPACESHIP", "SPACE", "SHIP"],
   ["LIGHTHOUSE", "LIGHT", "HOUSE"],
   ["LAWNMOWER", "LAWN", "MOWER"],
   ["NIGHTMARE", "NIGHT", "MARE"],
   ["LIPSTICK", "LIP", "STICK"],
   ["LIFEGUARD", "LIFE", "GUARD"],
   ["UNDERWEAR", "UNDER", "WEAR"],
];

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
const getDiffCount = (a: string, b: string): number => {
   let diff = 0;
   const len = Math.max(a.length, b.length);
   for (let i = 0; i < len; i++) {
      if (a[i] !== b[i]) {
         diff++;
      }
   }
   return diff;
};

const isValidFake = (correct: string, fake: string): boolean => {
   if (correct.length > 4) {
      return getDiffCount(correct, fake) >= 2;
   }
   return correct !== fake;
};

const rand = (min: number, max: number) =>
   Math.floor(Math.random() * (max - min + 1)) + min;

const shuffle = <T>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);

function smartFakeAnswers(correct: number) {
   const candidates = [
      correct - 1,
      correct + 1,
      correct - 2,
      correct + 2,
      correct - 5,
      correct + 5,
      correct - 10,
      correct + 10,
      Math.floor(correct * 0.9),
      Math.ceil(correct * 1.1),
   ].filter((x) => x >= 0 && x !== correct);

   return shuffle([...new Set(candidates)]).slice(0, 3);
}

interface MathQuestion {
   question: string;
   answer: number;
   fakeAnswers: number[];
}

interface MathTemplate {
   generate: () => MathQuestion;
}

const MATH_TEMPLATES: MathTemplate[] = [
   {
      generate: () => {
         const a = rand(10, 99);
         const b = rand(10, 99);

         return {
            question: `${a} + ${b}`,
            answer: a + b,
            fakeAnswers: smartFakeAnswers(a + b),
         };
      },
   },
   {
      generate: () => {
         const a = rand(20, 100);
         const b = rand(5, 20);

         return {
            question: `${a} - ${b}`,
            answer: a - b,
            fakeAnswers: smartFakeAnswers(a - b),
         };
      },
   },
   {
      generate: () => {
         const a = rand(2, 15);
         const b = rand(2, 15);

         return {
            question: `${a} × ${b}`,
            answer: a * b,
            fakeAnswers: smartFakeAnswers(a * b),
         };
      },
   },
   {
      generate: () => {
         const b = rand(2, 12);
         const answer = rand(2, 20);
         const a = b * answer;

         return {
            question: `${a} ÷ ${b}`,
            answer,
            fakeAnswers: smartFakeAnswers(answer),
         };
      },
   },
];

const MATH_DEFINITIONS = [
   { question: "What is 25% of 80?", answer: 20 },
   { question: "Half of 96 is", answer: 48 },
   { question: "Double 37", answer: 74 },
   { question: "Three quarters of 40", answer: 30 },
   { question: "One DOZEN equals", answer: 12 },
   { question: "One SCORE equals", answer: 20 },
   { question: "The square of 12 is", answer: 144 },
   { question: "The cube of 4 is", answer: 64 },
   { question: "The square root of 81 is", answer: 9 },
   { question: "10² equals", answer: 100 },
   { question: "2³ equals", answer: 8 },
   { question: "The next prime number after 17 is", answer: 19 },
   { question: "The Roman numeral X represents", answer: 10 },
   { question: "The Roman numeral L represents", answer: 50 },
   { question: "A century contains", answer: 100 },
   { question: "A decade contains", answer: 10 },
   { question: "One million has how many zeros?", answer: 6 },
   { question: "One billion has how many zeros?", answer: 9 },
   { question: "360 divided by 12 equals", answer: 30 },
   { question: "15 × 15 equals", answer: 225 },
   { question: "7² equals", answer: 49 },
];

export const generateMathQuestion = (): WordUpQuestion => {
   const useDefinition = Math.random() > 0.5;
   if (useDefinition) {
      const def =
         MATH_DEFINITIONS[Math.floor(Math.random() * MATH_DEFINITIONS.length)];
      const fakes = smartFakeAnswers(def.answer);
      const choicesSet = new Set<string>();
      choicesSet.add(String(def.answer));
      fakes.forEach((f) => choicesSet.add(String(f)));
      while (choicesSet.size < 4) {
         choicesSet.add(String(def.answer + rand(-5, 5)));
      }
      const choices = shuffle(Array.from(choicesSet));
      return {
         type: "math",
         prompt: def.question,
         choices,
         answer: String(def.answer),
      };
   } else {
      const template =
         MATH_TEMPLATES[Math.floor(Math.random() * MATH_TEMPLATES.length)];
      const q = template.generate();
      const choicesSet = new Set<string>();
      choicesSet.add(String(q.answer));
      q.fakeAnswers.forEach((f) => choicesSet.add(String(f)));
      while (choicesSet.size < 4) {
         choicesSet.add(String(q.answer + rand(-5, 5)));
      }
      const choices = shuffle(Array.from(choicesSet));
      return {
         type: "math",
         prompt: q.question,
         choices,
         answer: String(q.answer),
      };
   }
};

export const generateOddOneOutQuestion = (
   allowedLengths: number[],
): WordUpQuestion => {
   const length =
      allowedLengths[Math.floor(Math.random() * allowedLengths.length)];
   const { official, valid } = getWordLists(length);

   const randomWord = (lists: { official: string[] }) =>
      lists.official[Math.floor(Math.random() * lists.official.length)];

   // 0: All valid words except (1 fake)
   // 1: All valid L-letter words except (1 fake or 1 real other length)
   // 2: Which is a valid word (1 real, 3 fakes)
   // 3: Which is a valid L-letter word (1 real, 3 fakes/real other lengths)
   const subType = rand(0, 3);

   if (subType === 0) {
      const choicesSet = new Set<string>();
      while (choicesSet.size < 3) {
         choicesSet.add(randomWord({ official }));
      }

      let fake = "";
      let attempts = 0;
      while (attempts < 50) {
         const baseWord = randomWord({ official });
         const candidate = mutateToFakeWord(baseWord, valid);
         if (!choicesSet.has(candidate)) {
            fake = candidate;
            break;
         }
         attempts++;
      }
      if (!fake) fake = "WURD";

      choicesSet.add(fake);
      const choices = shuffle(Array.from(choicesSet));

      return {
         type: "odd_one_out",
         prompt: "ALL OF THESE ARE VALID WORDS EXCEPT:",
         choices,
         answer: fake,
      };
   } else if (subType === 1) {
      const choicesSet = new Set<string>();
      while (choicesSet.size < 3) {
         choicesSet.add(randomWord({ official }));
      }

      let wrongOption = "";
      const useDifferentLength = Math.random() > 0.5;
      if (useDifferentLength) {
         const allOtherLengths = [3, 4, 5, 6, 7, 8, 9, 10].filter(
            (len) => len !== length,
         );
         const diffLen =
            allOtherLengths[Math.floor(Math.random() * allOtherLengths.length)];
         const diffList = getWordLists(diffLen);
         wrongOption =
            diffList.official[
               Math.floor(Math.random() * diffList.official.length)
            ];
      } else {
         let attempts = 0;
         while (attempts < 50) {
            const baseWord = randomWord({ official });
            const candidate = mutateToFakeWord(baseWord, valid);
            if (!choicesSet.has(candidate)) {
               wrongOption = candidate;
               break;
            }
            attempts++;
         }
         if (!wrongOption) wrongOption = "Z" + "Z".repeat(length - 1);
      }

      choicesSet.add(wrongOption);
      const choices = shuffle(Array.from(choicesSet));

      return {
         type: "odd_one_out",
         prompt: `ALL OF THESE ARE VALID ${length}-LETTER WORDS EXCEPT:`,
         choices,
         answer: wrongOption,
      };
   } else if (subType === 2) {
      const realWord = randomWord({ official });
      const choicesSet = new Set<string>();
      choicesSet.add(realWord);

      let attempts = 0;
      while (choicesSet.size < 4 && attempts < 100) {
         const baseWord = randomWord({ official });
         const fakeCandidate = mutateToFakeWord(baseWord, valid);
         choicesSet.add(fakeCandidate);
         attempts++;
      }
      while (choicesSet.size < 4) {
         choicesSet.add("X" + "X".repeat(length - 1) + choicesSet.size);
      }

      const choices = shuffle(Array.from(choicesSet));

      return {
         type: "odd_one_out",
         prompt: "WHICH OF THE FOLLOWING IS A VALID WORD?",
         choices,
         answer: realWord,
      };
   } else {
      const realWord = randomWord({ official });
      const choicesSet = new Set<string>();
      choicesSet.add(realWord);

      const useDifferentLength = Math.random() > 0.5;
      if (useDifferentLength) {
         let attempts = 0;
         while (choicesSet.size < 4 && attempts < 100) {
            const allOtherLengths = [3, 4, 5, 6, 7, 8, 9, 10].filter(
               (len) => len !== length,
            );
            const diffLen =
               allOtherLengths[
                  Math.floor(Math.random() * allOtherLengths.length)
               ];
            const diffList = getWordLists(diffLen);
            const diffWord =
               diffList.official[
                  Math.floor(Math.random() * diffList.official.length)
               ];
            choicesSet.add(diffWord);
            attempts++;
         }
      } else {
         let attempts = 0;
         while (choicesSet.size < 4 && attempts < 100) {
            const baseWord = randomWord({ official });
            const fakeCandidate = mutateToFakeWord(baseWord, valid);
            choicesSet.add(fakeCandidate);
            attempts++;
         }
      }
      while (choicesSet.size < 4) {
         choicesSet.add("Q" + "Q".repeat(length - 1) + choicesSet.size);
      }

      const choices = shuffle(Array.from(choicesSet));

      return {
         type: "odd_one_out",
         prompt: `WHICH OF THE FOLLOWING IS A VALID ${length}-LETTER WORD?`,
         choices,
         answer: realWord,
      };
   }
};

// -------------------------------------------------------------
// 6. New Question Type Generators
// -------------------------------------------------------------

const generateSynonymMatch = (): WordUpQuestion => {
   const themeKeys = Object.keys(THEME_GROUPS).filter(
      (k) => THEME_GROUPS[k].length <= 6,
   );

   // Pick a tight theme where any two words feel intuitively related
   let theme = themeKeys[Math.floor(Math.random() * themeKeys.length)];
   let words = THEME_GROUPS[theme];
   let attempts = 0;
   while (words.length < 2 && attempts < 20) {
      attempts++;
      theme = themeKeys[Math.floor(Math.random() * themeKeys.length)];
      words = THEME_GROUPS[theme];
   }

   // Pick two DIFFERENT words from the same theme
   const shuffled = shuffle(words);
   const displayWord = shuffled[0];
   const correctWord = shuffled[1];

   // Pick 3 distractors from other themes
   const choices = new Set<string>();
   choices.add(correctWord);
   let decoyAttempts = 0;
   while (choices.size < 4 && decoyAttempts < 100) {
      decoyAttempts++;
      const otherTheme =
         themeKeys[Math.floor(Math.random() * themeKeys.length)];
      if (otherTheme === theme) continue;
      const otherWords = THEME_GROUPS[otherTheme];
      const pick = otherWords[Math.floor(Math.random() * otherWords.length)];
      if (pick !== displayWord) {
         choices.add(pick);
      }
   }
   while (choices.size < 4) {
      choices.add("UNKNOWN");
   }
   return {
      type: "synonym_match",
      prompt: `Which word is related to ${displayWord}?`,
      choices: shuffle(Array.from(choices)),
      answer: correctWord,
   };
};

const generateWordChain = (allowedLengths: number[]): WordUpQuestion => {
   const length =
      allowedLengths[Math.floor(Math.random() * allowedLengths.length)];
   const { official } = getWordLists(length);
   const word = official[Math.floor(Math.random() * official.length)];
   const suffix = word.substring(word.length - 2);

   // Find words that start with the suffix across all lengths
   const candidates: string[] = [];
   for (const len of allowedLengths) {
      const list = getWordLists(len).official;
      candidates.push(
         ...list.filter((w) => w.startsWith(suffix) && w !== word),
      );
   }

   let correct;
   let fallbackWord = word;
   let fallbackSuffix = suffix;
   let attempts = 0;
   while (candidates.length === 0 && attempts < 30) {
      attempts++;
      fallbackWord = official[Math.floor(Math.random() * official.length)];
      fallbackSuffix = fallbackWord.substring(fallbackWord.length - 2);
      for (const len of allowedLengths) {
         const list = getWordLists(len).official;
         candidates.push(
            ...list.filter(
               (w) => w.startsWith(fallbackSuffix) && w !== fallbackWord,
            ),
         );
      }
   }
   if (candidates.length > 0) {
      correct = candidates[Math.floor(Math.random() * candidates.length)];
   } else {
      correct = fallbackSuffix + "AY";
   }

   const choices = new Set<string>();
   choices.add(correct);
   let decoyAttempts = 0;
   while (choices.size < 4 && decoyAttempts < 100) {
      decoyAttempts++;
      const len =
         allowedLengths[Math.floor(Math.random() * allowedLengths.length)];
      const list = getWordLists(len).official;
      const dummy = list[Math.floor(Math.random() * list.length)];
      if (!dummy.startsWith(fallbackSuffix)) {
         choices.add(dummy);
      }
   }
   while (choices.size < 4) {
      choices.add(fallbackSuffix + "AB");
   }
   return {
      type: "word_chain",
      prompt: `Which word starts with the last 2 letters of ${fallbackWord}?`,
      subPrompt: `Last 2 letters: "${fallbackSuffix}"`,
      choices: shuffle(Array.from(choices)),
      answer: correct,
   };
};

const generateLetterShift = (allowedLengths: number[]): WordUpQuestion => {
   const length =
      allowedLengths[Math.floor(Math.random() * allowedLengths.length)];
   const { official, valid } = getWordLists(length);
   const word = official[Math.floor(Math.random() * official.length)];
   const shift = rand(1, 3);
   const shifted = word
      .split("")
      .map((ch) => {
         const code = ch.charCodeAt(0) + shift;
         return String.fromCharCode(code > 90 ? code - 26 : code);
      })
      .join("");

   const choices = new Set<string>();
   choices.add(word);
   let attempts = 0;
   while (choices.size < 4 && attempts < 100) {
      attempts++;
      const dummy = official[Math.floor(Math.random() * official.length)];
      if (dummy !== word && valid.has(dummy)) {
         choices.add(dummy);
      }
   }
   while (choices.size < 4) {
      choices.add(official[Math.floor(Math.random() * official.length)]);
   }
   return {
      type: "letter_shift",
      prompt: `Each letter has been shifted forward by ${shift} in the alphabet. What is the original word?`,
      subPrompt: shifted,
      choices: shuffle(Array.from(choices)),
      answer: word,
   };
};

const generateCompoundBreak = (): WordUpQuestion => {
   const entry =
      COMPOUND_PARTS[Math.floor(Math.random() * COMPOUND_PARTS.length)];
   const [compound, partA, partB] = entry;
   const askForA = Math.random() > 0.5;

   const correct = askForA ? partA : partB;
   const otherPart = askForA ? partB : partA;

   const choices = new Set<string>();
   choices.add(correct);
   let attempts = 0;
   while (choices.size < 4 && attempts < 50) {
      attempts++;
      const other =
         COMPOUND_PARTS[Math.floor(Math.random() * COMPOUND_PARTS.length)];
      const candidate = askForA ? other[1] : other[2];
      if (candidate !== correct) {
         choices.add(candidate);
      }
   }
   while (choices.size < 4) {
      choices.add("ZERO");
   }
   return {
      type: "compound_break",
      prompt: `Which word combines with "${otherPart}" to form "${compound}"?`,
      choices: shuffle(Array.from(choices)),
      answer: correct,
   };
};

const generateWordWithin = (allowedLengths: number[]): WordUpQuestion => {
   const longLengths = allowedLengths.filter((l) => l >= 7);
   if (longLengths.length === 0) {
      // Fallback: use 7+ if none available
      return {
         type: "word_within",
         prompt: "Which word can be found inside SUNFLOWER?",
         choices: shuffle(["SUN", "MOON", "STAR", "SKY"]),
         answer: "SUN",
      };
   }
   const longLen = longLengths[Math.floor(Math.random() * longLengths.length)];
   const { official } = getWordLists(longLen);
   const longWord = official[Math.floor(Math.random() * official.length)];

   // Find substring words (3-5 letters) inside longWord
   const subCandidates: string[] = [];
   const shortLengths = allowedLengths.filter((l) => l >= 3 && l <= 5);
   for (const slen of shortLengths) {
      const list = getWordLists(slen).official;
      for (const w of list) {
         if (w.length < longWord.length && longWord.includes(w)) {
            subCandidates.push(w);
         }
      }
   }

   let correct;
   let fallbackWord = longWord;
   let fallbackAttempts = 0;
   while (subCandidates.length === 0 && fallbackAttempts < 20) {
      fallbackAttempts++;
      fallbackWord = official[Math.floor(Math.random() * official.length)];
      for (const slen of shortLengths) {
         const list = getWordLists(slen).official;
         for (const w of list) {
            if (w.length < fallbackWord.length && fallbackWord.includes(w)) {
               subCandidates.push(w);
            }
         }
      }
   }
   if (subCandidates.length > 0) {
      correct = subCandidates[Math.floor(Math.random() * subCandidates.length)];
   } else {
      correct = fallbackWord.substring(0, Math.min(3, fallbackWord.length));
   }

   const choices = new Set<string>();
   choices.add(correct);
   let attempts = 0;
   while (choices.size < 4 && attempts < 100) {
      attempts++;
      const slen =
         shortLengths[Math.floor(Math.random() * shortLengths.length)];
      const list = getWordLists(slen).official;
      const dummy = list[Math.floor(Math.random() * list.length)];
      if (dummy !== correct && !fallbackWord.includes(dummy)) {
         choices.add(dummy);
      }
   }
   while (choices.size < 4) {
      choices.add("XYZ");
   }
   return {
      type: "word_within",
      prompt: `Which word can be found inside "${fallbackWord}"?`,
      choices: shuffle(Array.from(choices)),
      answer: correct,
   };
};

const DOUBLE_LETTER_PATTERNS = ["LL", "SS", "EE", "OO", "TT"];

const scanWordlistForDoubleLetter = (wordlist: string[], patterns: string[]): string | null => {
   if (wordlist.length === 0) return null;
   const start = Math.floor(Math.random() * wordlist.length);
   for (let i = 0; i < wordlist.length; i++) {
      const word = wordlist[(start + i) % wordlist.length];
      if (patterns.some((p) => word.includes(p))) return word;
   }
   return null;
};

const generateCryptogram = (allowedLengths: number[]): WordUpQuestion => {
   const length =
      allowedLengths[Math.floor(Math.random() * allowedLengths.length)];
   const { official, valid } = getWordLists(length);

   // Pick a word with at least one adjacent repeated letter
   let word: string;
   let attempts = 0;
   do {
      word = official[Math.floor(Math.random() * official.length)];
      attempts++;
   } while (attempts < 50 && !/([A-Z])\1/.test(word));

   if (!/([A-Z])\1/.test(word)) {
      const scanned = scanWordlistForDoubleLetter(official, DOUBLE_LETTER_PATTERNS);
      if (scanned) word = scanned;
   }

   // Identify double-letter positions for distractor filtering
   const doublePositions: number[] = [];
   for (let i = 0; i < word.length - 1; i++) {
      if (word[i] === word[i + 1]) doublePositions.push(i);
   }

   // Build a random substitution cipher (A->X, B->Y, etc.)
   const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
   const shuffled = shuffle([...letters]);
   const cipherMap: Record<string, string> = {};
   for (let i = 0; i < 26; i++) {
      cipherMap[letters[i]] = shuffled[i];
   }
   const encoded = word
      .split("")
      .map((ch) => cipherMap[ch] || ch)
      .join("");

   const choices = new Set<string>();
   choices.add(word);
   let choiceAttempts = 0;
   while (choices.size < 4 && choiceAttempts < 100) {
      choiceAttempts++;
      const dummy = official[Math.floor(Math.random() * official.length)];
      if (dummy === word || !valid.has(dummy)) continue;
      const hasDoubleAtCorrectPos = doublePositions.some(
         (pos) => dummy[pos] === dummy[pos + 1],
      );
      if (!hasDoubleAtCorrectPos) {
         choices.add(dummy);
      }
   }
   while (choices.size < 4) {
      const dummy = official[Math.floor(Math.random() * official.length)];
      if (dummy !== word) {
         choices.add(dummy);
      }
   }
   return {
      type: "cryptogram",
      prompt: `Decode the secret message! Each letter has been replaced with another.`,
      subPrompt: `Coded: ${encoded}`,
      choices: shuffle(Array.from(choices)),
      answer: word,
   };
};

const generateCategorySort = (): WordUpQuestion => {
   const themeKeys = Object.keys(THEME_GROUPS);
   // Pick two different themes
   const mainThemeIdx = Math.floor(Math.random() * themeKeys.length);
   let otherThemeIdx = Math.floor(Math.random() * themeKeys.length);
   while (otherThemeIdx === mainThemeIdx) {
      otherThemeIdx = Math.floor(Math.random() * themeKeys.length);
   }
   const mainTheme = themeKeys[mainThemeIdx];
   const otherTheme = themeKeys[otherThemeIdx];
   const mainWords = shuffle(THEME_GROUPS[mainTheme]).slice(0, 3);
   const oddWord = shuffle(THEME_GROUPS[otherTheme])[0];

   const choices = shuffle([...mainWords, oddWord]);
   return {
      type: "category_sort",
      prompt: `Which word does NOT belong with the others?`,
      choices: shuffle(Array.from(choices)),
      answer: oddWord,
   };
};

const generateLetterAddRemove = (allowedLengths: number[]): WordUpQuestion => {
   const length =
      allowedLengths[Math.floor(Math.random() * allowedLengths.length)];
   const { official, valid } = getWordLists(length);
   const word = official[Math.floor(Math.random() * official.length)];

   // Try removing one letter to make a valid shorter word
   const tryRemove = (): { base: string; result: string } | null => {
      for (let i = 0; i < word.length; i++) {
         const candidate = word.substring(0, i) + word.substring(i + 1);
         if (candidate.length >= 3 && valid.has(candidate)) {
            return { base: word, result: candidate };
         }
      }
      return null;
   };
   // Try adding one letter at each position to make a valid longer word
   const tryAdd = (): { base: string; result: string } | null => {
      const maxLen = Math.max(...allowedLengths);
      if (word.length >= maxLen) return null;
      for (let i = 0; i <= word.length; i++) {
         for (let c = 65; c <= 90; c++) {
            const letter = String.fromCharCode(c);
            const candidate = word.substring(0, i) + letter + word.substring(i);
            if (candidate.length <= 10 && valid.has(candidate)) {
               return { base: word, result: candidate };
            }
         }
      }
      return null;
   };

   const useRemove = Math.random() > 0.5;
   interface WordPair {
      base: string;
      result: string;
   }

   // 1. Scalable Pre-verified Fallback Pools
   const FALLBACK_REMOVE_POOL: WordPair[] = [
      { base: "BREAD", result: "READ" },
      { base: "BEACH", result: "EACH" },
      { base: "PLANET", result: "PLANE" },
      { base: "START", result: "TART" },
      { base: "TRAIN", result: "RAIN" },
   ];

   const FALLBACK_ADD_POOL: WordPair[] = [
      { base: "READ", result: "BREAD" },
      { base: "EACH", result: "BEACH" },
      { base: "PLANE", result: "PLANET" },
      { base: "TART", result: "START" },
      { base: "RAIN", result: "TRAIN" },
   ];

   // 2. Pure Helper Functions for Interleaved Execution
   const checkRemoval = (
      word: string,
      validSet: Set<string>,
   ): WordPair | null => {
      for (let i = 0; i < word.length; i++) {
         const candidate = word.substring(0, i) + word.substring(i + 1);
         if (candidate.length >= 3 && validSet.has(candidate)) {
            return { base: word, result: candidate };
         }
      }
      return null;
   };

   const checkAddition = (
      word: string,
      validSet: Set<string>,
      maxLen: number,
   ): WordPair | null => {
      if (word.length >= maxLen) return null;
      for (let i = 0; i <= word.length; i++) {
         for (let c = 65; c <= 90; c++) {
            // A-Z
            const letter = String.fromCharCode(c);
            const candidate = word.substring(0, i) + letter + word.substring(i);
            if (candidate.length <= 10 && validSet.has(candidate)) {
               return { base: word, result: candidate };
            }
         }
      }
      return null;
   };

   // 3. Core Logic Block
   let pair: WordPair | null = useRemove ? tryRemove() : tryAdd();
   const maxLen = Math.max(...allowedLengths);

   let retries = 0;
   while (!pair && retries < 30) {
      retries++;
      // Pull a random seed word from the client-side alphabetical list
      const newWord = official[Math.floor(Math.random() * official.length)];

      // Respect the useRemove flag during retries
      pair = useRemove
         ? checkRemoval(newWord, valid)
         : checkAddition(newWord, valid, maxLen);
   }

   // 4. Expanded Fallback Safety net
   if (!pair) {
      const pool = useRemove ? FALLBACK_REMOVE_POOL : FALLBACK_ADD_POOL;

      // Try to respect maxLen, otherwise use the whole pool to prevent a crash
      const validFallbacks = pool.filter((p) => p.result.length <= maxLen);
      const safePool = validFallbacks.length > 0 ? validFallbacks : pool;

      const randomIndex = Math.floor(Math.random() * safePool.length);
      pair = safePool[randomIndex];

      console.warn(
         `[WordGen] Fallback used: ${pair.base} -> ${pair.result}. Respected maxLen: ${validFallbacks.length > 0}`,
      );
   }

   const isRemove = pair.base.length > pair.result.length;
   const prompt = isRemove
      ? `Remove one letter from "${pair.base}" to make a valid word.`
      : `Add one letter to "${pair.base}" to make a valid word.`;
   const correctAnswer = pair.result;

   const choices = new Set<string>();
   choices.add(correctAnswer);
   let attempts = 0;
   while (choices.size < 4 && attempts < 100) {
      attempts++;
      const len =
         allowedLengths[Math.floor(Math.random() * allowedLengths.length)];
      const list = getWordLists(len).official;
      const dummy = list[Math.floor(Math.random() * list.length)];
      const diffLen = Math.abs(dummy.length - correctAnswer.length);
      if (diffLen <= 1 && !pair.base.includes(dummy)) {
         choices.add(dummy);
      }
   }
   while (choices.size < 4) {
      choices.add(correctAnswer + "X");
   }
   return {
      type: "letter_add_remove",
      prompt,
      choices: shuffle(Array.from(choices)),
      answer: correctAnswer,
   };
};

export const generateWordUpQuestions = (category: string): WordUpQuestion[] => {
   const specificTypes: WordUpQuestion["type"][] = [
      "real_fake",
      "length",
      "missing_letter",
      "reverse_wordle",
      "definition",
      "anagram",
      "anagram_scrambled",
      "pattern",
      "math",
      "odd_one_out",
      "vowel_drop",
      "rhyme_match",
      "letter_count",
      "word_ladder",
      "synonym_match",
      "word_chain",
      "letter_shift",
      "compound_break",
      "word_within",
      "cryptogram",
      "category_sort",
      "letter_add_remove",
   ];
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   const isSpecificType = specificTypes.includes(category as any);

   // Determine word lengths to sample based on matchmaking category
   let allowedLengths = [3, 4, 5, 6, 7, 8, 9, 10];
   if (category === "3_letters") allowedLengths = [3];
   else if (category === "4_letters") allowedLengths = [4];
   else if (category === "5_letters") allowedLengths = [5];
   else if (category === "6_letters") allowedLengths = [6];
   else if (category === "7_plus") allowedLengths = [7, 8, 9, 10];
   else if (category === "mixed" || category === "quick_match")
      allowedLengths = [3, 4, 5, 6, 7, 8, 9, 10];

   const questions: WordUpQuestion[] = [];

   const pickWeightedLength = (allowed: number[]): number => {
      // 3, 8, 9, 10 highly favored (weight 3.5), other lengths get weight 0.8
      const weights = allowed.map((l) =>
         [3, 8, 9, 10].includes(l) ? 3.5 : 0.8,
      );
      const totalWeight = weights.reduce((sum, w) => sum + w, 0);
      let rand = Math.random() * totalWeight;
      for (let i = 0; i < allowed.length; i++) {
         if (rand < weights[i]) {
            return allowed[i];
         }
         rand -= weights[i];
      }
      return allowed[Math.floor(Math.random() * allowed.length)];
   };

   const getTypeByWeight = (): WordUpQuestion["type"] => {
      if (isSpecificType) {
         return category as WordUpQuestion["type"];
      }
      const typeWeights: { type: WordUpQuestion["type"]; weight: number }[] = [
         { type: "anagram", weight: 0.6 },
         { type: "anagram_scrambled", weight: 0.5 },
         { type: "real_fake", weight: 0.9 },
         { type: "pattern", weight: 0.9 },
         { type: "length", weight: 1.0 },
         { type: "missing_letter", weight: 1.0 },
         { type: "reverse_wordle", weight: 0.5 },
         { type: "definition", weight: 1.0 },
         { type: "math", weight: 0.5 },
         { type: "odd_one_out", weight: 0.8 },
         { type: "vowel_drop", weight: 0.8 },
         { type: "rhyme_match", weight: 0.8 },
         { type: "letter_count", weight: 0.8 },
         { type: "word_ladder", weight: 0.8 },
         { type: "synonym_match", weight: 0.8 },
         { type: "word_chain", weight: 0.8 },
         { type: "letter_shift", weight: 0.8 },
         { type: "compound_break", weight: 0.7 },
         { type: "word_within", weight: 0.5 },
         { type: "cryptogram", weight: 0.7 },
         { type: "category_sort", weight: 0.3 },
         { type: "letter_add_remove", weight: 0.7 },
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
      // Pick type — avoid same type as previous question
      let type: WordUpQuestion["type"];
      let attempts = 0;
      do {
         type = getTypeByWeight();
         attempts++;
      } while (i > 0 && type === questions[i - 1].type && attempts < 10);
      const length = pickWeightedLength(
         type === "anagram" || type === "anagram_scrambled"
            ? [3, 4, 5, 6, 7, 8, 9, 10]
            : allowedLengths,
      );
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

         let attempts = 0;
         while (choices.size < 4 && attempts < 200) {
            attempts++;
            const code = 65 + Math.floor(Math.random() * 26); // A-Z
            const candidateLetter = String.fromCharCode(code);

            const candidateWord =
               word.substring(0, missingIdx) +
               candidateLetter +
               word.substring(missingIdx + 1);
            if (candidateLetter !== correctLetter && valid.has(candidateWord)) {
               continue;
            }
            choices.add(candidateLetter);
         }

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
         let target = randomWord();
         // Choose a guess word of the same length
         let guess = randomWord();
         let pattern = calculateWordlePattern(target, guess);

         let minColored = 1;
         if (target.length <= 3) {
            minColored = 1;
         } else if (target.length <= 5) {
            minColored = 2;
         } else {
            minColored = 3;
         }

         let attempts = 0;
         while (attempts < 150) {
            const coloredCount = (pattern.match(/🟩|🟨/g) || []).length;
            const allGreen =
               (pattern.match(/🟩/g) || []).length === target.length;
            if (coloredCount >= minColored && !allGreen) {
               break;
            }
            if (attempts > 50 && attempts % 30 === 0) {
               if (minColored > 1) {
                  minColored--;
               } else {
                  target = randomWord();
               }
            }
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

         // 1. Add scrambles of the word with letter(s) replaced (e.g. RHEAY)
         let attempts = 0;
         while (choices.size < 4 && attempts < 100) {
            const chars = word.split("");
            // If word is larger than 4 characters, replace 2 random characters to ensure we differ by at least 2 letters easily.
            // Otherwise replace 1.
            const numReplacements = word.length > 4 ? 2 : 1;
            const replacedIndices = new Set<number>();
            for (let r = 0; r < numReplacements; r++) {
               let replaceIdx = Math.floor(Math.random() * chars.length);
               while (replacedIndices.has(replaceIdx)) {
                  replaceIdx = Math.floor(Math.random() * chars.length);
               }
               replacedIndices.add(replaceIdx);
               let replacement = chars[replaceIdx];
               while (replacement === chars[replaceIdx]) {
                  replacement = String.fromCharCode(
                     65 + Math.floor(Math.random() * 26),
                  );
               }
               chars[replaceIdx] = replacement;
            }
            const mutatedScramble = scrambleWord(chars.join(""));
            if (isValidFake(scrambled, mutatedScramble)) {
               choices.add(mutatedScramble);
            }
            attempts++;
         }

         // Fallback
         let fallbackAttempts = 0;
         while (choices.size < 4 && fallbackAttempts < 50) {
            const fallbackChoice =
               scrambleWord(word) + (word.length > 4 ? "XY" : "X");
            if (isValidFake(scrambled, fallbackChoice)) {
               choices.add(fallbackChoice);
            }
            fallbackAttempts++;
         }

         questions.push({
            type: "anagram_scrambled",
            prompt: word,
            choices: Array.from(choices).sort(() => Math.random() - 0.5),
            answer: scrambled,
         });
      } else if (type === "pattern") {
         // type === "pattern"
         const word = randomWord();
         const wordLetters = Array.from(new Set(word.split("")));
         const randomChar =
            wordLetters[Math.floor(Math.random() * wordLetters.length)];
         const firstOccurIdx = word.indexOf(randomChar) + 1; // 1-based index

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
            {
               query: `First occurrence of '${randomChar}' is at position ${firstOccurIdx}?`,
               test: (w: string) => w.indexOf(randomChar) + 1 === firstOccurIdx,
            },
            {
               query: `First occurrence of '${randomChar}' is at position ${firstOccurIdx === 1 ? 2 : firstOccurIdx - 1}?`,
               test: (w: string) =>
                  w.indexOf(randomChar) + 1 ===
                  (firstOccurIdx === 1 ? 2 : firstOccurIdx - 1),
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
      } else if (type === "math") {
         questions.push(generateMathQuestion());
      } else if (type === "odd_one_out") {
         questions.push(generateOddOneOutQuestion(allowedLengths));
      } else if (type === "vowel_drop") {
         const word = randomWord();
         const prompt = word.replace(/[AEIOU]/g, "_");
         const choices = new Set<string>();
         choices.add(word);

         let attempts = 0;
         while (choices.size < 4 && attempts < 100) {
            attempts++;
            const dummy = randomWord();
            if (dummy.length === word.length) {
               choices.add(dummy);
            }
         }
         while (choices.size < 4) {
            choices.add(randomWord());
         }

         questions.push({
            type: "vowel_drop",
            prompt,
            choices: Array.from(choices).sort(() => Math.random() - 0.5),
            answer: word,
         });
      } else if (type === "rhyme_match") {
         const word = randomWord();
         const suffixLen = word.length >= 5 ? 3 : 2;
         const suffix = word.substring(word.length - suffixLen);

         const rhymingWords = official.filter(
            (w) => w.endsWith(suffix) && w !== word,
         );

         let rhymingWord = "";
         if (rhymingWords.length > 0) {
            rhymingWord =
               rhymingWords[Math.floor(Math.random() * rhymingWords.length)];
         } else {
            const allWords: string[] = [];
            for (let len = 3; len <= 8; len++) {
               allWords.push(...getWordLists(len).official);
            }
            const fallbackRhymes = allWords.filter(
               (w) => w.endsWith(suffix) && w !== word,
            );
            if (fallbackRhymes.length > 0) {
               rhymingWord =
                  fallbackRhymes[
                     Math.floor(Math.random() * fallbackRhymes.length)
                  ];
            }
         }

         let currentWord = word;
         let currentRhymingWord = rhymingWord;
         let attempts = 0;
         while (!currentRhymingWord && attempts < 50) {
            attempts++;
            currentWord = randomWord();
            const currSuffixLen = currentWord.length >= 5 ? 3 : 2;
            const currSuffix = currentWord.substring(
               currentWord.length - currSuffixLen,
            );
            const currRhymes = official.filter(
               (w) => w.endsWith(currSuffix) && w !== currentWord,
            );
            if (currRhymes.length > 0) {
               currentRhymingWord =
                  currRhymes[Math.floor(Math.random() * currRhymes.length)];
            }
         }

         if (!currentRhymingWord) {
            currentWord = "BAKE";
            currentRhymingWord = "LAKE";
         }

         const choices = new Set<string>();
         choices.add(currentRhymingWord);

         let decoyAttempts = 0;
         const currentSuffix = currentWord.substring(
            currentWord.length - (currentWord.length >= 5 ? 3 : 2),
         );
         while (choices.size < 4 && decoyAttempts < 100) {
            decoyAttempts++;
            const dummy = randomWord();
            if (!dummy.endsWith(currentSuffix)) {
               choices.add(dummy);
            }
         }
         while (choices.size < 4) {
            choices.add(randomWord());
         }

         questions.push({
            type: "rhyme_match",
            prompt: `Which word rhymes with ${currentWord}?`,
            choices: Array.from(choices).sort(() => Math.random() - 0.5),
            answer: currentRhymingWord,
         });
      } else if (type === "letter_count") {
         const word = randomWord();
         const isVowelCount = Math.random() > 0.5;
         let count: number;
         let prompt: string;
         if (isVowelCount) {
            count = (word.match(/[AEIOU]/g) || []).length;
            prompt = `How many vowels are in the word ${word}?`;
         } else {
            count = (word.match(/[BCDFGHJKLMNPQRSTVWXYZ]/g) || []).length;
            prompt = `How many consonants are in the word ${word}?`;
         }

         const choices = new Set<string>();
         choices.add(String(count));

         let countAttempts = 0;
         while (choices.size < 4 && countAttempts < 50) {
            countAttempts++;
            const offset = Math.floor(Math.random() * 5) - 2;
            const val = count + offset;
            if (val >= 0 && val <= word.length) {
               choices.add(String(val));
            }
         }
         while (choices.size < 4) {
            const val = count + choices.size;
            choices.add(String(val));
         }

         questions.push({
            type: "letter_count",
            prompt,
            choices: Array.from(choices).sort((a, b) => Number(a) - Number(b)),
            answer: String(count),
         });
      } else if (type === "word_ladder") {
         const word = randomWord();
         const candidates = official.filter(
            (w) => w.length === word.length && getDiffCount(word, w) === 1,
         );

         let attempts = 0;
         let currentWord = word;
         let currentCandidates = candidates;
         while (currentCandidates.length === 0 && attempts < 50) {
            attempts++;
            currentWord = randomWord();
            currentCandidates = official.filter(
               (w) =>
                  w.length === currentWord.length &&
                  getDiffCount(currentWord, w) === 1,
            );
         }

         if (currentCandidates.length === 0) {
            currentWord = "CAT";
            currentCandidates = [
               "BAT",
               "HAT",
               "RAT",
               "MAT",
               "COT",
               "CAN",
               "CAB",
            ];
         }

         const correctWord =
            currentCandidates[
               Math.floor(Math.random() * currentCandidates.length)
            ];
         const choices = new Set<string>();
         choices.add(correctWord);

         let decoyAttempts = 0;
         while (choices.size < 4 && decoyAttempts < 150) {
            decoyAttempts++;
            const dummy = randomWord();
            if (
               dummy.length === currentWord.length &&
               getDiffCount(currentWord, dummy) >= 2
            ) {
               choices.add(dummy);
            }
         }
         while (choices.size < 4) {
            choices.add(randomWord());
         }

         questions.push({
            type: "word_ladder",
            prompt: `Which word is exactly one letter edit away from ${currentWord}?`,
            choices: Array.from(choices).sort(() => Math.random() - 0.5),
            answer: correctWord,
         });
      } else if (type === "synonym_match") {
         questions.push(generateSynonymMatch());
      } else if (type === "word_chain") {
         questions.push(generateWordChain(allowedLengths));
      } else if (type === "letter_shift") {
         questions.push(generateLetterShift(allowedLengths));
      } else if (type === "compound_break") {
         questions.push(generateCompoundBreak());
      } else if (type === "word_within") {
         questions.push(generateWordWithin(allowedLengths));
      } else if (type === "cryptogram") {
         questions.push(generateCryptogram(allowedLengths));
      } else if (type === "category_sort") {
         questions.push(generateCategorySort());
      } else if (type === "letter_add_remove") {
         questions.push(generateLetterAddRemove(allowedLengths));
      }
   }

   // Randomly shuffle choices for all generated questions to prevent fixed coherent positions
   questions.forEach((q) => {
      q.choices = [...q.choices].sort(() => Math.random() - 0.5);
   });

   return questions;
};

// -------------------------------------------------------------
// 7. Bot Behavior Simulation Configurations
// -------------------------------------------------------------
export interface BotProfile {
   name: string;
   accuracy: number; // 0 to 1
   minDelay: number; // in seconds
   maxDelay: number; // in seconds
}

export const BOT_PROFILES: Record<string, BotProfile> = {
   slow_thinker: {
      name: "Sloths",
      accuracy: 0.5,
      minDelay: 6.0,
      maxDelay: 9.0,
   },
   average: {
      name: "Player",
      accuracy: 0.75,
      minDelay: 4.0,
      maxDelay: 7.5,
   },
   fast: { name: "Speedy", accuracy: 0.85, minDelay: 1.5, maxDelay: 2 },
   master: {
      name: "Zeeny",
      accuracy: 0.97,
      minDelay: 1,
      maxDelay: 2,
   },
   impossible: {
      name: "Variant",
      accuracy: 1.0,
      minDelay: 0.5,
      maxDelay: 1.8,
   },

   // New bots
   lagos_boy: {
      name: "LagosBoy",
      accuracy: 0.78,
      minDelay: 3.5,
      maxDelay: 6.5,
   },
   jollof_brain: {
      name: "Jollof",
      accuracy: 0.8,
      minDelay: 3.0,
      maxDelay: 6.0,
   },
   okada_rider: {
      name: "Okada",
      accuracy: 0.82,
      minDelay: 2.5,
      maxDelay: 5.5,
   },
   naija_flash: {
      name: "Flash",
      accuracy: 0.95,
      minDelay: 1,
      maxDelay: 2,
   },
   suya_thinker: {
      name: "Suya",
      accuracy: 0.74,
      minDelay: 4.0,
      maxDelay: 7.0,
   },
   pepper_soup: {
      name: "PepperSoup",
      accuracy: 0.79,
      minDelay: 3.2,
      maxDelay: 6.2,
   },
   agbada_mode: {
      name: "Agidi",
      accuracy: 0.83,
      minDelay: 2.8,
      maxDelay: 5.8,
   },
   street_king: {
      name: "Marlians",
      accuracy: 0.5,
      minDelay: 3.0,
      maxDelay: 5.5,
   },
   ogbonge_mind: {
      name: "Ogbeni",
      accuracy: 0.9,
      minDelay: 1.8,
      maxDelay: 4.0,
   },
   eko_flash: {
      name: "Eko",
      accuracy: 0.86,
      minDelay: 2.2,
      maxDelay: 4.8,
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
