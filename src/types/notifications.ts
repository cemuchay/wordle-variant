export type NotificationType = 'CHALLENGE_INVITE' | 'CHALLENGE_STARTED' | 'CHALLENGE_COMPLETED' | 'SYSTEM' | 'GENERAL' | 'MARATHON_GAME_COMPLETED' | 'LEADERBOARD_OVERTAKEN' | 'DM_MESSAGE' | 'CHAT_MENTION' | 'NEW_FOLLOWER' | 'NEW_COMMENT' | 'FOLLOWEE_STARTED_PLAYING' | 'FOLLOWEE_FINISHED_PLAYING';

export interface AppNotification {
    id: string;
    user_id: string;
    type: NotificationType;
    title: string;
    message: string;
    data: Record<string, any>;
    is_read: boolean;
    delivered_via_push?: boolean;
    created_at: string;
}
