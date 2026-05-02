import type { GuessResult } from "../types/game";

export const generateShareText = ({
   date,
   guesses,
   maxAttempts,
   won,
   usedHint,
   gameMessage,
}: {
   date: string;
   guesses: GuessResult[][];
   maxAttempts: number;
   won: boolean;
   usedHint: boolean;
   gameMessage: string
}) => {
   const score = won ? guesses.length : "X";
   const hintMarker = usedHint ? " 💡" : "";
   const header = `Wordle Variant - ${date} \n
  ${score}/${maxAttempts}${hintMarker}\n`;

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
