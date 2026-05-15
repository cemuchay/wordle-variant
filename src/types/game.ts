export type LetterStatus = "correct" | "present" | "absent" | "empty";

export interface GameConfig {
   word: string;
   length: 3 | 4 | 5 | 6 | 7;
   maxAttempts: number;
}

export interface GameStats {
   gamesPlayed: number;
   gamesWon: number;
   currentStreak: number;
   maxStreak: number;
   guesses: Record<string, number>;
}

export interface GuessResult {
   letter: string;
   status: LetterStatus;
}

interface UserMetadata {
   full_name?: string;
   avatar_url?: string;
}

export interface AppUser {
   id: string;
   user_metadata?: UserMetadata;
}

export interface LeaderboardEntry {
   username: string;
   avatar_url: string;
   total_score: number;
   attempts?: number | "X";
   word_length?: number;
   status?: "lost" | "won" | "playing";
   days_active: number;
   user_id?: string;
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';