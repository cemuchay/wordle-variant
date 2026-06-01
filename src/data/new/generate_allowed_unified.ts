import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const TWL_PATH = path.join(__dirname, 'twl.txt', 'twl.txt');
const DATA_DIR = path.join(__dirname, '..');

function generateAllowedUnified() {
  try {
    console.log('Loading TWL dictionary...');
    if (!fs.existsSync(TWL_PATH)) {
      throw new Error(`TWL dictionary not found at: ${TWL_PATH}`);
    }
    const twlRaw = fs.readFileSync(TWL_PATH, 'utf-8');
    const twlWords = twlRaw
      .split(/\r?\n/)
      .map(w => w.trim().toUpperCase())
      .filter(Boolean);

    console.log(`Loaded ${twlWords.length} words from TWL.`);

    // Initialize lists for lengths 3 to 10
    const targetLengths = [3, 4, 5, 6, 7, 8, 9, 10];
    const twlByLength: Record<number, string[]> = {};
    for (const len of targetLengths) {
      twlByLength[len] = [];
    }

    // Categorize TWL words by length
    for (const word of twlWords) {
      const len = word.length;
      if (targetLengths.includes(len)) {
        twlByLength[len].push(word);
      }
    }

    // Process each length
    for (const len of targetLengths) {
      const allowedWordsSet = new Set<string>(twlByLength[len]);

      // 1. Merge with existing allowed list if it exists
      const existingAllowedPath = path.join(DATA_DIR, `words_${len}_allowed.txt`);
      if (fs.existsSync(existingAllowedPath)) {
        const existingRaw = fs.readFileSync(existingAllowedPath, 'utf-8');
        const existingWords = existingRaw
          .split(/\s+/)
          .map(w => w.trim().toUpperCase())
          .filter(Boolean);
        
        console.log(`Length ${len}: Merging with ${existingWords.length} existing allowed words.`);
        for (const w of existingWords) {
          allowedWordsSet.add(w);
        }
      } else {
        console.log(`Length ${len}: No existing allowed list found. Starting fresh from TWL.`);
      }

      // 2. Subtract official answers if they exist (prevents duplication)
      const officialPath = path.join(DATA_DIR, `words_${len}_official.txt`);
      if (fs.existsSync(officialPath)) {
        const officialRaw = fs.readFileSync(officialPath, 'utf-8');
        const officialWords = officialRaw
          .split(/\s+/)
          .map(w => w.trim().toUpperCase())
          .filter(Boolean);

        console.log(`Length ${len}: Subtracting ${officialWords.length} official answers from allowed list.`);
        for (const w of officialWords) {
          allowedWordsSet.delete(w);
        }
      }

      // Sort and write back
      const sortedAllowedList = Array.from(allowedWordsSet).sort();
      fs.writeFileSync(existingAllowedPath, sortedAllowedList.join('\n'), 'utf-8');
      console.log(`Saved ${sortedAllowedList.length} words to words_${len}_allowed.txt\n`);
    }

    console.log('✨ Unified allowed lists generated and updated successfully!');

  } catch (error) {
    console.error('Error generating unified allowed lists:', error);
  }
}

generateAllowedUnified();
