// src/utils/wordgrid/dictionary.ts

import { loadWordLists } from '../../data/words';

// Standard 107 Scrabble 2-letter words
const VALID_2_LETTER_WORDS = new Set([
  'AA', 'AB', 'AD', 'AE', 'AG', 'AH', 'AI', 'AL', 'AM', 'AN', 'AR', 'AS', 'AT', 'AW', 'AX', 'AY',
  'BA', 'BE', 'BI', 'BO', 'BY', 'DE', 'DO', 'ED', 'EF', 'EH', 'EL', 'EM', 'EN', 'ER', 'ES', 'ET',
  'EW', 'FA', 'FE', 'GI', 'GO', 'HA', 'HE', 'HI', 'HM', 'HO', 'ID', 'IF', 'IN', 'IS', 'IT', 'JO',
  'KA', 'KI', 'LA', 'LI', 'LO', 'MA', 'ME', 'MI', 'MM', 'MO', 'MU', 'MY', 'NA', 'NE', 'NO', 'NU',
  'OD', 'OE', 'OF', 'OH', 'OI', 'OK', 'OM', 'ON', 'OP', 'OR', 'OS', 'OT', 'OW', 'OX', 'OY', 'PA',
  'PE', 'PI', 'PO', 'QI', 'RE', 'SH', 'SI', 'SO', 'TA', 'TE', 'TI', 'TO', 'UH', 'UM', 'UN', 'UP',
  'US', 'UT', 'WE', 'WO', 'XI', 'XU', 'YA', 'YE', 'YO', 'ZA'
]);

/**
 * Validates whether a word is in the official dictionary.
 */
export async function validateWordInDictionary(word: string): Promise<boolean> {
  const normalized = word.trim().toUpperCase();
  const len = normalized.length;

  if (len < 2) return false;

  // 1. Two-letter words validation (from hardcoded set)
  if (len === 2) {
    return VALID_2_LETTER_WORDS.has(normalized);
  }

  // 2. Three-to-ten letter words validation (loaded dynamically using IndexedDB & official files)
  if (len >= 3 && len <= 10) {
    try {
      const lists = await loadWordLists(len, false);
      return lists.valid.has(normalized) || lists.official.includes(normalized);
    } catch (e) {
      console.warn(`Failed to load word list for length ${len}, fallback to true`, e);
      return true;
    }
  }

  // 3. Eleven or more letters: Fallback to Free Dictionary API or basic sanity check
  // Since we don't have local lists for 11+, we do a quick check via the public API,
  // or return true if API fails so we don't block players on valid long words.
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${normalized.toLowerCase()}`);
    if (res.status === 200) {
      return true;
    }
    // If the API specifically returned 404, it is definitely not a word.
    if (res.status === 404) {
      return false;
    }
    return true; // Other API errors shouldn't block play
  } catch (e) {
    return true; // Network errors shouldn't block play
  }
}

export interface DictionaryDefinition {
  word: string;
  partOfSpeech?: string;
  definition: string;
}

/**
 * Fetches the definition of a word from the Free Dictionary API.
 */
export async function fetchWordDefinition(word: string): Promise<DictionaryDefinition> {
  const normalized = word.trim().toLowerCase();
  const fallback: DictionaryDefinition = {
    word: word.toUpperCase(),
    definition: 'No definition found.'
  };

  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${normalized}`);
    if (!res.ok) return fallback;

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return fallback;

    const entry = data[0];
    const meanings = entry.meanings;
    if (!Array.isArray(meanings) || meanings.length === 0) return fallback;

    const firstMeaning = meanings[0];
    const partOfSpeech = firstMeaning.partOfSpeech;
    const defs = firstMeaning.definitions;
    if (!Array.isArray(defs) || defs.length === 0) return fallback;

    return {
      word: word.toUpperCase(),
      partOfSpeech: partOfSpeech ? partOfSpeech.toUpperCase() : undefined,
      definition: defs[0].definition
    };
  } catch (e) {
    console.error('Error fetching word definition:', e);
    return fallback;
  }
}
