/* eslint-disable @typescript-eslint/no-explicit-any */
export interface GuessPreviewData {
   guesses: any[] | null;
   hints_used: boolean;
   skill_score: number;
   hint_record: { letter: string; index: number; row?: number } | null;
   time_taken?: number | null;
   game_message?: string | null;
   target_words?: string[];
}

export interface MarathonGame {
   word: string;
   wordLength: number;
   gameIndex: number;
}

export const formatTime = (seconds: number | null | undefined) => {
  if (seconds === null || seconds === undefined) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

export const getTileSizeClass = (length: number) => {
  if (length >= 8) return "w-[22px] h-[22px] text-[8px] rounded-sm";
  if (length >= 6) return "w-6 h-6 text-[9px] rounded-md";
  return "w-7 h-7 text-[10px] rounded-lg";
};
