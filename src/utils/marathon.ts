/* eslint-disable @typescript-eslint/no-explicit-any */
import { deobfuscateWord } from '../lib/game-logic';
import { BOT_MARATHON_WORD_LENGTHS, DEFAULT_WORD_LENGTH } from '../constants/game';

export interface MarathonGame {
    gameIndex: number;
    wordLength: number;
    word: string;
}

/**
 * Parses targetWord to normalize it to an array of MarathonGame.
 * Handles both:
 * 1) legacy dictionary: { "3": "obfuscated1", "4": "..." }
 * 2) dynamic list: [{ "length": 5, "word": "..." }, { "length": 4, "word": "..." }]
 */
export function parseMarathonGames(targetWordField: string | any, salt?: string): MarathonGame[] {
    if (!targetWordField) return [];
    
    // Special case for Daily Bot Marathons
    if (targetWordField === "MARATHON") {
        return [...BOT_MARATHON_WORD_LENGTHS].map((l, idx) => ({
            gameIndex: idx,
            wordLength: l,
            word: '' // Words are fetched async for bot marathons
        }));
    }

    try {
        const parsed = typeof targetWordField === 'string' ? JSON.parse(targetWordField) : targetWordField;
        if (Array.isArray(parsed)) {
            // New array format
            return parsed.map((item: any, idx: number) => {
                const obfuscatedWord = item.word || '';
                const word = salt ? deobfuscateWord(obfuscatedWord, salt) : obfuscatedWord;
                return {
                    gameIndex: idx,
                    wordLength: item.length,
                    word: word
                };
            });
        } else if (parsed && typeof parsed === 'object') {
            // Legacy dictionary format: map keys 3-7 in order
            const lengths = [3, 4, 5, 6, 7];
            const games: MarathonGame[] = [];
            lengths.forEach((l, idx) => {
                const obfuscatedWord = parsed[String(l)] || parsed[l];
                if (obfuscatedWord) {
                    const word = salt ? deobfuscateWord(obfuscatedWord, salt) : obfuscatedWord;
                    games.push({
                        gameIndex: idx,
                        wordLength: l,
                        word: word
                    });
                }
            });
            // If empty or partial, fallback to default 3-7 mapping
            if (games.length === 0) {
                return lengths.map((l, idx) => ({
                    gameIndex: idx,
                    wordLength: l,
                    word: ''
                }));
            }
            return games;
        }
    } catch (e) {
        console.error("Failed to parse marathon target words:", e);
    }
    return [];
}

/**
 * Safely lookup timer by game index or fallback to length-based timer
 */
export function getMarathonTimer(challenge: any, gameIndex: number, wordLength: number): number {
    if (!challenge) return DEFAULT_WORD_LENGTH;
    const timers = challenge.marathon_timers;
    if (!timers) return challenge.max_time || DEFAULT_WORD_LENGTH;

    const defaultTime = challenge.max_time || DEFAULT_WORD_LENGTH;

    if (Array.isArray(timers)) {
        if (timers.length === 0) return defaultTime;
        // Modulo mapping: if sequence is longer than timers provided, wrap around
        // e.g. 21 games with 7 timers -> games 8-14 use timers 0-6
        return timers[gameIndex % timers.length] ?? defaultTime;
    } else if (typeof timers === 'object') {
        const keys = Object.keys(timers).filter(k => !isNaN(Number(k)));
        if (keys.length > 0) {
            const numericKeys = keys.map(Number).sort((a, b) => a - b);
            // If keys are like 0, 1, 2... they are index-based.
            const isIndexBased = numericKeys.some(k => k < 3);

            if (isIndexBased) {
                // Determine cycle length based on provided index keys
                const cycleLength = Math.max(...numericKeys.filter(k => k < 30)) + 1;
                const effectiveIdx = gameIndex % cycleLength;
                
                return timers[String(effectiveIdx)] ?? 
                       timers[effectiveIdx] ?? 
                       timers[String(wordLength)] ?? 
                       timers[wordLength] ?? 
                       defaultTime;
            }
        }

        // Fallback to word length
        return timers[String(wordLength)] ?? 
               timers[wordLength] ?? 
               timers[String(gameIndex)] ?? 
               timers[gameIndex] ?? 
               defaultTime;
    }
    return defaultTime;
}

/**
 * Safely lookup handicap starter(s) by game index or fallback to length-based starter
 */
export function getHandicapStartersList(challenge: any, gameIndex?: number, wordLength?: number): string[] {
    if (!challenge) return [];
    
    // Check if challenge has single-game starter(s)
    if (challenge.handicap_starter) {
        if (Array.isArray(challenge.handicap_starter)) {
            return challenge.handicap_starter.filter(Boolean);
        }
        if (typeof challenge.handicap_starter === 'string') {
            return [challenge.handicap_starter];
        }
    }

    if (!challenge.handicap_starters) {
        return [];
    }

    const starters = challenge.handicap_starters;
    let found: any = null;

    if (Array.isArray(starters)) {
        if (starters.length === 0) return [];
        const idx = (gameIndex ?? 0) % starters.length;
        found = starters[idx];
    } else if (typeof starters === 'object') {
        const keys = Object.keys(starters).filter(k => !isNaN(Number(k)));
        if (keys.length > 0) {
            const numericKeys = keys.map(Number).sort((a, b) => a - b);
            const isIndexBased = numericKeys.some(k => k < 3);

            if (isIndexBased) {
                const cycleLength = Math.max(...numericKeys.filter(k => k < 30)) + 1;
                const effectiveIdx = (gameIndex ?? 0) % cycleLength;
                found = starters[String(effectiveIdx)] ?? 
                        starters[effectiveIdx] ?? 
                        (wordLength !== undefined ? starters[String(wordLength)] : null) ?? 
                        (wordLength !== undefined ? starters[wordLength] : null);
            }
        }

        if (!found && wordLength !== undefined) {
            found = starters[String(wordLength)] ?? 
                    starters[wordLength] ?? 
                    starters[String(gameIndex ?? 0)] ?? 
                    starters[gameIndex ?? 0];
        }
    }

    if (Array.isArray(found)) {
        return found.filter(Boolean);
    }
    if (typeof found === 'string') {
        return [found];
    }
    return [];
}

/**
 * Safely lookup primary handicap starter by game index or fallback to length-based starter
 */
export function getHandicapStarter(challenge: any, gameIndex: number, wordLength: number): string | null {
    const list = getHandicapStartersList(challenge, gameIndex, wordLength);
    return list.length > 0 ? list[0] : null;
}

