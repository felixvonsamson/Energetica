/**
 * Type definitions for chat and messaging features.
 *
 * This module provides two categories of types:
 *
 * 1. **OpenAPI Schema Types** - Extracted from backend API schemas using ApiSchema
 * 2. **Derived Types** - Custom interfaces derived from OpenAPI responses
 *
 * All types correspond to backend schemas in energetica/schemas/chats.py
 */

import type { ApiSchema } from "@/types/api-helpers";

// ============================================================================
// OpenAPI Schema Types
// ============================================================================
// These are extracted directly from the OpenAPI spec and always stay in sync
// with the backend. Use these for API responses and requests.

/**
 * Response from GET /api/v1/chats - List of all chats for the current user.
 * Includes unread counts and last opened chat metadata.
 */
export type ChatListResponse = ApiSchema<"ChatListOut">;

/**
 * Response from POST /api/v1/chats - Created chat object after creating a group
 * chat. Contains the new chat's ID and metadata.
 */
export type CreateChatResponse = ApiSchema<"ChatOut">;

/**
 * Request body for POST /api/v1/chats - Create a new group chat. The
 * `group_chat_name` can be null for one-on-one chats.
 */
export type CreateChatRequest = ApiSchema<"ChatCreate">;

/**
 * Response from GET /api/v1/chats/{chat_id}/messages - List of all messages in
 * a chat.
 */
export type ChatMessagesResponse = ApiSchema<"MessageListOut">;

/**
 * Request body for POST /api/v1/chats/{chat_id}/messages - Send a new message
 * to a chat.
 */
export type SendMessageRequest = ApiSchema<"MessageCreate">;

/**
 * Response from POST /api/v1/chats/{chat_id}:open - Mark a chat as opened by
 * current user. Returns the updated chat metadata.
 */
export type OpenChatResponse = ApiSchema<"ChatOut">;

// ============================================================================
// Derived Types
// ============================================================================
// These are extracted from OpenAPI responses for convenience and clarity.
// Keep these when they provide meaningful groupings or when manual docs are needed.

/**
 * Represents a single chat room (one-on-one or group). Extracted from ChatOut
 * for convenient access to individual chat properties.
 */
export type Chat = ApiSchema<"ChatOut">;

/**
 * Represents a single message in a chat. Extracted from MessageOut for
 * convenient access to individual message properties.
 */
export type Message = ApiSchema<"MessageOut">;

/** Represents a player in the game (for search/selection in chat creation). */
export interface Player {
    id: number;
    username: string;
}
