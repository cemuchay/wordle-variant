// -------------------------------------------------------------
// 3. Wordle Pattern Calculator (for Question Type 4)
// -------------------------------------------------------------
export const calculateWordlePattern = (
   target: string,
   guess: string,
): string => {
   const len = target.length;
   const result = new Array(len).fill("⬜");
   const targetUsed = new Array(len).fill(false);
   const guessUsed = new Array(len).fill(false);

   // Green pass
   for (let i = 0; i < len; i++) {
      if (guess[i] === target[i]) {
         result[i] = "🟩";
         targetUsed[i] = true;
         guessUsed[i] = true;
      }
   }

   // Yellow pass
   for (let i = 0; i < len; i++) {
      if (guessUsed[i]) continue;
      for (let j = 0; j < len; j++) {
         if (targetUsed[j]) continue;
         if (guess[i] === target[j]) {
            result[i] = "🟨";
            targetUsed[j] = true;
            break;
         }
      }
   }

   return result.join("");
};
