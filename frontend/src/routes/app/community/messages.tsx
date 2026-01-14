/** Messages page - Chat and messaging interface. */

import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle, Users, Shield } from "lucide-react";
import { useState } from "react";

import { ChatDisclaimerModal } from "@/components/chat/chat-disclaimer-modal";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { ChatWindow } from "@/components/chat/chat-window";
import { NewChatModal } from "@/components/chat/new-chat-modal";
import { NewGroupChatModal } from "@/components/chat/new-group-chat-modal";
import { GameLayout } from "@/components/layout/game-layout";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useMessagesPage } from "@/hooks/useMessagesPage";

export const Route = createFileRoute("/app/community/messages")({
    component: MessagesPage,
    staticData: {
        title: "Messages",
        routeConfig: {
            requiredRole: "player",
            requiresSettledTile: true,
            isUnlocked: () => true,
        },
        infoModal: {
            contents: <MessagesHelp />,
        },
    },
    validateSearch: (
        search: Record<string, unknown>,
    ): {
        selectedChatId?: number;
        showDisclaimer?: boolean;
    } => ({
        selectedChatId: search.selectedChatId
            ? Number(search.selectedChatId)
            : undefined,
        showDisclaimer:
            search.showDisclaimer === "false" || search.showDisclaimer === false
                ? false
                : undefined,
    }),
});

function MessagesHelp() {
    return (
        <div className="space-y-3">
            <p>
                Send direct messages to other players or create group chats to
                communicate with multiple players at once.
            </p>
            <ul className="list-none space-y-1 ml-4">
                <li className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 shrink-0" />
                    <span>
                        <b>Direct Messages:</b> Start a private conversation
                        with another player
                    </span>
                </li>
                <li className="flex items-center gap-2">
                    <Users className="w-4 h-4 shrink-0" />
                    <span>
                        <b>Group Chats:</b> Create a conversation with multiple
                        players
                    </span>
                </li>
                <li className="flex items-center gap-2">
                    <Shield className="w-4 h-4 shrink-0" />
                    <span>Be respectful when chatting with other players</span>
                </li>
            </ul>
        </div>
    );
}

function MessagesPage() {
    return (
        <GameLayout>
            <MessagesContent />
        </GameLayout>
    );
}

function MessagesContent() {
    const [showMobileChatView, setShowMobileChatView] = useState(false);
    const isMobile = useIsMobile();

    const {
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
    } = useMessagesPage();

    const handleChatSelect = (chatId: number) => {
        setSelectedChatId(chatId);
        openChat(chatId);
        if (isMobile) {
            setShowMobileChatView(true);
        }
    };

    const handleBackToList = () => {
        setShowMobileChatView(false);
    };

    return (
        <div className="p-4 md:p-8 flex flex-col h-full overflow-hidden">
            {/* Disclaimer Modal */}
            <ChatDisclaimerModal
                isOpen={showDisclaimer}
                onDismiss={handleDismissDisclaimer}
            />

            {/* New Chat Modal */}
            <NewChatModal
                isOpen={showNewChatModal}
                onClose={() => setShowNewChatModal(false)}
                onChatSelected={(chatId) => {
                    handleChatSelect(chatId);
                }}
            />

            {/* New Group Chat Modal */}
            <NewGroupChatModal
                isOpen={showGroupChatModal}
                onClose={() => setShowGroupChatModal(false)}
                onChatSelected={(chatId) => {
                    handleChatSelect(chatId);
                }}
            />

            {/* Main Chat Layout */}
            <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0 overflow-hidden">
                {/* Sidebar - hidden on mobile when viewing a chat */}
                {(!showMobileChatView || !isMobile) && (
                    <ChatSidebar
                        isLoading={isChatListLoading}
                        chats={chatListData?.chats || []}
                        selectedChatId={selectedChatId}
                        onChatSelect={handleChatSelect}
                        onNewChatClick={() => setShowNewChatModal(true)}
                        onNewGroupChatClick={() => setShowGroupChatModal(true)}
                    />
                )}

                {/* Chat Window - shown on mobile when a chat is selected */}
                {(showMobileChatView || !isMobile) && (
                    <ChatWindow
                        selectedChat={selectedChat}
                        selectedChatId={selectedChatId}
                        isMessagesLoading={isChatMessagesLoading}
                        messages={chatMessagesData?.messages || []}
                        isModalOpen={showNewChatModal || showGroupChatModal}
                        onBackClick={handleBackToList}
                        showBackButton={showMobileChatView && isMobile}
                    />
                )}
            </div>
        </div>
    );
}
