import {
   fakerEN_NG,
   fakerEN_GB,
   fakerEN_US,
   fakerEN_ZA,
   fakerEN_GH,
   fakerEN_CA,
   fakerEN_AU,
   fakerEN_IN,
   fakerFR,
   fakerDE,
   fakerES,
   fakerPT_BR,
   type Faker,
} from "@faker-js/faker";
import { WORDUP_LIMITS } from "../../constants/wordup";
import {
   estimateUserLocation,
   pickSpawnRegion,
   type RegionCode,
} from "./locationEstimator";
import {
   generateRealisticBotAvatar,
   type BotGender,
} from "./botAvatarGenerator";
import {
   generateBotPersonality,
   type BotPersonality,
} from "./botPersonality";

const FAKER_BY_REGION: Record<RegionCode, Faker> = {
   NG: fakerEN_NG,
   GH: fakerEN_GH,
   KE: fakerEN_NG,
   ZA: fakerEN_ZA,
   GB: fakerEN_GB,
   US: fakerEN_US,
   CA: fakerEN_CA,
   AU: fakerEN_AU,
   IN: fakerEN_IN,
   FR: fakerFR,
   DE: fakerDE,
   ES: fakerES,
   BR: fakerPT_BR,
};

/**
 * Supplemental authentic regional first & last names so Faker's output is rich with familiar
 * local names (especially for Nigeria, Ghana, Kenya, South Africa, etc.).
 */
const REGIONAL_NAMES: Partial<
   Record<
      RegionCode,
      {
         male: string[];
         female: string[];
         last: string[];
      }
   >
> = {
   NG: {
      male: [
         "Chidi", "Tunde", "Emeka", "Damilola", "Oluwaseun", "Femi", "Kelechi",
         "Tobi", "Chinedu", "Ibrahim", "Sadiq", "Bolu", "Segun", "Uche", "Yinka",
         "Nnamdi", "Obinna", "Mayowa", "Kunle", "Ebuka", "somto", "Chuka", "Ayo",
         "nonso", "Ifeanyi", "Gbenga", "Korede", "Musa", "Dayo", "Dare",
      ],
      female: [
         "Amaka", "Ngozi", "Zainab", "Temi", "Chioma", "Funke", "Aisha", "Adaeze",
         "Kemi", "Bisi", "Halima", "Nneka", "Tolu", "Yemi", "Simi", "Chiamaka",
         "Ifeoma", "Bukola", "Dera", "Seyi", "Favour", "Moyo", "Fola", "Titilayo",
         "Fadekemi", "Hauwa", "Ezinne", "Amarachi", "Eniola", "Ronke",
      ],
      last: [
         "Okafor", "Adeyemi", "Balogun", "Eze", "Ogunleye", "Nwosu", "Abubakar",
         "Afolabi", "Okeke", "Olawale", "Bello", "Okonkwo", "Adebayo", "Chukwu",
         "Nwachukwu", "Lawal", "Ojo", "Obi", "Danjuma", "Bakare", "Ibeh", "Sani",
      ],
   },
   GH: {
      male: ["Kwame", "Kofi", "Kojo", "Yaw", "Kwesi", "Nana", "Fiifi", "Ebo", "Selorm", "mensah"],
      female: ["Ama", "Akosua", "Abena", "Efua", "Adwoa", "Yaa", "Esi", "Dzifa", "Naa", "Serwaa"],
      last: ["Mensah", "Owusu", "Osei", "Boateng", "Appiah", "Asante", "Tetteh", "Quaye", "Annan"],
   },
   KE: {
      male: ["Brian", "Kevin", "Kamau", "Otieno", "Mwangi", "Kiprop", "Baraka", "Juma", "collins"],
      female: ["Wanjiku", "Achieng", "Njeri", "Faith", "Mercy", "Zawadi", "Neema", "Muthoni", "Brenda"],
      last: ["Ochieng", "Njoroge", "Kariuki", "Mutua", "Omondi", "Koech", "Maina", "Kimani"],
   },
   ZA: {
      male: ["Thabo", "Sipho", "Liam", "Sibusiso", "Tshepo", "Kagiso", "Mandla", "Lwazi", "Johan"],
      female: ["Naledi", "Lerato", "Zanele", "Thandi", "Khanyi", "Chloe", "Anika", "Busisiwe", "Buhle"],
      last: ["Dlamini", "Nkosi", "Ndlovu", "Khumalo", "Mokoena", "Botha", "Molefe", "Sithole"],
   },
};

export interface GeneratedBotIdentity {
   id: string;
   username: string;
   avatar_url: string;
   country_code: RegionCode;
   gender: BotGender;
   rating: number;
   xp: number;
   games_played: number;
   games_won: number;
   games_lost: number;
   games_tied: number;
   rank_name: string;
   bot_personality: BotPersonality;
}

function sanitizeHandle(raw: string): string {
   const cleaned = raw
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9_]/g, "");
   if (cleaned.length < WORDUP_LIMITS.MIN_NICKNAME_LENGTH) {
      return `${cleaned}99`.slice(0, WORDUP_LIMITS.MAX_NICKNAME_LENGTH);
   }
   return cleaned.slice(0, WORDUP_LIMITS.MAX_NICKNAME_LENGTH);
}

function pickNameForRegion(region: RegionCode, gender: BotGender): { first: string; last: string } {
   const customPool = REGIONAL_NAMES[region];
   const fakerInstance = FAKER_BY_REGION[region] || fakerEN_US;

   // If we have a supplemental regional pool, blend 65% supplemental + 35% localized Faker
   if (customPool && Math.random() < 0.65) {
      const firstList = gender === "male" ? customPool.male : customPool.female;
      const first = firstList[Math.floor(Math.random() * firstList.length)];
      const last = customPool.last[Math.floor(Math.random() * customPool.last.length)];
      return { first, last };
   }

   const first = fakerInstance.person.firstName(gender);
   const last = fakerInstance.person.lastName();
   return { first, last };
}

/**
 * Formats a first and last name into a natural human username handle (3–15 chars).
 */
export function buildRealisticUsername(first: string, last: string): string {
   const fClean = first.replace(/[^A-Za-z]/g, "");
   const lClean = last.replace(/[^A-Za-z]/g, "");

   const patternRoll = Math.random();
   let candidate: string;

   if (patternRoll < 0.25) {
      // Pattern 1: FirstName + LastInitial (e.g. "TundeB", "Amaka_O", "chidi_e")
      const sep = Math.random() < 0.45 ? "_" : "";
      const initial = lClean[0] || "X";
      candidate = `${fClean}${sep}${initial}`;
      if (Math.random() < 0.35) candidate = candidate.toLowerCase();
   } else if (patternRoll < 0.5) {
      // Pattern 2: FirstName + 2-digit number (e.g. "kemi24", "Damilola99", "Tobi_07")
      const num = Math.floor(Math.random() * 89) + 10;
      const sep = Math.random() < 0.3 ? "_" : "";
      const base = Math.random() < 0.5 ? fClean.toLowerCase() : fClean;
      candidate = `${base.slice(0, 11)}${sep}${num}`;
   } else if (patternRoll < 0.72) {
      // Pattern 3: FirstName + short LastName prefix (e.g. "ChidiOka", "zainab_bal")
      const sep = Math.random() < 0.4 ? "_" : "";
      const lPart = lClean.slice(0, 4);
      candidate = `${fClean.slice(0, 9)}${sep}${lPart}`;
      if (Math.random() < 0.4) candidate = candidate.toLowerCase();
   } else if (patternRoll < 0.88) {
      // Pattern 4: Pure first name or casual handle (e.g. "Oluwaseun", "Chioma", "iam_femi")
      const prefixRoll = Math.random();
      if (prefixRoll < 0.25 && fClean.length <= 10) {
         candidate = `iam_${fClean.toLowerCase()}`;
      } else if (prefixRoll < 0.45 && fClean.length <= 11) {
         candidate = `real_${fClean.toLowerCase()}`;
      } else {
         candidate = fClean;
      }
   } else {
      // Pattern 5: LastName + FirstInitial or numbers (e.g. "Balogun_T", "okafor10")
      const num = Math.floor(Math.random() * 90) + 10;
      candidate =
         Math.random() < 0.5
            ? `${lClean.slice(0, 11)}_${(fClean[0] || "A").toUpperCase()}`
            : `${lClean.toLowerCase().slice(0, 12)}${num}`;
   }

   return sanitizeHandle(candidate);
}

export function getRankNameForRating(rating: number): string {
   if (rating >= 1700) return "Master";
   if (rating >= 1400) return "Diamond";
   if (rating >= 1100) return "Gold";
   if (rating >= 800) return "Silver";
   return "Bronze";
}

/**
 * Spawns a complete synthetic bot profile ready to be persisted to Supabase.
 */
export function generateSyntheticBotIdentity(
   targetUserRating: number = 600,
   overrideRegion?: RegionCode,
): GeneratedBotIdentity {
   const estimated = estimateUserLocation();
   const region = overrideRegion || pickSpawnRegion(estimated);
   const gender: BotGender = Math.random() < 0.5 ? "male" : "female";
   const id = crypto.randomUUID();

   const { first, last } = pickNameForRegion(region, gender);
   const username = buildRealisticUsername(first, last);
   const avatar_url = generateRealisticBotAvatar(`${id}-${username}`, region, gender);

   // Initial rating within ±140 of targetUserRating (clamped >= 600)
   const ratingOffset = Math.round((Math.random() - 0.48) * 260);
   const rating = Math.max(600, targetUserRating + ratingOffset);
   const rank_name = getRankNameForRating(rating);

   // Seed plausible initial history so newly spawned profiles don't all look like 0-game accounts
   const games_played = Math.floor(Math.random() * 14) + 2;
   const winRate = Math.min(0.8, Math.max(0.3, 0.42 + (rating - 600) / 2200));
   const games_won = Math.max(1, Math.min(games_played, Math.round(games_played * winRate)));
   const remaining = games_played - games_won;
   const games_tied = remaining > 2 && Math.random() < 0.25 ? 1 : 0;
   const games_lost = Math.max(0, remaining - games_tied);
   const xp = games_played * 50 + games_won * 100 + games_played * 45;

   const bot_personality = generateBotPersonality(rating, region);

   return {
      id,
      username,
      avatar_url,
      country_code: region,
      gender,
      rating,
      xp,
      games_played,
      games_won,
      games_lost,
      games_tied,
      rank_name,
      bot_personality,
   };
}

