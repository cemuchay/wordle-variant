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

import { safeLocalStorage } from '../storage';

export interface DictionaryDefinition {
  word: string;
  partOfSpeech?: string;
  definition: string;
  phonetic?: string;
}

/**
 * Fetches the definition and pronunciation of a word using CORS-friendly Datamuse and Wiktionary endpoints.
 * Automatically caches definitions in safeLocalStorage using the game date so old words don't clutter storage.
 */
export async function fetchWordDefinition(word: string, date?: string): Promise<DictionaryDefinition> {
  const normalized = word.trim().toLowerCase();
  if (!normalized) {
    return { word: '', definition: 'A valid English word.' };
  }

  // 1. Check local cache first (keyed by date so it auto-expires or can be purged daily)
  const todayKey = date || new Date().toISOString().split('T')[0];
  const cacheKey = `wordle_def_${todayKey}`;
  try {
    const cached = safeLocalStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.word?.toLowerCase() === normalized && parsed.definition) {
        return parsed;
      }
    }
  } catch (e) {
    // Silent cache read error
  }

  const fallback: DictionaryDefinition = {
    word: word.toUpperCase(),
    definition: 'A valid English word.',
  };

  // 2. Primary: Datamuse API (always has Access-Control-Allow-Origin: *, provides definitions, parts of speech, and IPA / pron)
  try {
    const res = await fetch(`https://api.datamuse.com/words?sp=${normalized}&md=dp&ipa=1&max=1`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const item = data[0];
        let partOfSpeech: string | undefined;
        let definition: string | undefined;
        let phonetic: string | undefined;

        // Extract IPA / pronunciation tag
        if (Array.isArray(item.tags)) {
          for (const tag of item.tags) {
            if (typeof tag === 'string' && tag.startsWith('ipa_pron:')) {
              phonetic = `/${tag.replace('ipa_pron:', '')}/`;
              break;
            } else if (typeof tag === 'string' && tag.startsWith('pron:')) {
              phonetic = `/${tag.replace('pron:', '')}/`;
            }
          }
        }

        // Extract definition
        if (Array.isArray(item.defs) && item.defs.length > 0) {
          const rawDef: string = item.defs[0]; // e.g. "n\tA convex curve or surface." or "adj\tCurved or rounded outward."
          const parts = rawDef.split('\t');
          if (parts.length >= 2) {
            const posMap: Record<string, string> = {
              n: 'NOUN',
              v: 'VERB',
              adj: 'ADJECTIVE',
              adv: 'ADVERB',
              u: 'WORD',
            };
            partOfSpeech = posMap[parts[0].toLowerCase()] || parts[0].toUpperCase();
            definition = parts[1];
          } else {
            definition = rawDef;
          }
        }

        if (definition) {
          const result: DictionaryDefinition = {
            word: word.toUpperCase(),
            partOfSpeech,
            definition,
            phonetic,
          };
          try {
            safeLocalStorage.setItem(cacheKey, JSON.stringify(result));
          } catch {}
          return result;
        }
      }
    }
  } catch (e) {
    console.error('Datamuse API error:', e);
  }

  // 3. Fallback: Wikipedia/Wiktionary REST API (supports CORS)
  try {
    const res = await fetch(`https://en.wiktionary.org/api/rest_v1/page/definition/${normalized}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.en && Array.isArray(data.en) && data.en.length > 0) {
        const firstEntry = data.en[0];
        const partOfSpeech = firstEntry.partOfSpeech ? String(firstEntry.partOfSpeech).toUpperCase() : undefined;
        if (Array.isArray(firstEntry.definitions) && firstEntry.definitions.length > 0) {
          const cleanDef = firstEntry.definitions[0].definition.replace(/<[^>]*>?/gm, '').trim();
          const result: DictionaryDefinition = {
            word: word.toUpperCase(),
            partOfSpeech,
            definition: cleanDef,
          };
          try {
            safeLocalStorage.setItem(cacheKey, JSON.stringify(result));
          } catch {}
          return result;
        }
      }
    }
  } catch (e) {
    console.error('Wiktionary API fallback error:', e);
  }

  return fallback;
}
