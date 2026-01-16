import { useNavigate, useSearch } from "@tanstack/react-router";
import { useRef, useEffect, useCallback, useState } from "react";

import { useSocketEvent } from "@/contexts/socket-context";
import { useChatList, useChatMessages, useOpenChat } from "@/hooks/useChats";
import { useSettings, useUpdateSettings } from "@/hooks/useSettings";

export function useMessagesPage() {
    // Get URL search parameters
    const { selectedChatId, showDisclaimer } = useSearch({
        from: "/app/community/messages",
    });
    const navigate = useNavigate({
        from: "/app/community/messages",
    });

    // Local state for modals
    const [showNewChatModal, setShowNewChatModal] = useState(false);
    const [showGroupChatModal, setShowGroupChatModal] = useState(false);

    const selectedChatIdRef = useRef<number | null>(selectedChatId ?? null);

    const { data: chatListData, isLoading: isChatListLoading } = useChatList();
    const { data: chatMessagesData, isLoading: isChatMessagesLoading } =
        useChatMessages(selectedChatId ?? null);
    const { data: settingsData } = useSettings();
    const { mutate: updateSettings } = useUpdateSettings();
    const { mutate: openChat } = useOpenChat();

    // Keep ref in sync with selected chat ID
    useEffect(() => {
        selectedChatIdRef.current = selectedChatId ?? null;
    }, [selectedChatId]);

    // When a message is received, mark the chat as opened if it's the selected chat
    const handleNewMessage = useCallback(
        (data: {
            time: string;
            player_id: number;
            text: string;
            chat_id: number;
        }) => {
            if (data.chat_id === selectedChatIdRef.current) {
                openChat(data.chat_id);
            }
        },
        [openChat],
    );

    useSocketEvent("display_new_message", handleNewMessage);

    // Auto-select first chat if available and mark it as opened
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

    const selectedChat = chatListData?.chats?.find(
        (chat) => chat.id === selectedChatId,
    );

    // Determine if disclaimer should be shown
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
        showNewChatModal,
        setShowNewChatModal,
        showGroupChatModal,
        setShowGroupChatModal,
        isChatListLoading,
        isChatMessagesLoading,
        chatListData,
        chatMessagesData,
        selectedChat,
        openChat,
    };
}
