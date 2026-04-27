import { useQuery, useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { chatsApi } from "@/lib/api/chats";
import { resolveErrorMessage } from "@/lib/game-messages";
import { queryKeys, queryClient } from "@/lib/query-client";
import type {
    CreateChatRequest,
    CreateChatResponse,
    Message,
    OpenChatResponse,
} from "@/types/chats";

export function useChatList() {
    return useQuery({
        queryKey: queryKeys.chats.list,
        queryFn: chatsApi.getChatList,
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: true,
    });
}

/**
 * Manages all message state for a single chat: initial load, paginated history,
 * optimistic sends, and real-time additions from WebSocket events.
 *
 * Uses local state instead of React Query so that loading older pages doesn't
 * blow away already-loaded message history.
 */
export function useChatMessages(chatId: number | null) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [hasMore, setHasMore] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    useEffect(() => {
        if (chatId === null) {
            setMessages([]);
            setHasMore(false);
            return;
        }
        let cancelled = false;
        setIsLoading(true);
        chatsApi
            .getChatMessages(chatId)
            .then((data) => {
                if (!cancelled) {
                    setMessages(data.messages);
                    setHasMore(data.has_more);
                }
            })
            .catch(() => {
                if (!cancelled) toast.error("Failed to load messages");
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [chatId]);

    const loadMore = useCallback(async () => {
        if (!chatId || !hasMore || isLoadingMore || messages.length === 0) return;
        const oldestId = messages[0]?.id;
        if (oldestId === undefined) return;
        setIsLoadingMore(true);
        try {
            const data = await chatsApi.getChatMessages(chatId, oldestId);
            setMessages((prev) => [...data.messages, ...prev]);
            setHasMore(data.has_more);
        } catch {
            toast.error("Failed to load older messages");
        } finally {
            setIsLoadingMore(false);
        }
    }, [chatId, hasMore, isLoadingMore, messages]);

    const addMessage = useCallback((message: Message) => {
        setMessages((prev) => [...prev, message]);
    }, []);

    /** Send a message with optimistic UI. Throws on error so the caller can restore input. */
    const sendMessage = useCallback(
        async (text: string, playerId: number): Promise<void> => {
            if (!chatId) return;
            const tempId = -Date.now();
            setMessages((prev) => [
                ...prev,
                {
                    id: tempId,
                    player_id: playerId,
                    text,
                    timestamp: new Date().toISOString(),
                },
            ]);
            try {
                const realMessage = await chatsApi.sendMessage(chatId, {
                    new_message: text,
                });
                setMessages((prev) =>
                    prev.map((m) => (m.id === tempId ? realMessage : m)),
                );
                queryClient.invalidateQueries({ queryKey: queryKeys.chats.list });
            } catch (err) {
                setMessages((prev) => prev.filter((m) => m.id !== tempId));
                throw err;
            }
        },
        [chatId],
    );

    return { messages, hasMore, isLoading, isLoadingMore, loadMore, addMessage, sendMessage };
}

export function useCreateGroupChat() {
    return useMutation<CreateChatResponse, Error, CreateChatRequest>({
        mutationFn: chatsApi.createGroupChat,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.chats.list });
        },
        onError: (error) => {
            toast.error(resolveErrorMessage(error));
        },
    });
}

export function useOpenChat() {
    return useMutation<OpenChatResponse, Error, number>({
        mutationFn: (chatId: number): Promise<OpenChatResponse> =>
            chatsApi.openChat(chatId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.chats.list });
        },
    });
}

export function useUnreadChatsCount(): number | undefined {
    const { data } = useChatList();
    return data?.unread_chat_count;
}
