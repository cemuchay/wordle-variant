import { seededShuffle, smartFakeAnswers } from "./utils.ts";

export function generateMathsQuestion(
   seed: string,
   entity: any,
   allEntities: any[],
   rng: () => number,
   variant: number,
   proceduralWeight: number = 0.5,
): any {
   const useDB = entity && (rng() > proceduralWeight);

   if (!useDB || !entity) {
      // Procedural calculation categories
      // 0: Arithmetic, 1: Sequences, 2: Algebra, 3: Geometry
      // 4: Percentages, 5: Exponents/Roots, 6: Probability, 7: Ratios, 8: Fractions
      const subType = Math.floor(rng() * 9); 

      if (subType === 0) {
         // Mental Math Arithmetic
         const opIdx = Math.floor(rng() * 4);
         let a: number, b: number, ans: number;
         const ops = ["+", "-", "x", "/"];
         if (opIdx === 0) { a = Math.floor(rng() * 90) + 10; b = Math.floor(rng() * 90) + 10; ans = a + b; }
         else if (opIdx === 1) { a = Math.floor(rng() * 80) + 20; b = Math.floor(rng() * (a - 10)) + 10; ans = a - b; }
         else if (opIdx === 2) { a = Math.floor(rng() * 12) + 2; b = Math.floor(rng() * 12) + 2; ans = a * b; }
         else { b = Math.floor(rng() * 10) + 2; ans = Math.floor(rng() * 15) + 2; a = b * ans; }
         
         const correct = String(ans);
         const fakes = smartFakeAnswers(ans, rng).map(String);
         return {
            type: "math_calculation",
            prompt: `Calculate: ${a} ${ops[opIdx]} ${b} = ?`,
            choices: seededShuffle([...new Set([correct, ...fakes])].slice(0, 4), rng),
            answer: correct,
            explanation: `${a} ${ops[opIdx]} ${b} = ${correct}.`,
         };
      }

      if (subType === 1) {
         // Number Sequences
         const patternIdx = Math.floor(rng() * 6);
         let seq: number[], ans: number;
         if (patternIdx === 0) { const s = Math.floor(rng() * 10) + 1; seq = [s, s + 2, s + 4, s + 6]; ans = s + 8; }
         else if (patternIdx === 1) { const s = Math.floor(rng() * 5) + 1; seq = [s, s * 2, s * 4, s * 8]; ans = s * 16; }
         else if (patternIdx === 2) { const s = Math.floor(rng() * 5) + 1; seq = [s, s + 3, s + 6, s + 9]; ans = s + 12; }
         else if (patternIdx === 3) { const s = Math.floor(rng() * 5) + 1; seq = Array.from({ length: 4 }, (_, i) => (s + i) ** 2); ans = (s + 4) ** 2; }
         else if (patternIdx === 4) { const s = Math.floor(rng() * 30) + 30; seq = [s, s - 5, s - 10, s - 15]; ans = s - 20; }
         else { const s = Math.floor(rng() * 5) + 1; seq = [s, s + 1, s + 3, s + 6]; ans = s + 10; }
         
         const correct = String(ans);
         const fakes = smartFakeAnswers(ans, rng).map(String);
         return {
            type: "math_sequence",
            prompt: `Find the next number in the sequence: ${seq.join(", ")}, ?`,
            choices: seededShuffle([...new Set([correct, ...fakes])].slice(0, 4), rng),
            answer: correct,
            explanation: `The next number in the sequence is ${correct}.`,
         };
      }

      if (subType === 2) {
         // Algebra Solver
         const algIdx = Math.floor(rng() * 2);
         if (algIdx === 0) {
            const a = Math.floor(rng() * 8) + 2; 
            const x = Math.floor(rng() * 21) - 5; 
            const b = Math.floor(rng() * 30) - 15; 
            const c = a * x + b;
            const correct = String(x);
            const fakes = smartFakeAnswers(x, rng).map(String);
            const equationStr = `${a}x ${b >= 0 ? "+ " + b : "- " + Math.abs(b)} = ${c}`;
            return {
               type: "math_algebra",
               prompt: `Solve for x: ${equationStr}`,
               choices: seededShuffle([...new Set([correct, ...fakes])].slice(0, 4), rng),
               answer: correct,
               explanation: `Solving ${equationStr}: x = ${correct}.`,
            };
         } else {
            const x = Math.floor(rng() * 12) + 2; 
            const y = Math.floor(rng() * 10) + 1; 
            const s = x + y;
            const d = x - y;
            const correct = String(x);
            const fakes = smartFakeAnswers(x, rng).map(String);
            return {
               type: "math_algebra",
               prompt: `If x + y = ${s} and x - y = ${d}, what is the value of x?`,
               choices: seededShuffle([...new Set([correct, ...fakes])].slice(0, 4), rng),
               answer: correct,
               explanation: `Adding the two equations: 2x = ${s + d}, so x = ${correct}.`,
            };
         }
      }

      if (subType === 3) {
         // Geometry Puzzles
         const geomIdx = Math.floor(rng() * 3);
         if (geomIdx === 0) {
            const b = (Math.floor(rng() * 7) + 2) * 2; 
            const h = Math.floor(rng() * 10) + 3; 
            const area = 0.5 * b * h;
            const correct = String(area);
            const fakes = smartFakeAnswers(area, rng).map(String);
            return {
               type: "math_geometry",
               prompt: `Find the area of a right triangle with a base of ${b} and a height of ${h}:`,
               choices: seededShuffle([...new Set([correct, ...fakes])].slice(0, 4), rng),
               answer: correct,
               explanation: `Area = ½ × base × height = ½ × ${b} × ${h} = ${correct}.`,
            };
         } else if (geomIdx === 1) {
            const w = Math.floor(rng() * 10) + 4; 
            const h = Math.floor(rng() * 10) + 4; 
            const perimeter = 2 * (w + h);
            const correct = String(perimeter);
            const fakes = smartFakeAnswers(perimeter, rng).map(String);
            return {
               type: "math_geometry",
               prompt: `What is the perimeter of a rectangle with width ${w} and height ${h}?`,
               choices: seededShuffle([...new Set([correct, ...fakes])].slice(0, 4), rng),
               answer: correct,
               explanation: `Perimeter = 2 × (width + height) = 2 × (${w} + ${h}) = ${correct}.`,
            };
         } else {
            const angle = Math.floor(rng() * 100) + 40; 
            const missing = 180 - angle;
            const correct = String(missing);
            const fakes = smartFakeAnswers(missing, rng).map(String);
            return {
               type: "math_geometry",
               prompt: `If two angles are supplementary and one is ${angle}°, find the missing angle:`,
               choices: seededShuffle([...new Set([correct, ...fakes])].slice(0, 4), rng),
               answer: correct,
               explanation: `Supplementary angles add up to 180°. Missing angle = 180° − ${angle}° = ${correct}°.`,
            };
         }
      }

      if (subType === 4) {
         // Percentages
         const isDiscount = rng() > 0.5;
         if (isDiscount) {
            const original = (Math.floor(rng() * 10) + 2) * 10; // $20 to $110
            const discounts = [10, 20, 25, 30, 40, 50];
            const pct = discounts[Math.floor(rng() * discounts.length)];
            const salePrice = original - (original * pct) / 100;
            const correct = String(salePrice);
            const fakes = smartFakeAnswers(salePrice, rng).map(String);
            return {
               type: "math_percentage",
               prompt: `A shirt costs $${original} and is discounted by ${pct}%. What is its sale price?`,
               choices: seededShuffle([...new Set([correct, ...fakes])].slice(0, 4), rng),
               answer: correct,
               explanation: `${pct}% of $${original} is $${(original * pct) / 100}. Sale price = $${original} - $${(original * pct) / 100} = $${correct}.`,
            };
         } else {
            const pct = (Math.floor(rng() * 8) + 1) * 10; // 10% to 80%
            const val = (Math.floor(rng() * 15) + 4) * 10; // 40 to 180
            const result = (pct * val) / 100;
            const correct = String(result);
            const fakes = smartFakeAnswers(result, rng).map(String);
            return {
               type: "math_percentage",
               prompt: `What is ${pct}% of ${val}?`,
               choices: seededShuffle([...new Set([correct, ...fakes])].slice(0, 4), rng),
               answer: correct,
               explanation: `${pct}% of ${val} = (${pct} / 100) × ${val} = ${correct}.`,
            };
         }
      }

      if (subType === 5) {
         // Exponents & Roots
         const isPower = rng() > 0.5;
         if (isPower) {
            const base = Math.floor(rng() * 4) + 2; // 2 to 5
            const exp = base === 2 ? Math.floor(rng() * 4) + 3 : base === 3 ? 3 : 2; // 2^3..6, 3^3, 5^2, etc.
            const val = Math.pow(base, exp);
            const correct = String(val);
            const fakes = smartFakeAnswers(val, rng).map(String);
            return {
               type: "math_exponents",
               prompt: `What is ${base} to the power of ${exp} (${base}^${exp})?`,
               choices: seededShuffle([...new Set([correct, ...fakes])].slice(0, 4), rng),
               answer: correct,
               explanation: `${base}^${exp} = ${Array(exp).fill(base).join(" × ")} = ${correct}.`,
            };
         } else {
            const numbers = [4, 9, 16, 25, 36, 49, 64, 81, 100, 121, 144];
            const val = numbers[Math.floor(rng() * numbers.length)];
            const root = Math.sqrt(val);
            const correct = String(root);
            const fakes = smartFakeAnswers(root, rng).map(String);
            return {
               type: "math_exponents",
               prompt: `What is the square root of ${val} (√${val})?`,
               choices: seededShuffle([...new Set([correct, ...fakes])].slice(0, 4), rng),
               answer: correct,
               explanation: `√${val} = ${correct} because ${correct} × ${correct} = ${val}.`,
            };
         }
      }

      if (subType === 6) {
         // Probability
         const probType = Math.floor(rng() * 2);
         if (probType === 0) {
            // Dice roll
            const diceScenarios = [
               { p: "rolling an even number", c: "1/2", f: ["1/3", "2/3", "1/6"] },
               { p: "rolling a number greater than 4", c: "1/3", f: ["1/2", "2/3", "1/6"] },
               { p: "rolling a 3 or 5", c: "1/3", f: ["1/2", "1/6", "5/6"] },
               { p: "rolling a number less than 3", c: "1/3", f: ["1/2", "2/3", "1/6"] },
            ];
            const choice = diceScenarios[Math.floor(rng() * diceScenarios.length)];
            return {
               type: "math_probability",
               prompt: `A fair six-sided die is rolled. What is the probability of ${choice.p}?`,
               choices: seededShuffle([choice.c, ...choice.f], rng),
               answer: choice.c,
               explanation: `There are 6 total outcomes. The successful outcomes yield a probability of ${choice.c}.`,
            };
         } else {
            // Card draw
            const cardScenarios = [
               { p: "drawing a spade", c: "1/4", f: ["1/2", "1/13", "3/13"] },
               { p: "drawing an Ace", c: "1/13", f: ["1/4", "3/13", "4/13"] },
               { p: "drawing a face card (Jack, Queen, King)", c: "3/13", f: ["1/4", "1/13", "4/13"] },
            ];
            const choice = cardScenarios[Math.floor(rng() * cardScenarios.length)];
            return {
               type: "math_probability",
               prompt: `A card is drawn at random from a standard 52-card deck. What is the probability of ${choice.p}?`,
               choices: seededShuffle([choice.c, ...choice.f], rng),
               answer: choice.c,
               explanation: `Out of 52 cards, the subset matching the condition simplifies to a probability of ${choice.c}.`,
            };
         }
      }

      if (subType === 7) {
         // Ratios
         const ratioPairs = [
            { a: 2, b: 3 },
            { a: 3, b: 4 },
            { a: 3, b: 5 },
            { a: 4, b: 5 },
         ];
         const pair = ratioPairs[Math.floor(rng() * ratioPairs.length)];
         const factor = Math.floor(rng() * 8) + 3; // 3 to 10
         const aVal = pair.a * factor;
         const bVal = pair.b * factor;

         const correct = String(bVal);
         const fakes = smartFakeAnswers(bVal, rng).map(String);

         return {
            type: "math_ratio",
            prompt: `The ratio of boys to girls in a class is ${pair.a}:${pair.b}. If there are ${aVal} boys, how many girls are there?`,
            choices: seededShuffle([...new Set([correct, ...fakes])].slice(0, 4), rng),
            answer: correct,
            explanation: `The boys count is scaled by a factor of ${factor} (${pair.a} × ${factor} = ${aVal}). Scale the girls by the same factor: ${pair.b} × ${factor} = ${correct}.`,
         };
      }

      // Fractions (subType === 8)
      const baseFractions = [
         { n: 2, d: 3, str: "2/3" },
         { n: 3, d: 4, str: "3/4" },
         { n: 4, d: 5, str: "4/5" },
         { n: 3, d: 5, str: "3/5" },
         { n: 5, d: 6, str: "5/6" },
      ];
      const frac = baseFractions[Math.floor(rng() * baseFractions.length)];
      const multiplier = Math.floor(rng() * 5) + 2; // 2 to 6
      const qNum = frac.n * multiplier;
      const qDen = frac.d * multiplier;

      const correct = frac.str;
      const fakes = baseFractions.filter(f => f.str !== correct).map(f => f.str);

      return {
         type: "math_fraction",
         prompt: `Simplify the fraction ${qNum}/${qDen} to its lowest terms:`,
         choices: seededShuffle([correct, ...fakes].slice(0, 4), rng),
         answer: correct,
         explanation: `Dividing both the numerator and the denominator by their greatest common divisor (${multiplier}) gives ${correct}.`,
      };
   }

   // If using DB entity, the parent executor will parse it via standard generateQuestion handler
   return null;
}
