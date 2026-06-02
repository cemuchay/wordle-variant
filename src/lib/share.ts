import type { GuessResult } from "../types/game";

/**
 * Generates a formatted text summary of the game result for clipboard sharing.
 * 
 * @what Creates the "Grid" of emojis (🟩🟨⬛) synonymous with Wordle, 
 * along with metadata like the date, word length, and attempt count.
 * 
 * @param params - Game result metadata.
 * @returns A multi-line string formatted for social sharing.
 * 
 * @adjustment Tip: If you switch to light-mode support, consider replacing '⬛' with '⬜'.
 */
/**
 * Obfuscates letter clues in the roast message (characters wrapped in double quotes)
 * by replacing alphabetical characters inside quotes with '░' to prevent giving clues.
 */
export const censorRoast = (message: string): string => {
   if (!message) return "";
   return message.replace(/"([^"]+)"/g, (match, group) => {
      // Avoid censoring non-clue phrases like memes
      if (group.toLowerCase().includes("google")) {
         return match;
      }
      return `"${group.replace(/[a-zA-Z]/g, "░")}"`;
   });
};

/**
 * Generates a formatted text summary of the game result for clipboard sharing.
 * 
 * @what Creates the "Grid" of emojis (🟩🟨⬛) synonymous with Wordle, 
 * along with metadata like the date, word length, and attempt count.
 * 
 * @param params - Game result metadata.
 * @returns A multi-line string formatted for social sharing.
 * 
 * @adjustment Tip: If you switch to light-mode support, consider replacing '⬛' with '⬜'.
 */
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
   
   // Format the date based on the user's system locale (e.g., DD/MM or MM/DD)
   const localDate = new Date(date).toLocaleDateString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
   });
   
   const header = `Variant - ${localDate} \n
  ${score}/${maxAttempts}${` (${wordLength}L)`}${hintMarker}\n`;

   const grid = guesses
      .map((row) => {
         return row
            .map((cell) => {
               if (cell.status === "correct") return "🟩";
               if (cell.status === "present") return "🟨";
               return "⬛"; 
            })
            .join("");
      })
      .join("\n");
   const footer = usedHint ? "\n* assisted by a hint" : "";
   const censoredMessage = gameMessage ? censorRoast(gameMessage) : "";
   return `${header}\n${grid}${footer}\n\n${censoredMessage ? `"${censoredMessage}"` : ""}`;
};
