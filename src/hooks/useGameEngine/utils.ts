import { safeLocalStorage } from "../../utils/storage";

export const getLocalSalt = (date: string, userId: string | undefined) => {
   const base = `local_salt_${date}_${userId || "guest"}`;
   let hash = 0;
   for (let i = 0; i < base.length; i++) {
      hash = (hash << 5) - hash + base.charCodeAt(i);
      hash |= 0;
   }
   return Math.abs(hash).toString(16);
};

export const saveGameWithBackup = (date: string, payload: unknown) => {
   const serialized = JSON.stringify(payload);
   safeLocalStorage.setItem(`wordle-${date}`, serialized);
   safeLocalStorage.setItem(`wordle-${date}-backup`, serialized);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const areGuessesCoherent = (localGuesses: any[], dbGuesses: any[]) => {
   if (!Array.isArray(localGuesses) || !Array.isArray(dbGuesses)) return false;
   const minLength = Math.min(localGuesses.length, dbGuesses.length);
   for (let i = 0; i < minLength; i++) {
      const localWord = localGuesses[i]
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         .map((c: any) => c.letter)
         .join("")
         .toUpperCase();
      const dbWord = dbGuesses[i]
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         .map((c: any) => c.letter)
         .join("")
         .toUpperCase();
      if (localWord !== dbWord) {
         return false;
      }
   }
   return true;
};
