import { describe, it, expect } from 'vitest';
import { ScrabbleTrie } from '../utils/wordgrid/scrabbleTrie';
import { validateWordInDictionary, isWordValidSync, hasWordPrefix } from '../utils/wordgrid/dictionary';
import fs from 'fs';
import path from 'path';

describe('Scrabble Trie & WordGrid Dictionary', () => {
  it('correctly identifies valid Scrabble words and rejects non-words in ScrabbleTrie', () => {
    // Read the compiled trie JSON for direct structure test
    const triePath = path.resolve(process.cwd(), 'public/words/scrabble/csw21_trie.json');
    const rawTrie = JSON.parse(fs.readFileSync(triePath, 'utf-8'));
    const trie = new ScrabbleTrie(rawTrie);

    // 2-letter words
    expect(trie.isWord('QI')).toBe(true);
    expect(trie.isWord('ZA')).toBe(true);
    expect(trie.isWord('AA')).toBe(true);
    expect(trie.isWord('XY')).toBe(false);

    // Common Scrabble words
    expect(trie.isWord('SCRABBLE')).toBe(true);
    expect(trie.isWord('QUARTZ')).toBe(true);
    expect(trie.isWord('COLOR')).toBe(true);
    expect(trie.isWord('COLOUR')).toBe(true);
    expect(trie.isWord('OXYPHENBUTAZONE')).toBe(true); // 15-letter famous scrabble word

    // Invalid / gibberish words
    expect(trie.isWord('ZZZZZZ')).toBe(false);
    expect(trie.isWord('AB12')).toBe(false);
    expect(trie.isWord('NOTAREALWORDXYZ')).toBe(false);

    // Prefix checking
    expect(trie.hasPrefix('SCRABB')).toBe(true);
    expect(trie.hasPrefix('QUAR')).toBe(true);
    expect(trie.hasPrefix('ZZZZ')).toBe(false);
  });

  it('validates words via validateWordInDictionary', async () => {
    const valid = await validateWordInDictionary('QUIZ');
    expect(valid).toBe(true);

    const invalid = await validateWordInDictionary('XYZWVP');
    expect(invalid).toBe(false);
  });
});
