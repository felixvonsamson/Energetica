/**
 * Hooks for fetching and managing chats and messages.
 */

import { useQuery, useMutation } from "@tanstack/react-query";
import { chatsApi } from "@/lib/chats-api";
import { queryKeys, queryClient } from "@/lib/query-client";

/**
 * Get the list of all chats for the current user.
 * Includes unread message counts and last opened chat ID.
 */
export function useChatList() {
    return useQuery({
        queryKey: queryKeys.chats.list,
        queryFn: chatsApi.getChatList,
        staleTime: 30 * 1000, // 30 seconds - chats update when messages arrive
        gcTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: true,
    });
}

/**
 * Get all messages in a specific chat.
 */
export function useChatMessages(chatId: number | null) {
    return useQuery({
        queryKey: queryKeys.chats.messages(chatId || 0),
        queryFn: () => chatsApi.getChatMessages(chatId!),
        staleTime: 10 * 1000, // 10 seconds - messages update frequently
        gcTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: true,
        enabled: chatId !== null,
    });
}

/**
 * Send a new message to a chat.
 */
export function useSendMessage() {
    return useMutation({
        mutationFn: ({
            chatId,
            data,
        }: {
            chatId: number;
            data: Parameters<typeof chatsApi.sendMessage>[1];
        }) => chatsApi.sendMessage(chatId, data),
        onSuccess: (_, variables) => {
            // Invalidate the messages for this chat to refresh
            queryClient.invalidateQueries({
                queryKey: queryKeys.chats.messages(variables.chatId),
            });
            // Also invalidate the chat list since unread counts may have changed
            queryClient.invalidateQueries({
                queryKey: queryKeys.chats.list,
            });
        },
    });
}

/**
 * Create a new group chat.
 */
export function useCreateGroupChat() {
    return useMutation<any, any, any>({
        mutationFn: chatsApi.createGroupChat,
        onSuccess: (data) => {
            // Invalidate chat list to show the new chat
            queryClient.invalidateQueries({
                queryKey: queryKeys.chats.list,
            });
        },
    });
}

/**
 * Mark a chat as opened by the current user.
 */
export function useOpenChat() {
    return useMutation({
        mutationFn: (chatId: number) => chatsApi.openChat(chatId),
        onSuccess: (_, chatId) => {
            // Invalidate the chat list to update last opened chat ID
            queryClient.invalidateQueries({
                queryKey: queryKeys.chats.list,
            });
        },
    });
}
