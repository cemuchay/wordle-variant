const LAST_CHALLENGES_VISIT_KEY = 'last_challenges_tab_visit';
const LAST_CHALLENGE_ANNOUNCEMENT_DATE_KEY = 'last_challenge_announcement_date';
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/**
 * Returns today's local calendar date as YYYY-MM-DD.
 */
export function getLocalDateKey(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Records the current timestamp as the user's most recent visit to the Challenges tab.
 */
export function recordChallengesTabVisit(now: number = Date.now()): void {
    try {
        localStorage.setItem(LAST_CHALLENGES_VISIT_KEY, String(now));
    } catch {
        // Ignore storage errors (e.g. private browsing / quota exceeded)
    }
}

/**
 * Returns true if the user has visited the Challenges tab within the given threshold (default: 24h).
 */
export function hasVisitedChallengesRecently(
    thresholdMs: number = TWENTY_FOUR_HOURS_MS,
    now: number = Date.now()
): boolean {
    try {
        const raw = localStorage.getItem(LAST_CHALLENGES_VISIT_KEY);
        if (!raw) return false;
        const lastVisit = Number(raw);
        if (Number.isNaN(lastVisit)) return false;
        return now - lastVisit < thresholdMs;
    } catch {
        return false;
    }
}

/**
 * Returns true if the daily challenge announcement modal has already been shown today.
 */
export function hasSeenChallengeAnnouncementToday(date: Date = new Date()): boolean {
    try {
        const savedDate = localStorage.getItem(LAST_CHALLENGE_ANNOUNCEMENT_DATE_KEY);
        return savedDate === getLocalDateKey(date);
    } catch {
        return false;
    }
}

/**
 * Marks the daily challenge announcement modal as seen for today's local date.
 */
export function markChallengeAnnouncementSeenToday(date: Date = new Date()): void {
    try {
        localStorage.setItem(LAST_CHALLENGE_ANNOUNCEMENT_DATE_KEY, getLocalDateKey(date));
    } catch {
        // Ignore storage errors
    }
}

