/**
 * Hooks for fetching and managing chats and messages.
 *
 * This module demonstrates best practices for React Query hooks:
 *
 * - Proper type extraction from API schemas
 * - Consistent error handling
 * - Automatic cache invalidation
 * - Explicit variable naming (no unused params)
 *
 * All types are imported from @/types/chats to keep chat-related definitions in
 * one place and stay synchronized with the OpenAPI schema.
 */

import { useQuery, useMutation } from "@tanstack/react-query";

import { chatsApi } from "@/lib/api/chats";
import { queryKeys, queryClient } from "@/lib/query-client";
import type {
    ChatMessagesResponse,
    CreateChatRequest,
    CreateChatResponse,
    Message,
    SendMessageRequest,
    OpenChatResponse,
} from "@/types/chats";

/**
 * Get the list of all chats for the current user.
 *
 * Includes unread message counts and last opened chat ID. Updates every 30
 * seconds since new messages arrive via WebSocket but chat metadata changes
 * less frequently.
 *
 * @example
 *     const { data: chats, isLoading, error } = useChatList();
 *     if (chats) {
 *         chats.chats.forEach((chat) => console.log(chat.display_name));
 *     }
 *
 * @returns Query result with typed chat list data
 */
export function useChatList() {
    return useQuery({
        queryKey: queryKeys.chats.list,
        queryFn: chatsApi.getChatList,
        staleTime: 30 * 1000, // 30 seconds - chats update when messages arrive
        gcTime: 5 * 60 * 1000, // 5 minutes - keep for offline access
        refetchOnWindowFocus: true,
    });
}

/**
 * Get all messages in a specific chat.
 *
 * Query is disabled (won't fetch) until a valid chatId is provided. This
 * prevents unnecessary API calls while the user is selecting a chat.
 *
 * @example
 *     const { data: messages } = useChatMessages(selectedChatId);
 *     if (messages) {
 *         console.log(`Got ${messages.messages.length} messages`);
 *     }
 *
 * @param chatId - The ID of the chat to fetch messages for, or null to disable
 * @returns Query result with typed message data
 */
export function useChatMessages(chatId: number | null) {
    return useQuery({
        queryKey: queryKeys.chats.messages(chatId || 0),
        queryFn: () => chatsApi.getChatMessages(chatId!),
        staleTime: 10 * 1000, // 10 seconds - messages update frequently
        gcTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: true,
        enabled: chatId !== null, // Don't fetch if no chat selected
    });
}

/**
 * Send a new message to a chat.
 *
 * Automatically refreshes both the message list for this chat and the chat list
 * (since unread counts may change). The mutation properly types both the
 * request and response.
 *
 * @example
 *     const { mutate: sendMessage, isPending } = useSendMessage();
 *     const handleSend = (text: string) => {
 *         sendMessage({
 *             chatId: 123,
 *             data: { text },
 *         });
 *     };
 *
 * @returns Mutation hook for sending messages
 */
export function useSendMessage() {
    return useMutation({
        mutationFn: ({
            chatId,
            data,
        }: {
            chatId: number;
            data: SendMessageRequest;
            playerId: number;
        }): ReturnType<typeof chatsApi.sendMessage> =>
            chatsApi.sendMessage(chatId, data),
        onMutate: async ({ chatId, data, playerId }) => {
            // Cancel in-flight refetches so they don't overwrite the optimistic update
            await queryClient.cancelQueries({
                queryKey: queryKeys.chats.messages(chatId),
            });

            const previousMessages =
                queryClient.getQueryData<ChatMessagesResponse>(
                    queryKeys.chats.messages(chatId),
                );

            // Optimistic message — negative ID flags it as pending
            const optimisticMessage: Message = {
                id: -Date.now(),
                player_id: playerId,
                text: data.new_message,
                timestamp: new Date().toISOString(),
            };

            queryClient.setQueryData<ChatMessagesResponse>(
                queryKeys.chats.messages(chatId),
                (old) =>
                    old
                        ? {
                              ...old,
                              messages: [...old.messages, optimisticMessage],
                          }
                        : old,
            );

            return { previousMessages };
        },
        onError: (_err, { chatId }, context) => {
            if (context?.previousMessages !== undefined) {
                queryClient.setQueryData(
                    queryKeys.chats.messages(chatId),
                    context.previousMessages,
                );
            }
        },
        onSettled: (_response, _err, { chatId }) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.chats.messages(chatId),
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.chats.list,
            });
        },
    });
}

/**
 * Create a new group chat.
 *
 * Properly typed with the creation request and response types extracted from
 * the API schema. Automatically invalidates the chat list to show the new
 * chat.
 *
 * @example
 *     const { mutate: createChat } = useCreateGroupChat();
 *     const handleCreate = () => {
 *         createChat(
 *             {
 *                 group_chat_name: "Engineering",
 *                 group_member_ids: [1, 2, 3],
 *             },
 *             {
 *                 onSuccess: (newChat) => {
 *                     console.log(`Created chat: ${newChat.id}`);
 *                 },
 *             },
 *         );
 *     };
 *
 * @returns Mutation hook for creating group chats
 */
export function useCreateGroupChat() {
    return useMutation<CreateChatResponse, Error, CreateChatRequest>({
        mutationFn: chatsApi.createGroupChat,
        onSuccess: () => {
            // Invalidate chat list to show the new chat
            queryClient.invalidateQueries({
                queryKey: queryKeys.chats.list,
            });
        },
    });
}

/**
 * Mark a chat as opened by the current user.
 *
 * Updates the "last opened chat" timestamp on the server. Automatically
 * invalidates the chat list to reflect the updated metadata.
 *
 * @example
 *     const { mutate: openChat } = useOpenChat();
 *     openChat(chatId); // Mark as opened
 *
 * @returns Mutation hook for opening chats
 */
export function useOpenChat() {
    return useMutation<OpenChatResponse, Error, number>({
        mutationFn: (chatId: number): Promise<OpenChatResponse> =>
            chatsApi.openChat(chatId),
        onSuccess: () => {
            // Invalidate the chat list to update last opened chat ID
            queryClient.invalidateQueries({
                queryKey: queryKeys.chats.list,
            });
        },
    });
}

export function useUnreadChatsCount(): number | undefined {
    const { data } = useChatList();
    return data?.unread_chat_count;
}
