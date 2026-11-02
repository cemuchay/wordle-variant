import { describe, it, expect } from 'vitest';
import {
    BOT_MARATHON_PRESETS,
    isLagosSunday,
    getNextWeekSpan
} from '../services/dailyBotChallengeService';

describe('dailyBotChallengeService', () => {
    it('provides exactly 10 presets', () => {
        expect(BOT_MARATHON_PRESETS).toHaveLength(10);
    });

    it('ensures each preset has between 4 and 7 games and no sentences', () => {
        for (const preset of BOT_MARATHON_PRESETS) {
            expect(preset.wordLengths.length).toBeGreaterThanOrEqual(4);
            expect(preset.wordLengths.length).toBeLessThanOrEqual(7);
            // Each individual game word length must be between 3 and 7 (standard word sizes, no length 2 sentence codes)
            for (const len of preset.wordLengths) {
                expect(len).toBeGreaterThanOrEqual(3);
                expect(len).toBeLessThanOrEqual(7);
            }
        }
    });

    it('identifies Sunday in Lagos timezone properly', () => {
        // 2026-11-01 is Sunday
        const sundayDate = new Date('2026-11-01T12:00:00Z');
        expect(isLagosSunday(sundayDate)).toBe(true);

        // 2026-11-02 is Monday
        const mondayDate = new Date('2026-11-02T12:00:00Z');
        expect(isLagosSunday(mondayDate)).toBe(false);
    });

    it('computes next week span correctly from Sunday', () => {
        const sundayDate = new Date('2026-11-01T12:00:00Z');
        const { nextMonday, nextSunday } = getNextWeekSpan(sundayDate);

        // next Monday should be 2026-11-02 00:00:00 UTC
        expect(nextMonday.getUTCDay()).toBe(1); // Monday
        expect(nextSunday.getUTCDay()).toBe(0); // Sunday

        // Difference should be 7 days span
        const diffMs = nextSunday.getTime() - nextMonday.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        expect(diffHours).toBeCloseTo(168, 0); // 7 full days
    });
});

