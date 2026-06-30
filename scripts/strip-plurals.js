import fs from 'fs';
import path from 'path';

const wordsDir = 'C:\\Users\\cemuc\\Documents\\WEB PROJECTS\\variant\\wordle-variant\\public\\words';
const twlPath = 'C:\\Users\\cemuc\\Documents\\WEB PROJECTS\\variant\\wordle-variant\\twl.txt\\twl.txt';
const lengths = [3, 4, 6, 7, 8, 9, 10];

function stripPlurals() {
  for (const n of lengths) {
    const officialPath = path.join(wordsDir, `words_${n}_official.txt`);
    const outputPath = path.join(wordsDir, `words_${n}_official_stripped.txt`);

    if (!fs.existsSync(officialPath)) {
      console.warn(`Official file not found: ${officialPath}`);
      continue;
    }

    const officialContent = fs.readFileSync(officialPath, 'utf-8');
    const officialWords = officialContent.split(/\r?\n/).map(w => w.trim()).filter(w => w.length > 0);

    let allowedSet = new Set();
    if (n === 3) {
      if (!fs.existsSync(twlPath)) {
        console.warn(`TWL file not found for 2l words: ${twlPath}`);
        continue;
      }
      const twlContent = fs.readFileSync(twlPath, 'utf-8');
      const twoLetterWords = twlContent.split(/\r?\n/)
        .map(w => w.trim().toUpperCase())
        .filter(w => w.length === 2);
      allowedSet = new Set(twoLetterWords);
    } else {
      const allowedPath = path.join(wordsDir, `words_${n - 1}_allowed.txt`);
      const prevOfficialPath = path.join(wordsDir, `words_${n - 1}_official.txt`);
      
      if (fs.existsSync(allowedPath)) {
        const allowedContent = fs.readFileSync(allowedPath, 'utf-8');
        allowedContent.split(/\r?\n/)
          .map(w => w.trim().toUpperCase())
          .filter(w => w.length > 0)
          .forEach(w => allowedSet.add(w));
      } else {
        console.warn(`Allowed file not found: ${allowedPath}`);
      }

      if (fs.existsSync(prevOfficialPath)) {
        const prevOfficialContent = fs.readFileSync(prevOfficialPath, 'utf-8');
        prevOfficialContent.split(/\r?\n/)
          .map(w => w.trim().toUpperCase())
          .filter(w => w.length > 0)
          .forEach(w => allowedSet.add(w));
      } else {
        console.warn(`Previous official file not found: ${prevOfficialPath}`);
      }
    }

    const strippedWords = [];
    let strippedCount = 0;

    for (const word of officialWords) {
      const upperWord = word.toUpperCase();
      if (upperWord.endsWith('S')) {
        const baseWord = upperWord.slice(0, -1);
        if (allowedSet.has(baseWord)) {
          strippedCount++;
          // Log some of them or keep a count
          continue;
        }
      }
      strippedWords.push(word);
    }

    console.log(`${n}l words: Stripped ${strippedCount} plurals. Remaining: ${strippedWords.length} (from ${officialWords.length})`);
    
    // Write out the stripped list, ending with a newline
    fs.writeFileSync(outputPath, strippedWords.join('\n') + '\n', 'utf-8');
  }
}

stripPlurals();
