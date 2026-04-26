import { useNavigate, useSearch } from "@tanstack/react-router";
import { useRef, useEffect, useCallback, useState } from "react";

import { useSocketEvent } from "@/contexts/socket-context";
import { useChatList, useChatMessages, useOpenChat } from "@/hooks/use-chats";
import { useAuth } from "@/hooks/use-auth";
import { useSettings, useUpdateSettings } from "@/hooks/use-settings";
import type { Message } from "@/types/chats";

export function useMessagesPage() {
    const { selectedChatId, showDisclaimer } = useSearch({
        from: "/app/community/messages",
    });
    const navigate = useNavigate({
        from: "/app/community/messages",
    });

    const [showNewChatDialog, setShowNewChatDialog] = useState(false);
    const [showGroupChatDialog, setShowGroupChatDialog] = useState(false);

    const selectedChatIdRef = useRef<number | null>(selectedChatId ?? null);

    const { data: chatListData, isLoading: isChatListLoading } = useChatList();
    const {
        messages,
        hasMore,
        isLoading: isChatMessagesLoading,
        isLoadingMore,
        loadMore,
        addMessage,
        sendMessage,
    } = useChatMessages(selectedChatId ?? null);
    const { data: settingsData } = useSettings();
    const { mutate: updateSettings } = useUpdateSettings();
    const { mutate: openChat } = useOpenChat();
    const { user } = useAuth();

    useEffect(() => {
        selectedChatIdRef.current = selectedChatId ?? null;
    }, [selectedChatId]);

    const handleNewMessage = useCallback(
        (data: {
            id: number;
            time: string;
            player_id: number;
            text: string;
            chat_id: number;
        }) => {
            if (data.chat_id === selectedChatIdRef.current) {
                openChat(data.chat_id);
                // Own messages are already handled by the optimistic send flow
                if (data.player_id !== user?.player_id) {
                    addMessage({
                        id: data.id,
                        player_id: data.player_id,
                        text: data.text,
                        timestamp: data.time,
                    } satisfies Message);
                }
            }
        },
        [openChat, addMessage, user?.player_id],
    );

    useSocketEvent("display_new_message", handleNewMessage);

    useEffect(() => {
        if (
            !selectedChatId &&
            chatListData?.chats &&
            chatListData.chats.length > 0
        ) {
            const firstChat = chatListData.chats[0];
            if (firstChat) {
                const firstChatId = firstChat.id;
                navigate({
                    search: { selectedChatId: firstChatId, showDisclaimer },
                });
                openChat(firstChatId);
            }
        }
    }, [chatListData, selectedChatId, showDisclaimer, navigate, openChat]);

    const selectedChat = chatListData?.chats.find(
        (chat) => chat.id === selectedChatId,
    );

    const shouldShowDisclaimer =
        showDisclaimer === false
            ? false
            : (settingsData?.show_disclaimer ?? true);

    const handleDismissDisclaimer = useCallback(() => {
        updateSettings({ show_disclaimer: false });
        navigate({ search: { selectedChatId, showDisclaimer: false } });
    }, [selectedChatId, navigate, updateSettings]);

    return {
        selectedChatId: selectedChatId ?? null,
        setSelectedChatId: (chatId: number | null) => {
            navigate({
                search: {
                    selectedChatId: chatId ?? undefined,
                    showDisclaimer,
                },
            });
        },
        showDisclaimer: shouldShowDisclaimer,
        handleDismissDisclaimer,
        showNewChatDialog,
        setShowNewChatDialog,
        showGroupChatDialog,
        setShowGroupChatDialog,
        isChatListLoading,
        isChatMessagesLoading,
        isLoadingMore,
        chatListData,
        messages,
        hasMore,
        loadMore,
        sendMessage,
        selectedChat,
        openChat,
    };
}
