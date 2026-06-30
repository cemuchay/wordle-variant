import fs from 'fs';
import path from 'path';

const wordsDir = 'C:\\Users\\cemuc\\Documents\\WEB PROJECTS\\variant\\wordle-variant\\public\\words';
const twlPath = 'C:\\Users\\cemuc\\Documents\\WEB PROJECTS\\variant\\wordle-variant\\twl.txt\\twl.txt';
const lengths = [3, 4, 6, 7, 8, 9, 10];

function buildGlobalWordSet() {
  const globalWordSet = new Set();

  // Load 2-letter words from Scrabble list
  if (fs.existsSync(twlPath)) {
    const twlContent = fs.readFileSync(twlPath, 'utf-8');
    twlContent.split(/\r?\n/)
      .map(w => w.trim().toUpperCase())
      .filter(w => w.length === 2)
      .forEach(w => globalWordSet.add(w));
  } else {
    console.warn(`TWL file not found for 2l words: ${twlPath}`);
  }

  // Load words of length 3 to 10 from allowed and official files
  for (let len = 3; len <= 10; len++) {
    const allowedPath = path.join(wordsDir, `words_${len}_allowed.txt`);
    const officialPath = path.join(wordsDir, `words_${len}_official.txt`);

    if (fs.existsSync(allowedPath)) {
      const content = fs.readFileSync(allowedPath, 'utf-8');
      content.split(/\r?\n/)
        .map(w => w.trim().toUpperCase())
        .filter(w => w.length > 0)
        .forEach(w => globalWordSet.add(w));
    }

    if (fs.existsSync(officialPath)) {
      const content = fs.readFileSync(officialPath, 'utf-8');
      content.split(/\r?\n/)
        .map(w => w.trim().toUpperCase())
        .filter(w => w.length > 0)
        .forEach(w => globalWordSet.add(w));
    }
  }

  console.log(`Global word list loaded with ${globalWordSet.size} unique words.`);
  return globalWordSet;
}

function stripPlurals() {
  const globalWordSet = buildGlobalWordSet();

  for (const n of lengths) {
    const officialPath = path.join(wordsDir, `words_${n}_official.txt`);
    const outputPath = path.join(wordsDir, `words_${n}_official_stripped.txt`);

    if (!fs.existsSync(officialPath)) {
      console.warn(`Official file not found: ${officialPath}`);
      continue;
    }

    const officialContent = fs.readFileSync(officialPath, 'utf-8');
    const officialWords = officialContent.split(/\r?\n/).map(w => w.trim()).filter(w => w.length > 0);

    const strippedWords = [];
    let strippedCount = 0;

    for (const word of officialWords) {
      const upperWord = word.toUpperCase();
      let isPlural = false;

      // 1. Simple ending in S: base is N-1 (e.g. CATS -> CAT)
      if (upperWord.endsWith('S')) {
        const baseWord = upperWord.slice(0, -1);
        if (globalWordSet.has(baseWord)) {
          isPlural = true;
        }
      }

      // 2. Ending in IES: base is N-2 with 'Y' (e.g. BABIES -> BABY)
      if (!isPlural && upperWord.endsWith('IES') && upperWord.length >= 4) {
        const baseWord = upperWord.slice(0, -3) + 'Y';
        if (globalWordSet.has(baseWord)) {
          isPlural = true;
        }
      }

      // 3. Ending in ES (but not IES): base is N-2 (e.g. FOXES -> FOX, HEROES -> HERO, DISHES -> DISH)
      if (!isPlural && upperWord.endsWith('ES') && !upperWord.endsWith('IES') && upperWord.length >= 4) {
        const baseWord = upperWord.slice(0, -2);
        if (globalWordSet.has(baseWord)) {
          isPlural = true;
        }
      }

      // 4. Ending in VES: base is N-1 with 'FE' (e.g. WIVES -> WIFE) or N-2 with 'F' (e.g. THIEVES -> THIEF)
      if (!isPlural && upperWord.endsWith('VES') && upperWord.length >= 4) {
        const baseFE = upperWord.slice(0, -3) + 'FE';
        const baseF = upperWord.slice(0, -3) + 'F';
        if (globalWordSet.has(baseFE) || globalWordSet.has(baseF)) {
          isPlural = true;
        }
      }

      if (isPlural) {
        strippedCount++;
        continue;
      }
      
      strippedWords.push(word);
    }

    console.log(`${n}l words: Stripped ${strippedCount} plurals. Remaining: ${strippedWords.length} (from ${officialWords.length})`);
    
    // Write out the stripped list, ending with a newline
    fs.writeFileSync(outputPath, strippedWords.join('\n') + '\n', 'utf-8');
  }
}

stripPlurals();
