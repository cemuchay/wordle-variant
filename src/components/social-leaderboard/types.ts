export interface FeedReaction {
  reaction: string;
  user_id: string;
}

export interface FeedComment {
  id: string;
  content: string;
  author_id: string;
  author_username?: string;
  created_at: string;
}

export interface FeedStats {
  accuracyScore?: number;
  gradeTitle?: string;
  roastMessage?: string | null;
}
