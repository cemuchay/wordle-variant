import { loadScrabbleDictionary, getScrabbleTrie } from './scrabbleTrie';

// Fallback 107 Scrabble 2-letter words if network/trie is initializing
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
 * Validates whether a word is in the official Scrabble dictionary (CSW21 / SOWPODS).
 */
export async function validateWordInDictionary(word: string): Promise<boolean> {
  const normalized = word.trim().toUpperCase();
  const len = normalized.length;

  if (len < 2 || len > 15) return false;

  const trie = getScrabbleTrie() || (await loadScrabbleDictionary());
  return trie.isWord(normalized);
}

/**
 * Synchronous dictionary check (if Trie is already loaded in memory)
 */
export function isWordValidSync(word: string): boolean {
  const normalized = word.trim().toUpperCase();
  const len = normalized.length;
  if (len < 2 || len > 15) return false;

  const trie = getScrabbleTrie();
  if (trie) {
    return trie.isWord(normalized);
  }
  if (len === 2) {
    return VALID_2_LETTER_WORDS.has(normalized);
  }
  return false;
}

/**
 * Fast prefix checker for search pruning in bot algorithms
 */
export function hasWordPrefix(prefix: string): boolean {
  const trie = getScrabbleTrie();
  if (!trie) return true;
  return trie.hasPrefix(prefix);
}

export interface DictionaryDefinition {
  word: string;
  partOfSpeech?: string;
  definition: string;
}

/**
 * Fetches the definition of a word from the Free Dictionary API with Datamuse fallback.
 */
export async function fetchWordDefinition(word: string): Promise<DictionaryDefinition> {
  const normalized = word.trim().toLowerCase();
  const fallback: DictionaryDefinition = {
    word: word.toUpperCase(),
    definition: 'No definition found.'
  };

  // 1. Try Free Dictionary API
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${normalized}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const entry = data[0];
        const meanings = entry.meanings;
        if (Array.isArray(meanings) && meanings.length > 0) {
          const firstMeaning = meanings[0];
          const partOfSpeech = firstMeaning.partOfSpeech;
          const defs = firstMeaning.definitions;
          if (Array.isArray(defs) && defs.length > 0) {
            return {
              word: word.toUpperCase(),
              partOfSpeech: partOfSpeech ? partOfSpeech.toUpperCase() : undefined,
              definition: defs[0].definition
            };
          }
        }
      }
    }
  } catch (e) {
    // CORS or network error on api.dictionaryapi.dev, failover to Datamuse
  }

  // 2. Fallback to Datamuse API (CORS-friendly: always returns Access-Control-Allow-Origin: *)
  try {
    const res = await fetch(`https://api.datamuse.com/words?sp=${normalized}&md=d&max=1`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0 && data[0].defs && data[0].defs.length > 0) {
        const rawDef: string = data[0].defs[0]; // e.g. "n\tA mound, hill, or barrow."
        const parts = rawDef.split('\t');
        if (parts.length >= 2) {
          return {
            word: word.toUpperCase(),
            partOfSpeech: parts[0].toUpperCase(),
            definition: parts[1]
          };
        } else {
          return {
            word: word.toUpperCase(),
            definition: rawDef
          };
        }
      }
    }
  } catch (e) {
    console.error('Error fetching word definition from fallback API:', e);
  }

  return fallback;
}
