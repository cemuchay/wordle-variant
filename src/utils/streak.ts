export interface StreakInput {
    status: string;
    game_date: string;
}

export interface StreakResult {
    currentStreak: number;
    maxStreak: number;
}

export function calculateStreak(scores: StreakInput[]): StreakResult {
    const wonDates = scores
        .filter(s => s.status === 'won')
        .map(s => s.game_date)
        .filter((v, i, a) => a.indexOf(v) === i)
        .sort();

    let maxStreak = 0;
    let currentStreak = 0;
    let prevDate: Date | null = null;

    for (const dStr of wonDates) {
        const currentDate = new Date(dStr);
        if (!prevDate) {
            currentStreak = 1;
        } else {
            const diffTime = Math.abs(currentDate.getTime() - prevDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays === 1) {
                currentStreak += 1;
            } else if (diffDays > 1) {
                if (currentStreak > maxStreak) maxStreak = currentStreak;
                currentStreak = 1;
            }
        }
        prevDate = currentDate;
    }
    if (currentStreak > maxStreak) maxStreak = currentStreak;

    if (prevDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const lastWon = new Date(prevDate);
        lastWon.setHours(0, 0, 0, 0);
        if (lastWon.getTime() !== today.getTime() && lastWon.getTime() !== yesterday.getTime()) {
            currentStreak = 0;
        }
    }

    return { currentStreak, maxStreak };
}
