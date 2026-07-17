export interface ProfileStats {
   rating: number;
   xp: number;
   games_played: number;
   games_won: number;
   games_lost: number;
   games_tied: number;
   rank_name: string;
   username?: string;
   avatar_url?: string | null;
   id?: string;
}

export type WordUpGameState =
   | "menu"
   | "matchmaking"
   | "countdown"
   | "battle"
   | "gameover";

export interface MatchSubmission {
   question_idx: number;
   correct: boolean;
   time_taken: number;
   points: number;
}

export interface ActivityFeedObj {
   category: string;
   type: string;
   id: string;
   oppName: string;
   myTurn: boolean;
   data: object;
   won: boolean;
   draw: boolean;
   myScore: number;
   oppScore: number;
   rankName: string;
   rating: number;
}
