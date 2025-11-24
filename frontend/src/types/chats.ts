/**
 * Type definitions for chat and messaging features.
 * These types correspond to the backend schemas in energetica/schemas/chats.py
 */

/**
 * Represents a chat room (one-on-one or group).
 * Based on ChatOut from the backend.
 */
export interface Chat {
    id: number;
    display_name: string;
    initials: string[];
    is_group: boolean;
    unread_messages_count: number;
    participant_ids: number[];
}

/**
 * Response containing a list of chats for the current user.
 * Based on ChatListOut from the backend.
 */
export interface ChatListResponse {
    chats: Chat[];
    last_opened_chat_id: number;
    unread_chat_count: number;
}

/**
 * Represents a single message in a chat.
 * Based on MessageOut from the backend.
 */
export interface Message {
    id: number;
    text: string;
    player_id: number;
    timestamp: string;
}

/**
 * Response containing a list of messages from a chat.
 * Based on MessageListOut from the backend.
 */
export interface MessageListResponse {
    messages: Message[];
}

/**
 * Request body for sending a new message.
 * Based on MessageCreate from the backend.
 */
export interface SendMessageRequest {
    new_message: string;
}

/**
 * Request body for creating a new group chat.
 * Based on ChatCreate from the backend.
 */
export interface CreateGroupChatRequest {
    group_chat_name: string | null;
    group_member_ids: number[];
}

/**
 * Represents a player in the game (for search/selection in chat creation).
 */
export interface Player {
    id: number;
    username: string;
}
