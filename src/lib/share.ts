import type { GuessResult } from "../types/game";

export const generateShareText = ({
   date,
   guesses,
   maxAttempts,
   won,
   usedHint,
   gameMessage,
   wordLength,
}: {
   date: string;
   guesses: GuessResult[][];
   maxAttempts: number;
   won: boolean;
   usedHint: boolean;
   gameMessage: string;
   wordLength: number;
}) => {
   const score = won ? guesses.length : "X";
   const hintMarker = usedHint ? " 💡" : "";
   const localDate = new Date(date).toLocaleDateString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
   });
   const header = `Wordle Variant - ${localDate} \n
  ${score}/${maxAttempts}${` (${wordLength}L)`}${hintMarker}\n`;

   const grid = guesses
      .map((row) => {
         return row
            .map((cell) => {
               if (cell.status === "correct") return "🟩";
               if (cell.status === "present") return "🟨";
               return "⬛"; // Use '⬜' if you prefer light mode friendly
            })
            .join("");
      })
      .join("\n");
   const footer = usedHint ? "\n* assisted by a hint" : "";
   return `${header}\n${grid}${footer}\n\n"${gameMessage}"`;
};
