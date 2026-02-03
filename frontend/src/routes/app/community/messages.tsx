/** Messages page - Chat and messaging interface. */

import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle, Users, Shield } from "lucide-react";
import { useState } from "react";

import { ChatDisclaimerDialog } from "@/components/chat/chat-disclaimer-dialog";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { ChatWindow } from "@/components/chat/chat-window";
import { NewChatDialog } from "@/components/chat/new-chat-dialog";
import { NewGroupChatDialog } from "@/components/chat/new-group-chat-dialog";
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
        infoDialog: {
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
        showNewChatDialog,
        setShowNewChatDialog,
        showGroupChatDialog,
        setShowGroupChatDialog,
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
            {/* Disclaimer Dialog */}
            <ChatDisclaimerDialog
                isOpen={showDisclaimer}
                onDismiss={handleDismissDisclaimer}
            />

            {/* New Chat Dialog */}
            <NewChatDialog
                isOpen={showNewChatDialog}
                onClose={() => setShowNewChatDialog(false)}
                onChatSelected={(chatId) => {
                    handleChatSelect(chatId);
                }}
            />

            {/* New Group Chat Dialog */}
            <NewGroupChatDialog
                isOpen={showGroupChatDialog}
                onClose={() => setShowGroupChatDialog(false)}
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
                        onNewChatClick={() => setShowNewChatDialog(true)}
                        onNewGroupChatClick={() => setShowGroupChatDialog(true)}
                    />
                )}

                {/* Chat Window - shown on mobile when a chat is selected */}
                {(showMobileChatView || !isMobile) && (
                    <ChatWindow
                        selectedChat={selectedChat}
                        selectedChatId={selectedChatId}
                        isMessagesLoading={isChatMessagesLoading}
                        messages={chatMessagesData?.messages || []}
                        isDialogOpen={showNewChatDialog || showGroupChatDialog}
                        onBackClick={handleBackToList}
                        showBackButton={showMobileChatView && isMobile}
                    />
                )}
            </div>
        </div>
    );
}
