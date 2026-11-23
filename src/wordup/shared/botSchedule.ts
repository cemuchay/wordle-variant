import type { RegionCode } from "./locationEstimator";

export type BotLifestyle =
   | "student"
   | "nine_to_five"
   | "remote_freelancer"
   | "night_owl"
   | "early_bird"
   | "shift_trader";

export interface ActiveWindow {
   /** Minutes since local midnight (0–1439) */
   startMinute: number;
   /** Minutes since local midnight (0–1439). If < startMinute, window wraps past midnight. */
   endMinute: number;
}

export interface BotSchedule {
   lifestyle: BotLifestyle;
   timeZone: string;
   weekdayWindows: ActiveWindow[];
   weekendWindows: ActiveWindow[];
}

const REGION_TIMEZONES: Record<RegionCode, string[]> = {
   NG: ["Africa/Lagos"],
   GH: ["Africa/Accra"],
   KE: ["Africa/Nairobi"],
   ZA: ["Africa/Johannesburg"],
   GB: ["Europe/London"],
   US: ["America/New_York", "America/Chicago", "America/Los_Angeles"],
   CA: ["America/Toronto", "America/Vancouver"],
   AU: ["Australia/Sydney", "Australia/Melbourne"],
   IN: ["Asia/Kolkata"],
   FR: ["Europe/Paris"],
   DE: ["Europe/Berlin"],
   ES: ["Europe/Madrid", "America/Mexico_City"],
   BR: ["America/Sao_Paulo"],
};

const hm = (h: number, m = 0): number => (h * 60 + m) % 1440;

const LIFESTYLE_PRESETS: Record<
   BotLifestyle,
   {
      weight: number;
      weekdayWindows: ActiveWindow[];
      weekendWindows: ActiveWindow[];
   }
> = {
   // University / secondary students: morning break, post-lecture afternoon, late evening
   student: {
      weight: 26,
      weekdayWindows: [
         { startMinute: hm(8, 30), endMinute: hm(10, 0) },
         { startMinute: hm(14, 0), endMinute: hm(17, 30) },
         { startMinute: hm(20, 0), endMinute: hm(0, 30) },
      ],
      weekendWindows: [
         { startMinute: hm(10, 0), endMinute: hm(14, 30) },
         { startMinute: hm(18, 0), endMinute: hm(1, 30) },
      ],
   },
   // 9-to-5 office workers: morning commute, lunch break, evening wind-down
   nine_to_five: {
      weight: 28,
      weekdayWindows: [
         { startMinute: hm(7, 0), endMinute: hm(8, 45) },
         { startMinute: hm(12, 0), endMinute: hm(13, 45) },
         { startMinute: hm(17, 45), endMinute: hm(22, 30) },
      ],
      weekendWindows: [
         { startMinute: hm(9, 30), endMinute: hm(13, 0) },
         { startMinute: hm(16, 0), endMinute: hm(23, 0) },
      ],
   },
   // Remote workers / freelancers / creators: flexible pockets across the day
   remote_freelancer: {
      weight: 16,
      weekdayWindows: [
         { startMinute: hm(9, 30), endMinute: hm(12, 0) },
         { startMinute: hm(14, 30), endMinute: hm(18, 0) },
         { startMinute: hm(20, 30), endMinute: hm(23, 30) },
      ],
      weekendWindows: [
         { startMinute: hm(11, 0), endMinute: hm(15, 0) },
         { startMinute: hm(19, 0), endMinute: hm(23, 30) },
      ],
   },
   // Night owls / late-shift gamers: afternoon + late night into early morning
   night_owl: {
      weight: 12,
      weekdayWindows: [
         { startMinute: hm(13, 0), endMinute: hm(16, 0) },
         { startMinute: hm(21, 30), endMinute: hm(3, 30) },
      ],
      weekendWindows: [
         { startMinute: hm(14, 0), endMinute: hm(18, 0) },
         { startMinute: hm(22, 0), endMinute: hm(4, 30) },
      ],
   },
   // Early risers / morning commuters: early morning, midday, early evening
   early_bird: {
      weight: 8,
      weekdayWindows: [
         { startMinute: hm(5, 30), endMinute: hm(8, 30) },
         { startMinute: hm(12, 30), endMinute: hm(14, 0) },
         { startMinute: hm(18, 30), endMinute: hm(21, 0) },
      ],
      weekendWindows: [
         { startMinute: hm(6, 30), endMinute: hm(11, 0) },
         { startMinute: hm(15, 0), endMinute: hm(20, 30) },
      ],
   },
   // Shop / business owners / traders: quiet morning, midday lull, evening
   shift_trader: {
      weight: 10,
      weekdayWindows: [
         { startMinute: hm(8, 0), endMinute: hm(11, 0) },
         { startMinute: hm(13, 30), endMinute: hm(16, 30) },
         { startMinute: hm(19, 30), endMinute: hm(22, 0) },
      ],
      weekendWindows: [
         { startMinute: hm(9, 0), endMinute: hm(12, 30) },
         { startMinute: hm(17, 0), endMinute: hm(22, 30) },
      ],
   },
};

const ALL_LIFESTYLES = Object.keys(LIFESTYLE_PRESETS) as BotLifestyle[];

function normalizeMinute(minute: number): number {
   return ((minute % 1440) + 1440) % 1440;
}

function hashString(str: string): number {
   let hash = 2166136261;
   for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
   }
   return hash >>> 0;
}

/**
 * Picks a valid IANA timezone string for a RegionCode.
 */
export function getDefaultTimeZoneForRegion(region: RegionCode | string | undefined, seed?: string): string {
   const key = (region || "NG").toUpperCase() as RegionCode;
   const list = REGION_TIMEZONES[key] || REGION_TIMEZONES.NG;
   if (list.length === 1) return list[0];
   if (seed) {
      return list[hashString(seed) % list.length];
   }
   return list[Math.floor(Math.random() * list.length)];
}

/**
 * Checks whether a minute-of-day (0–1439) falls within an ActiveWindow.
 * Supports overnight wrap-around (e.g., 21:30 → 03:30 where endMinute < startMinute).
 */
export function isMinuteInWindow(minuteOfDay: number, win: ActiveWindow): boolean {
   const m = normalizeMinute(minuteOfDay);
   const start = normalizeMinute(win.startMinute);
   const end = normalizeMinute(win.endMinute);

   if (start === end) return true;
   if (start < end) {
      return m >= start && m <= end;
   }
   // Wraps past midnight
   return m >= start || m <= end;
}

/**
 * Extracts local day-of-week (isWeekend) and minuteOfDay (0–1439) for a given IANA timezone.
 */
export function getLocalTimeParts(
   timeZone: string,
   now: Date = new Date(),
): { isWeekend: boolean; minuteOfDay: number } {
   try {
      const formatter = new Intl.DateTimeFormat("en-US", {
         timeZone,
         weekday: "short",
         hour: "2-digit",
         minute: "2-digit",
         hour12: false,
      });
      const parts = formatter.formatToParts(now);
      const weekday = parts.find((p) => p.type === "weekday")?.value || "Mon";
      const hourRaw = Number.parseInt(parts.find((p) => p.type === "hour")?.value || "12", 10);
      const minuteRaw = Number.parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);

      const hour = Number.isFinite(hourRaw) ? hourRaw % 24 : 12;
      const minute = Number.isFinite(minuteRaw) ? minuteRaw % 60 : 0;
      const isWeekend = weekday === "Sat" || weekday === "Sun";

      return { isWeekend, minuteOfDay: hour * 60 + minute };
   } catch {
      // Fallback to UTC+1 (Africa/Lagos) if timezone is unrecognized
      const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
      const lagosMinutes = normalizeMinute(utcMinutes + 60);
      const day = now.getUTCDay();
      return {
         isWeekend: day === 0 || day === 6,
         minuteOfDay: lagosMinutes,
      };
   }
}

function jitterWindows(windows: ActiveWindow[], maxJitterMinutes: number, rng: () => number): ActiveWindow[] {
   return windows.map((w) => {
      const startShift = Math.round((rng() * 2 - 1) * maxJitterMinutes);
      const endShift = Math.round((rng() * 2 - 1) * maxJitterMinutes);
      return {
         startMinute: normalizeMinute(w.startMinute + startShift),
         endMinute: normalizeMinute(w.endMinute + endShift),
      };
   });
}

function pickWeightedLifestyle(candidates: BotLifestyle[]): BotLifestyle {
   const totalWeight = candidates.reduce((sum, l) => sum + LIFESTYLE_PRESETS[l].weight, 0);
   let roll = Math.random() * totalWeight;
   for (const lifestyle of candidates) {
      roll -= LIFESTYLE_PRESETS[lifestyle].weight;
      if (roll <= 0) return lifestyle;
   }
   return candidates[0] || "student";
}

/**
 * Derives a deterministic fallback schedule for legacy DB bots that were created
 * before active time windows were introduced.
 */
export function deriveLegacyBotSchedule(botId: string, region?: RegionCode | string): BotSchedule {
   const h = hashString(botId || "legacy-bot");
   const lifestyle = ALL_LIFESTYLES[h % ALL_LIFESTYLES.length];
   const preset = LIFESTYLE_PRESETS[lifestyle];
   const timeZone = getDefaultTimeZoneForRegion(region, botId);

   // Deterministic ±20 min personal offset
   let seed = h || 1;
   const seededRng = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0xffffffff;
   };

   return {
      lifestyle,
      timeZone,
      weekdayWindows: jitterWindows(preset.weekdayWindows, 20, seededRng),
      weekendWindows: jitterWindows(preset.weekendWindows, 20, seededRng),
   };
}

/**
 * Evaluates whether a bot is currently within one of its active time windows
 * in its own local timezone.
 */
export function isBotActiveAt(
   schedule: BotSchedule | undefined | null,
   now: Date = new Date(),
   fallbackSeed?: { botId?: string; region?: RegionCode | string },
): boolean {
   const effectiveSchedule =
      schedule && schedule.timeZone && (schedule.weekdayWindows?.length || schedule.weekendWindows?.length)
         ? schedule
         : fallbackSeed?.botId
            ? deriveLegacyBotSchedule(fallbackSeed.botId, fallbackSeed.region)
            : null;

   if (!effectiveSchedule) return true;

   const { isWeekend, minuteOfDay } = getLocalTimeParts(effectiveSchedule.timeZone, now);
   const windows = isWeekend ? effectiveSchedule.weekendWindows : effectiveSchedule.weekdayWindows;
   if (!windows || windows.length === 0) return false;

   return windows.some((w) => isMinuteInWindow(minuteOfDay, w));
}

/**
 * Generates a realistic timezone-aware daily schedule for a newly spawned bot.
 * When `ensureActiveNow` is true (default for live matchmaking), picks a lifestyle
 * whose schedule covers the current local time in `region` so the bot is genuinely
 * online at match time and naturally goes offline outside its windows later.
 */
export function generateBotSchedule(
   region: RegionCode = "NG",
   now: Date = new Date(),
   ensureActiveNow: boolean = true,
): BotSchedule {
   const timeZone = getDefaultTimeZoneForRegion(region);
   const { isWeekend, minuteOfDay } = getLocalTimeParts(timeZone, now);

   let chosenLifestyle: BotLifestyle;
   if (ensureActiveNow) {
      const matching = ALL_LIFESTYLES.filter((l) => {
         const preset = LIFESTYLE_PRESETS[l];
         const windows = isWeekend ? preset.weekendWindows : preset.weekdayWindows;
         return windows.some((w) => isMinuteInWindow(minuteOfDay, w));
      });

      chosenLifestyle = matching.length > 0 ? pickWeightedLifestyle(matching) : "night_owl";
   } else {
      chosenLifestyle = pickWeightedLifestyle(ALL_LIFESTYLES);
   }

   const preset = LIFESTYLE_PRESETS[chosenLifestyle];
   let weekdayWindows = jitterWindows(preset.weekdayWindows, 20, Math.random);
   let weekendWindows = jitterWindows(preset.weekendWindows, 20, Math.random);

   // If jitter pushed the current minute just outside or it's an ultra-quiet hour (e.g. 04:45 AM),
   // gently anchor one window so `ensureActiveNow` always holds true for the newly spawned bot.
   if (ensureActiveNow) {
      const activeList = isWeekend ? weekendWindows : weekdayWindows;
      const alreadyActive = activeList.some((w) => isMinuteInWindow(minuteOfDay, w));
      if (!alreadyActive) {
         const anchoredWindow: ActiveWindow = {
            startMinute: normalizeMinute(minuteOfDay - (20 + Math.floor(Math.random() * 40))),
            endMinute: normalizeMinute(minuteOfDay + (75 + Math.floor(Math.random() * 60))),
         };
         if (isWeekend) {
            weekendWindows = [...weekendWindows, anchoredWindow];
         } else {
            weekdayWindows = [...weekdayWindows, anchoredWindow];
         }
      }
   }

   return {
      lifestyle: chosenLifestyle,
      timeZone,
      weekdayWindows,
      weekendWindows,
   };
}
