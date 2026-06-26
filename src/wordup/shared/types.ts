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
}
