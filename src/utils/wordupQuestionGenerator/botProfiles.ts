import type { WordUpQuestion } from "./types";

export interface BotProfile {
   name: string;
   accuracy: number;
   minDelay: number;
   maxDelay: number;
}

export const BOT_PROFILES: Record<string, BotProfile> = {
   slow_thinker: {
      name: "Sloths",
      accuracy: 0.67,
      minDelay: 6.0,
      maxDelay: 9.0,
   },
   average: { name: "Player", accuracy: 0.75, minDelay: 4.0, maxDelay: 7.5 },
   fast: { name: "Speedy", accuracy: 0.85, minDelay: 1.5, maxDelay: 2 },
   master: { name: "Zinny", accuracy: 0.97, minDelay: 1, maxDelay: 2 },
   impossible: { name: "Variant", accuracy: 1.0, minDelay: 0.5, maxDelay: 1.8 },
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
   okada_rider: { name: "Okada", accuracy: 0.8, minDelay: 2.5, maxDelay: 5.5 },
   naija_flash: { name: "Flash", accuracy: 0.8, minDelay: 0.1, maxDelay: 1 },
   suya_thinker: { name: "Suya", accuracy: 0.74, minDelay: 4.0, maxDelay: 7.0 },
   pepper_soup: {
      name: "PepperSoup",
      accuracy: 0.79,
      minDelay: 3.2,
      maxDelay: 6.2,
   },
   agbada_mode: { name: "Agidi", accuracy: 0.83, minDelay: 2.8, maxDelay: 5.8 },
   street_king: {
      name: "Marlians",
      accuracy: 0.67,
      minDelay: 3.0,
      maxDelay: 5.5,
   },
   teddy: {
      name: "Teddy",
      accuracy: 0.7,
      minDelay: 2.0,
      maxDelay: 3,
   },
   ogbonge_mind: {
      name: "Shelly",
      accuracy: 0.9,
      minDelay: 1.8,
      maxDelay: 4.0,
   },
   eko_flash: { name: "Eko", accuracy: 0.86, minDelay: 2.2, maxDelay: 4.8 },
};

export const getRandomBotProfile = (): string => {
   const keys = Object.keys(BOT_PROFILES);
   return keys[Math.floor(Math.random() * keys.length)];
};

export const simulateBotResponse = (
   _question: WordUpQuestion,
   profileKey: string,
   duration: number = 10.0,
): { correct: boolean; time_taken: number; points: number } => {
   const profile = BOT_PROFILES[profileKey] || BOT_PROFILES.average;
   const correct = Math.random() < profile.accuracy;
   const time_taken = parseFloat(
      (
         Math.random() * (profile.maxDelay - profile.minDelay) +
         profile.minDelay
      ).toFixed(2),
   );
   let points = 0;
   if (correct) {
      const eff = Math.max(0, time_taken - 1.5);
      const denom = duration - 1.5;
      points = Math.max(
         11,
         Math.round(20 * (1 - eff / (denom > 0 ? denom : duration))),
      );
   }
   return { correct, time_taken, points };
};
