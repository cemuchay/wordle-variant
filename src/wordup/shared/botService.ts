import { supabase } from "../../lib/supabaseClient";
import { RATING, XP } from "../../constants/wordup";
import { safeLocalStorage } from "../../utils/storage";
import { estimateUserLocation } from "./locationEstimator";
import {
   generateSyntheticBotIdentity,
   getRankNameForRating,
   type GeneratedBotIdentity,
} from "./botIdentityGenerator";
import type { BotPersonality } from "./botPersonality";
import type { ProfileStats } from "./types";

export interface ActiveBotOpponent {
   id: string;
   username: string;
   avatar_url: string;
   country_code: string;
   rating: number;
   xp: number;
   games_played: number;
   games_won: number;
   games_lost: number;
   games_tied: number;
   rank_name: string;
   is_bot: true;
   bot_personality: BotPersonality;
}

const LOCAL_BOT_POOL_KEY = "wordup_local_synthetic_bots_v1";

function getLocalBotPool(): ActiveBotOpponent[] {
   try {
      const raw = safeLocalStorage.getItem(LOCAL_BOT_POOL_KEY);
      return raw ? JSON.parse(raw) : [];
   } catch {
      return [];
   }
}

function saveToLocalBotPool(bot: ActiveBotOpponent) {
   try {
      const pool = getLocalBotPool().filter((b) => b.id !== bot.id);
      pool.unshift(bot);
      safeLocalStorage.setItem(LOCAL_BOT_POOL_KEY, JSON.stringify(pool.slice(0, 25)));
   } catch {
      // ignore storage quota errors
   }
}

/**
 * Converts an ActiveBotOpponent to the standard ProfileStats shape expected by stores and UI views.
 */
export function botToProfileStats(bot: ActiveBotOpponent): ProfileStats {
   return {
      id: bot.id,
      username: bot.username,
      avatar_url: bot.avatar_url,
      rating: bot.rating,
      xp: bot.xp,
      games_played: bot.games_played,
      games_won: bot.games_won,
      games_lost: bot.games_lost,
      games_tied: bot.games_tied,
      rank_name: bot.rank_name,
      is_bot: true,
      bot_personality: bot.bot_personality,
   };
}

/**
 * Fetches an existing synthetic profile near the player's ELO and region from the database
 * (~70% of the time) or spawns a brand-new Faker.js synthetic profile on the fly (~30% of the time
 * or when no matching bot exists yet), persisting it to Supabase.
 */
export async function getOrSpawnBotOpponent(options: {
   userRating?: number;
   category?: string;
   excludeBotId?: string | null;
   forceSpawn?: boolean;
}): Promise<ActiveBotOpponent> {
   const targetRating = options.userRating || RATING.DEFAULT;
   const category = options.category || "mixed";
   const location = estimateUserLocation();

   // 30% chance to force-spawn a fresh bot so the ecosystem grows organically
   const shouldForceSpawn = options.forceSpawn ?? Math.random() < 0.3;

   // Pre-generate a candidate payload in case the DB needs to spawn a new one
   const candidate: GeneratedBotIdentity = generateSyntheticBotIdentity(targetRating);

   try {
      const { data, error } = await supabase.rpc("spawn_or_fetch_wordup_bot", {
         p_target_rating: targetRating,
         p_category: category,
         p_region: location.countryCode,
         p_force_spawn: shouldForceSpawn,
         p_exclude_bot_id: options.excludeBotId || null,
         p_spawn_payload: candidate,
      });

      if (!error && data) {
         const parsed = typeof data === "string" ? JSON.parse(data) : data;
         const bot: ActiveBotOpponent = {
            id: parsed.id || candidate.id,
            username: parsed.username || candidate.username,
            avatar_url: parsed.avatar_url || candidate.avatar_url,
            country_code: parsed.country_code || candidate.country_code,
            rating: parsed.rating ?? candidate.rating,
            xp: parsed.xp ?? candidate.xp,
            games_played: parsed.games_played ?? candidate.games_played,
            games_won: parsed.games_won ?? candidate.games_won,
            games_lost: parsed.games_lost ?? candidate.games_lost,
            games_tied: parsed.games_tied ?? candidate.games_tied,
            rank_name: parsed.rank_name || getRankNameForRating(parsed.rating ?? candidate.rating),
            is_bot: true,
            bot_personality: parsed.bot_personality || candidate.bot_personality,
         };
         saveToLocalBotPool(bot);
         return bot;
      }

      // Fallback if RPC migration hasn't been applied yet: try direct table query/insert
      if (!shouldForceSpawn) {
         const { data: existingBots } = await supabase
            .from("wordup_profiles")
            .select("*, profiles:id(username, avatar_url, country_code)")
            .eq("is_bot", true)
            .gte("rating", Math.max(600, targetRating - 280))
            .lte("rating", targetRating + 280)
            .limit(10);

         if (existingBots && existingBots.length > 0) {
            const pick = existingBots[Math.floor(Math.random() * existingBots.length)] as Record<string, unknown>;
            const prof = (pick.profiles as Record<string, unknown> | null) ?? null;
            if (typeof prof?.username === "string") {
               const ratingVal = typeof pick.rating === "number" ? pick.rating : targetRating;
               const bot: ActiveBotOpponent = {
                  id: String(pick.id),
                  username: prof.username,
                  avatar_url: typeof prof.avatar_url === "string" ? prof.avatar_url : candidate.avatar_url,
                  country_code: typeof prof.country_code === "string" ? prof.country_code : location.countryCode,
                  rating: ratingVal,
                  xp: typeof pick.xp === "number" ? pick.xp : 0,
                  games_played: typeof pick.games_played === "number" ? pick.games_played : 1,
                  games_won: typeof pick.games_won === "number" ? pick.games_won : 0,
                  games_lost: typeof pick.games_lost === "number" ? pick.games_lost : 0,
                  games_tied: typeof pick.games_tied === "number" ? pick.games_tied : 0,
                  rank_name: typeof pick.rank_name === "string" ? pick.rank_name : getRankNameForRating(ratingVal),
                  is_bot: true,
                  bot_personality: (pick.bot_personality as BotPersonality) || candidate.bot_personality,
               };
               saveToLocalBotPool(bot);
               return bot;
            }
         }
      }
   } catch (err) {
      console.warn("[WordUpBotService] DB bot fetch/spawn fallback to local pool:", err);
   }

   // Local fallback pool (when offline or in test environments)
   const localPool = getLocalBotPool().filter((b) => b.id !== options.excludeBotId);
   if (!shouldForceSpawn && localPool.length > 0) {
      const closeBots = localPool.filter((b) => Math.abs(b.rating - targetRating) <= 300);
      const poolToUse = closeBots.length > 0 ? closeBots : localPool;
      return poolToUse[Math.floor(Math.random() * poolToUse.length)];
   }

   const localBot: ActiveBotOpponent = {
      id: candidate.id,
      username: candidate.username,
      avatar_url: candidate.avatar_url,
      country_code: candidate.country_code,
      rating: candidate.rating,
      xp: candidate.xp,
      games_played: candidate.games_played,
      games_won: candidate.games_won,
      games_lost: candidate.games_lost,
      games_tied: candidate.games_tied,
      rank_name: candidate.rank_name,
      is_bot: true,
      bot_personality: candidate.bot_personality,
   };
   saveToLocalBotPool(localBot);
   return localBot;
}

/**
 * Calculates and persists the synthetic bot's ELO rating change, XP gain, and W/L/T stats
 * after a match finishes so the bot progresses on global & topic leaderboards.
 */
export async function updateBotStatsAfterMatch(params: {
   botId: string;
   botCurrentRating: number;
   playerRating: number;
   category: string;
   botScore: number;
   playerScore: number;
   botAnswers: Array<{ question_idx?: number; correct?: boolean; points?: number }>;
   playerAnswers: Array<{ question_idx?: number; correct?: boolean; points?: number }>;
   isMarathon?: boolean;
   totalRounds?: number;
}): Promise<void> {
   const {
      botId,
      botCurrentRating,
      playerRating,
      category,
      botScore,
      playerScore,
      botAnswers,
      playerAnswers,
      isMarathon,
      totalRounds = 7,
   } = params;

   if (!botId || botId === "00000000-0000-0000-0000-000000000b0b") return;

   const gameMultiplier = isMarathon ? Math.max(1, Math.round(totalRounds / 7)) : 1;
   let totalEloGain = 0;
   let totalXpReward = 0;
   let gamesWon = 0;
   let gamesLost = 0;
   let gamesTied = 0;

   if (gameMultiplier > 1) {
      for (let g = 0; g < gameMultiplier; g++) {
         const startRound = g * 7;
         const endRound = startRound + 7;
         const chunkBot = (botAnswers || []).filter(
            (a) => (a.question_idx ?? 0) >= startRound && (a.question_idx ?? 0) < endRound,
         );
         const chunkPlayer = (playerAnswers || []).filter(
            (a) => (a.question_idx ?? 0) >= startRound && (a.question_idx ?? 0) < endRound,
         );

         const bPts = chunkBot.reduce((sum, a) => sum + (a.points || 0), 0);
         const pPts = chunkPlayer.reduce((sum, a) => sum + (a.points || 0), 0);
         const bWon = bPts > pPts;
         const bTied = bPts === pPts;
         const bCorrect = chunkBot.filter((a) => a.correct).length;

         if (bWon) gamesWon++;
         else if (bTied) gamesTied++;
         else gamesLost++;

         totalXpReward += XP.BASE_REWARD + (bWon ? XP.WIN_BONUS : 0) + bCorrect * XP.PER_CORRECT;

         const expected = 1 / (1 + Math.pow(10, (playerRating - botCurrentRating) / RATING.DIVISOR));
         const actual = bWon ? 1 : bTied ? 0.5 : 0;
         let chunkElo = Math.round(RATING.K_FACTOR * (actual - expected)) + (bWon ? bCorrect : 0);
         if (bWon && chunkElo < RATING.MIN_GAIN_ON_WIN) chunkElo = RATING.MIN_GAIN_ON_WIN;
         if (!bWon && !bTied && chunkElo < RATING.MAX_LOSS_ON_LOSS) chunkElo = RATING.MAX_LOSS_ON_LOSS;

         totalEloGain += chunkElo;
      }
   } else {
      const bWon = botScore > playerScore;
      const bTied = botScore === playerScore;
      const bCorrect = (botAnswers || []).filter((a) => a.correct).length;

      if (bWon) gamesWon = 1;
      else if (bTied) gamesTied = 1;
      else gamesLost = 1;

      totalXpReward = XP.BASE_REWARD + (bWon ? XP.WIN_BONUS : 0) + bCorrect * XP.PER_CORRECT;

      const expected = 1 / (1 + Math.pow(10, (playerRating - botCurrentRating) / RATING.DIVISOR));
      const actual = bWon ? 1 : bTied ? 0.5 : 0;
      totalEloGain = Math.round(RATING.K_FACTOR * (actual - expected)) + (bWon ? bCorrect : 0);
      if (bWon && totalEloGain < RATING.MIN_GAIN_ON_WIN) totalEloGain = RATING.MIN_GAIN_ON_WIN;
      if (!bWon && !bTied && totalEloGain < RATING.MAX_LOSS_ON_LOSS) totalEloGain = RATING.MAX_LOSS_ON_LOSS;
   }

   const playedInc = gamesWon + gamesLost + gamesTied;

   // Update local cache copy
   const localPool = getLocalBotPool();
   const existingLocal = localPool.find((b) => b.id === botId);
   if (existingLocal) {
      const newRating = Math.max(RATING.FLOOR, existingLocal.rating + totalEloGain);
      existingLocal.rating = newRating;
      existingLocal.xp += totalXpReward;
      existingLocal.games_played += playedInc;
      existingLocal.games_won += gamesWon;
      existingLocal.games_lost += gamesLost;
      existingLocal.games_tied += gamesTied;
      existingLocal.rank_name = getRankNameForRating(newRating);
      saveToLocalBotPool(existingLocal);
   }

   // Persist via Supabase RPC
   try {
      await supabase.rpc("record_wordup_bot_match_result", {
         p_bot_id: botId,
         p_category: category,
         p_elo_gain: totalEloGain,
         p_xp_reward: totalXpReward,
         p_played_inc: playedInc,
         p_won_inc: gamesWon,
         p_lost_inc: gamesLost,
         p_tied_inc: gamesTied,
      });
   } catch (err) {
      console.warn("[WordUpBotService] Failed to update bot stats in DB:", err);
   }
}

