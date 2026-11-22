/**
 * Estimates the player's geographic region and cultural naming pool
 * using non-intrusive browser signals (IANA timezone & navigator.languages).
 */

export type RegionCode =
   | "NG" // Nigeria / West Africa
   | "GH" // Ghana
   | "KE" // Kenya / East Africa
   | "ZA" // South Africa / Southern Africa
   | "GB" // United Kingdom / Ireland
   | "US" // United States
   | "CA" // Canada
   | "AU" // Australia / NZ
   | "IN" // India / South Asia
   | "FR" // Francophone / France
   | "DE" // DACH / Germany
   | "ES" // Spain / LatAm Spanish
   | "BR"; // Brazil / Lusophone

export interface EstimatedLocation {
   countryCode: RegionCode;
   timeZone: string;
   locale: string;
   neighborRegions: RegionCode[];
}

const TIMEZONE_TO_REGION: Record<string, RegionCode> = {
   "africa/lagos": "NG",
   "africa/porto-novo": "NG",
   "africa/niamey": "NG",
   "africa/douala": "NG",
   "africa/accra": "GH",
   "africa/abidjan": "GH",
   "africa/freetown": "GH",
   "africa/monrovia": "GH",
   "africa/nairobi": "KE",
   "africa/kampala": "KE",
   "africa/dar_es_salaam": "KE",
   "africa/addis_ababa": "KE",
   "africa/kigali": "KE",
   "africa/johannesburg": "ZA",
   "africa/harare": "ZA",
   "africa/lusaka": "ZA",
   "africa/gaborone": "ZA",
   "africa/windhoek": "ZA",
   "europe/london": "GB",
   "europe/dublin": "GB",
   "europe/paris": "FR",
   "europe/brussels": "FR",
   "europe/berlin": "DE",
   "europe/zurich": "DE",
   "europe/vienna": "DE",
   "europe/madrid": "ES",
   "america/mexico_city": "ES",
   "america/bogota": "ES",
   "america/buenos_aires": "ES",
   "america/santiago": "ES",
   "america/lima": "ES",
   "america/sao_paulo": "BR",
   "europe/lisbon": "BR",
   "asia/kolkata": "IN",
   "asia/calcutta": "IN",
   "asia/karachi": "IN",
   "asia/dhaka": "IN",
   "australia/sydney": "AU",
   "australia/melbourne": "AU",
   "australia/brisbane": "AU",
   "australia/perth": "AU",
   "pacific/auckland": "AU",
   "america/toronto": "CA",
   "america/vancouver": "CA",
   "america/halifax": "CA",
   "america/edmonton": "CA",
   "america/winnipeg": "CA",
};

const NEIGHBOR_REGIONS: Record<RegionCode, RegionCode[]> = {
   NG: ["GH", "GB", "KE", "ZA", "US"],
   GH: ["NG", "GB", "ZA", "KE", "US"],
   KE: ["NG", "ZA", "GH", "GB", "US"],
   ZA: ["NG", "KE", "GH", "GB", "AU"],
   GB: ["NG", "US", "CA", "AU", "FR"],
   US: ["CA", "GB", "NG", "ES", "AU"],
   CA: ["US", "GB", "FR", "NG", "IN"],
   AU: ["GB", "US", "CA", "ZA", "IN"],
   IN: ["GB", "US", "CA", "AU", "NG"],
   FR: ["GB", "DE", "ES", "CA", "NG"],
   DE: ["GB", "FR", "US", "ES", "CA"],
   ES: ["US", "BR", "FR", "GB", "DE"],
   BR: ["ES", "US", "GB", "FR", "NG"],
};

/**
 * Estimates the user's region code from browser timezone and locale settings.
 */
export function estimateUserLocation(): EstimatedLocation {
   let tz = "Africa/Lagos";
   let lang = "en-NG";

   try {
      if (typeof Intl !== "undefined" && Intl.DateTimeFormat) {
         const resolved = Intl.DateTimeFormat().resolvedOptions();
         if (resolved?.timeZone) {
            tz = resolved.timeZone;
         }
         if (resolved?.locale) {
            lang = resolved.locale;
         }
      }
      if (typeof navigator !== "undefined") {
         if (navigator.language) {
            lang = navigator.language;
         }
      }
   } catch {
      // Fallback to default
   }

   const tzLower = tz.toLowerCase();
   let countryCode: RegionCode | undefined = TIMEZONE_TO_REGION[tzLower];

   if (!countryCode) {
      if (tzLower.startsWith("africa/")) {
         countryCode = "NG";
      } else if (tzLower.startsWith("america/")) {
         countryCode = "US";
      } else if (tzLower.startsWith("europe/")) {
         countryCode = "GB";
      } else if (tzLower.startsWith("australia/") || tzLower.startsWith("pacific/")) {
         countryCode = "AU";
      } else if (tzLower.startsWith("asia/")) {
         countryCode = "IN";
      }
   }

   // Secondary check from language tag (e.g. en-NG, en-GB, fr-FR)
   const langParts = lang.replace("_", "-").split("-");
   const langCountry = (langParts[1] || "").toUpperCase();
   const validRegions: RegionCode[] = ["NG", "GH", "KE", "ZA", "GB", "US", "CA", "AU", "IN", "FR", "DE", "ES", "BR"];

   if (!countryCode && validRegions.includes(langCountry as RegionCode)) {
      countryCode = langCountry as RegionCode;
   } else if (countryCode === "GB" && langCountry === "NG") {
      countryCode = "NG";
   }

   const finalCode: RegionCode = countryCode || "NG";

   return {
      countryCode: finalCode,
      timeZone: tz,
      locale: lang,
      neighborRegions: NEIGHBOR_REGIONS[finalCode] || ["GB", "US", "NG"],
   };
}

/**
 * Picks a region for spawning a bot:
 * - 75% chance: user's primary estimated region
 * - 25% chance: one of the culturally/geographically connected neighbor regions
 */
export function pickSpawnRegion(estimated?: EstimatedLocation): RegionCode {
   const loc = estimated || estimateUserLocation();
   if (Math.random() < 0.75 || loc.neighborRegions.length === 0) {
      return loc.countryCode;
   }
   const idx = Math.floor(Math.random() * loc.neighborRegions.length);
   return loc.neighborRegions[idx];
}

