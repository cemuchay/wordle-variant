import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const GOOGLE_WORDS_PATH = path.join(__dirname, 'google-10000-english.txt');
const TWL_PATH = path.join(__dirname, '..', 'twl.txt', 'twl.txt');

function generateOfficialLists() {
  try {
    console.log('Loading TWL dictionary...');
    if (!fs.existsSync(TWL_PATH)) {
      throw new Error(`TWL dictionary not found at: ${TWL_PATH}`);
    }
    const twlRaw = fs.readFileSync(TWL_PATH, 'utf-8');
    const twlWords = new Set(
      twlRaw
        .split(/\r?\n/)
        .map(w => w.trim().toUpperCase())
        .filter(Boolean)
    );
    console.log(`Loaded ${twlWords.size} words from TWL.`);

    console.log('Loading Google 10,000 words...');
    if (!fs.existsSync(GOOGLE_WORDS_PATH)) {
      throw new Error(`Google 10,000 words file not found at: ${GOOGLE_WORDS_PATH}`);
    }
    const googleRaw = fs.readFileSync(GOOGLE_WORDS_PATH, 'utf-8');
    const googleWords = googleRaw
      .split(/\r?\n/)
      .map(w => w.trim().toUpperCase())
      .filter(Boolean);
    console.log(`Loaded ${googleWords.size} words from Google list.`);

    // Initialize lists for lengths 3, 4, 6, 7, 8, 9, 10
    const targetLengths = [3, 4, 6, 7, 8, 9, 10];
    const listsByLength: Record<number, string[]> = {};
    for (const len of targetLengths) {
      listsByLength[len] = [];
    }

    // Rules for official answers
    // Common abbreviations that might be in the Google 10k list but shouldn't be answers
    const strictBannedAnswers = new Set([
      'APP', 'API', 'ABS', 'AMP', 'ATM', 'BYP', 'CEO', 'DOC', 'DIF', 'ERR', 
      'FAX', 'FED', 'GIG', 'GYM', 'KIL', 'LAB', 'MAG', 'MAX', 'MED', 'NAV', 
      'PEK', 'PIC', 'PRO', 'PUB', 'REP', 'SEC', 'SUB', 'TUX', 'VAC', 'VET',
      'ALT', 'DEL', 'SYS', 'EXE', 'URL', 'USB', 'DIY', 'DNA', 'RNA', 'HIV', 
      'UFO', 'VIP', 'FAQ', 'SOS', 'GPS', 'ETA', 'ISO', 'REV', 'TEL', 'UNI', 
      'VAR', 'VOL', 'ORG', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'
    ]);

    for (const word of googleWords) {
      const len = word.length;
      if (!targetLengths.includes(len)) {
        continue;
      }

      // Check if it is a valid TWL word
      if (!twlWords.has(word)) {
        continue; // Keep only valid Scrabble words
      }

      // Rule A: Must contain at least one standard vowel or 'Y'
      const hasVowelOrY = /[AEIOUY]/.test(word);
      if (!hasVowelOrY) {
        continue;
      }

      // Rule B: Filter known abbreviations for 3-letter words
      if (len === 3 && strictBannedAnswers.has(word)) {
        continue;
      }

      // Rule C: Basic phonetic check (no triple identical letters)
      let hasTripleLetter = false;
      for (let i = 0; i < word.length - 2; i++) {
        if (word[i] === word[i+1] && word[i+1] === word[i+2]) {
          hasTripleLetter = true;
          break;
        }
      }
      if (hasTripleLetter) {
        continue;
      }

      listsByLength[len].push(word);
    }

    // Sort alphabetically and write to files
    for (const len of targetLengths) {
      const list = listsByLength[len].sort();
      const outputFilename = `words_${len}_official.txt`;
      const outputPath = path.join(__dirname, outputFilename);
      
      fs.writeFileSync(outputPath, list.join('\n'), 'utf-8');
      console.log(`Saved ${list.length} words to ${outputFilename}`);
    }

    console.log('✨ All official lists generated successfully!');

  } catch (error) {
    console.error('Error generating lists:', error);
  }
}

generateOfficialLists();
