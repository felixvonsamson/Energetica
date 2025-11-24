/**
 * Chats-related API calls.
 * Handles chat and messaging functionality.
 */

import { apiClient } from "./api-client";
import type { ApiResponse, ApiRequestBody } from "@/types/api-helpers";

export const chatsApi = {
    /**
     * Get the list of chats for the current user.
     */
    getChatList: () =>
        apiClient.get<ApiResponse<"/api/v1/chats", "get">>("/chats"),

    /**
     * Get all messages in a specific chat.
     */
    getChatMessages: (chatId: number) =>
        apiClient.get<ApiResponse<"/api/v1/chats/{chat_id}/messages", "get">>(
            `/chats/${chatId}/messages`,
        ),

    /**
     * Send a new message to a chat.
     */
    sendMessage: (
        chatId: number,
        data: ApiRequestBody<"/api/v1/chats/{chat_id}/messages", "post">,
    ) =>
        apiClient.post<ApiResponse<"/api/v1/chats/{chat_id}/messages", "post">>(
            `/chats/${chatId}/messages`,
            data,
        ),

    /**
     * Create a new group chat.
     */
    createGroupChat: (data: ApiRequestBody<"/api/v1/chats", "post">) =>
        apiClient.post<ApiResponse<"/api/v1/chats", "post">>("/chats", data),
};
