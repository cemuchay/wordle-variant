export type NotificationType = 'CHALLENGE_INVITE' | 'CHALLENGE_STARTED' | 'CHALLENGE_COMPLETED' | 'SYSTEM' | 'GENERAL';

export interface AppNotification {
    id: string;
    user_id: string;
    type: NotificationType;
    title: string;
    message: string;
    data: Record<string, any>;
    is_read: boolean;
    created_at: string;
}
