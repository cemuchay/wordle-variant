export interface StreakInput {
    status: string;
    game_date: string;
}

export interface StreakResult {
    currentStreak: number;
    maxStreak: number;
    isFrozen?: boolean;
}

// Retroactive start date for Duolingo-style streak freeze
const STREAK_FREEZE_START_DATE = '2026-09-01';

function parseDateToUTC(dateStr: string | Date): number {
    const d = new Date(dateStr);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function calculateStreak(scores: StreakInput[]): StreakResult {
    const wonDates = scores
        .filter(s => s.status === 'won')
        .map(s => s.game_date)
        .filter((v, i, a) => a.indexOf(v) === i)
        .sort();

    let maxStreak = 0;
    let currentStreak = 0;
    let prevDateUtc: number | null = null;
    const freezeStartUtc = parseDateToUTC(STREAK_FREEZE_START_DATE);

    for (const dStr of wonDates) {
        const currentDateUtc = parseDateToUTC(dStr);
        if (prevDateUtc === null) {
            currentStreak = 1;
        } else {
            const diffDays = Math.round((currentDateUtc - prevDateUtc) / (1000 * 60 * 60 * 24));
            if (diffDays === 1) {
                // Consecutive day win
                currentStreak += 1;
            } else if (diffDays === 2 && currentDateUtc >= freezeStartUtc) {
                // Missed exactly 1 day after streak freeze effective date:
                // Streak is maintained/frozen and resumes with this win (no bonus count for missed day)
                currentStreak += 1;
            } else if (diffDays > 1) {
                // Missed more than 1 day (or 1 missed day before freeze effective date)
                if (currentStreak > maxStreak) maxStreak = currentStreak;
                currentStreak = 1;
            }
        }
        prevDateUtc = currentDateUtc;
    }
    if (currentStreak > maxStreak) maxStreak = currentStreak;

    let isFrozen = false;
    if (prevDateUtc !== null) {
        const now = new Date();
        const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
        const daysSinceLastWon = Math.round((todayUtc - prevDateUtc) / (1000 * 60 * 60 * 24));

        if (daysSinceLastWon === 0 || daysSinceLastWon === 1) {
            // Won today or won yesterday (still time to play today)
            isFrozen = false;
        } else if (daysSinceLastWon === 2 && todayUtc >= freezeStartUtc) {
            // Won 2 days ago, missed yesterday, playing today will save streak
            isFrozen = true;
        } else {
            // Missed 2+ days or expired freeze
            currentStreak = 0;
            isFrozen = false;
        }
    }

    return { currentStreak, maxStreak, isFrozen };
}
