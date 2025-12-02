import { useState, useRef, useEffect, useCallback } from "react";
import { useChatList, useChatMessages, useOpenChat } from "@/hooks/useChats";
import { useSettings, useUpdateSettings } from "@/hooks/useSettings";
import { useSocketEvent } from "@/contexts/SocketContext";

export function useMessagesPage() {
    const [selectedChatId, setSelectedChatId] = useState<number | null>(null);
    const [showDisclaimer, setShowDisclaimer] = useState(true);
    const [showNewChatModal, setShowNewChatModal] = useState(false);
    const [showGroupChatModal, setShowGroupChatModal] = useState(false);

    const selectedChatIdRef = useRef<number | null>(null);

    const { data: chatListData, isLoading: isChatListLoading } = useChatList();
    const { data: chatMessagesData, isLoading: isChatMessagesLoading } =
        useChatMessages(selectedChatId);
    const { data: settingsData } = useSettings();
    const { mutate: updateSettings } = useUpdateSettings();
    const { mutate: openChat } = useOpenChat();

    // Keep ref in sync with selected chat ID
    useEffect(() => {
        selectedChatIdRef.current = selectedChatId;
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

    // Initialize disclaimer visibility based on settings
    useEffect(() => {
        setShowDisclaimer(settingsData?.show_disclaimer ?? true);
    }, [settingsData]);

    // Auto-select first chat if available and mark it as opened
    useEffect(() => {
        if (
            !selectedChatId &&
            chatListData?.chats &&
            chatListData.chats.length > 0
        ) {
            const firstChatId = chatListData.chats[0].id;
            setSelectedChatId(firstChatId);
            openChat(firstChatId);
        }
    }, [chatListData, openChat]);

    const selectedChat = chatListData?.chats?.find(
        (chat) => chat.id === selectedChatId,
    );

    const handleDismissDisclaimer = () => {
        setShowDisclaimer(false);
        updateSettings({ show_disclaimer: false });
    };

    return {
        selectedChatId,
        setSelectedChatId,
        showDisclaimer,
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
