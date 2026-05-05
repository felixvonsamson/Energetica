/** Chats-related API calls. Handles chat and messaging functionality. */

import { apiClient } from "@/lib/api-client";
import type { ApiResponse, ApiRequestBody } from "@/types/api-helpers";

export const chatsApi = {
    /** Get the list of chats for the current user. */
    getChatList: () =>
        apiClient.get<ApiResponse<"/api/v1/chats", "get">>("/chats"),

    /**
     * Get messages for a chat. Fetches the latest 50, or 50 before `before`
     * message id.
     */
    getChatMessages: (chatId: number, before?: number) =>
        apiClient.get<ApiResponse<"/api/v1/chats/{chat_id}/messages", "get">>(
            `/chats/${chatId}/messages`,
            before !== undefined ? { params: { before } } : undefined,
        ),

    /** Send a new message to a chat. */
    sendMessage: (
        chatId: number,
        data: ApiRequestBody<"/api/v1/chats/{chat_id}/messages", "post">,
    ) =>
        apiClient.post<ApiResponse<"/api/v1/chats/{chat_id}/messages", "post">>(
            `/chats/${chatId}/messages`,
            data,
        ),

    /** Create a new group chat. */
    createGroupChat: (data: ApiRequestBody<"/api/v1/chats", "post">) =>
        apiClient.post<ApiResponse<"/api/v1/chats", "post">>("/chats", data),

    /** Mark a chat as opened by the current user. */
    openChat: (chatId: number) =>
        apiClient.post<ApiResponse<"/api/v1/chats/{chat_id}:open", "post">>(
            `/chats/${chatId}:open`,
        ),

    /** Mute push notifications for a chat. */
    muteChat: (chatId: number) =>
        apiClient.post<ApiResponse<"/api/v1/chats/{chat_id}:mute", "post">>(
            `/chats/${chatId}:mute`,
        ),

    /** Unmute push notifications for a chat. */
    unmuteChat: (chatId: number) =>
        apiClient.post<ApiResponse<"/api/v1/chats/{chat_id}:unmute", "post">>(
            `/chats/${chatId}:unmute`,
        ),
};
