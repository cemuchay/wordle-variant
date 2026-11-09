export interface PollOption {
   id: string;
   text: string;
}

export interface PollVote {
   id: string;
   poll_id: string;
   user_id: string;
   option_id: string;
   created_at: string;
   updated_at?: string;
   profiles?: {
      id: string;
      username: string;
      avatar_url: string;
   } | null;
}

export interface Poll {
   id: string;
   group_id: string;
   creator_id: string;
   question: string;
   options: PollOption[];
   allow_change_vote: boolean;
   is_anonymous: boolean;
   is_admin_poll: boolean;
   is_pinned: boolean;
   pinned_at?: string | null;
   expires_at: string;
   created_at: string;
   profiles?: {
      id: string;
      username: string;
      avatar_url: string;
   } | null;
}

export interface CreatePollInput {
   groupId: string;
   creatorId: string;
   question: string;
   options: string[];
   durationHours: number; // max 168 (7 days)
   allowChangeVote: boolean;
   isAnonymous: boolean;
   isAdminPoll: boolean;
   isPinned: boolean;
}

export interface PollOptionResult {
   option: PollOption;
   count: number;
   percentage: number;
   voters: {
      id: string;
      username: string;
      avatar_url: string;
   }[];
}

export interface PollWithResults {
   poll: Poll;
   votes: PollVote[];
   totalVotes: number;
   userVoteOptionId: string | null;
   isExpired: boolean;
   optionResults: PollOptionResult[];
}

export const GENERAL_GROUP_ID = "00000000-0000-0000-0000-000000000001";
export const MAX_POLL_DURATION_HOURS = 168; // 7 days
export const MIN_POLL_OPTIONS = 2;
export const MAX_POLL_OPTIONS = 6;

export const formatDurationLabel = (hours: number): string => {
   if (hours >= 24 && hours % 24 === 0) {
      const days = hours / 24;
      return `${days} ${days === 1 ? "Day" : "Days"}`;
   }
   return `${hours} ${hours === 1 ? "Hour" : "Hours"}`;
};
