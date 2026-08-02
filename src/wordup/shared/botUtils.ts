/**
 * Utility functions for handling bot match IDs and sanitizing them before sending database or API requests.
 */

/**
 * Checks if a given match ID is a bot match (starts with "bot-" or includes "bot-").
 */
export function isBotMatchId(matchId: string | null | undefined): boolean {
   if (!matchId) return false;
   return matchId.startsWith("bot-") || matchId.includes("bot-");
}

/**
 * Strips all bot keyword prefixes (e.g. "bot-marathon-", "bot-match-", "bot-") from a match ID
 * to ensure that database queries receive a valid clean UUID string without causing 400 Bad Request / 22P02 errors.
 */
export function cleanBotMatchId(matchId: string | null | undefined): string {
   if (!matchId) return "";
   return matchId.replace(/^bot-(?:marathon-|match-)?/, "");
}
