import fs from 'fs';
import path from 'path';

// Authoritative Scrabble / SOWPODS & CSW sources
const SCRABBLE_SOURCES = [
  'https://raw.githubusercontent.com/jesstess/Scrabble/master/scrabble/sowpods.txt',
  'https://raw.githubusercontent.com/redbo/scrabble/master/dictionary.txt'
];

/**
 * Compact string representation for Trie or nested character tree.
 * Format for maximum JSON compactness:
 * Each key is a letter. If it has children, value is object.
 * If terminal without children, value is 1.
 * If terminal with children, contains '$': 1.
 */
function insertWord(root: any, word: string) {
  let curr = root;
  for (let i = 0; i < word.length; i++) {
    const char = word[i];
    const isEnd = i === word.length - 1;

    if (isEnd) {
      if (!curr[char]) {
        curr[char] = 1;
      } else if (typeof curr[char] === 'object') {
        curr[char]['$'] = 1;
      }
    } else {
      if (!curr[char]) {
        curr[char] = {};
      } else if (curr[char] === 1) {
        curr[char] = { '$': 1 };
      }
      curr = curr[char];
    }
  }
}

async function fetchSources(): Promise<string[]> {
  const allWordSets: string[] = [];
  for (const url of SCRABBLE_SOURCES) {
    try {
      console.log(`Fetching dictionary from ${url}...`);
      const res = await fetch(url);
      if (res.ok) {
        const text = await res.text();
        console.log(`Loaded ${text.length} bytes from ${url}`);
        allWordSets.push(text);
      }
    } catch (e: any) {
      console.warn(`Failed fetching ${url}:`, e.message);
    }
  }
  return allWordSets;
}

async function main() {
  const outputDir = path.resolve(process.cwd(), 'public/words/scrabble');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const rawTexts = await fetchSources();
  const wordSet = new Set<string>();

  for (const text of rawTexts) {
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      const word = line.trim().toUpperCase();
      if (/^[A-Z]{2,15}$/.test(word)) {
        wordSet.add(word);
      }
    }
  }

  console.log(`Total unique Scrabble words compiled: ${wordSet.size}`);

  const root: any = {};
  for (const word of wordSet) {
    insertWord(root, word);
  }

  const trieFilePath = path.join(outputDir, 'csw21_trie.json');
  const jsonString = JSON.stringify(root);
  fs.writeFileSync(trieFilePath, jsonString, 'utf-8');

  const stats = fs.statSync(trieFilePath);
  console.log(`Saved Scrabble Trie to ${trieFilePath} (${(stats.size / 1024 / 1024).toFixed(2)} MB uncompressed)`);
}

main().catch((err) => {
  console.error('Error generating Scrabble dictionary:', err);
  process.exit(1);
});
