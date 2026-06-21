import { createSeededRandom, seededShuffle, smartFakeAnswers } from "./utils.ts";

export function generateMathsQuestion(seed: string, entity: any, allEntities: any[], rng: () => number, variant: number): any {
   // Decide if we should do a procedural calculation or use the database entity (if present)
   // We prefer a mix: 50% chance of procedural equation/geometry, 50% chance of DB facts (if available)
   const useDB = entity && (rng() > 0.5);

   if (!useDB || !entity) {
      // Procedural calculation categories
      const subType = Math.floor(rng() * 4); // 0: Arithmetic, 1: Sequences, 2: Algebra, 3: Geometry
      
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
            answer: correct
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
            answer: correct
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
               answer: correct
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
               answer: correct
            };
         }
      }

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
            answer: correct
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
            answer: correct
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
            answer: correct
         };
      }
   }

   // If using DB entity, the parent executor will parse it via standard generateQuestion handler
   return null;
}
