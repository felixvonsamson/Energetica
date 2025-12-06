import { useState } from "react";
import { ChatDisclaimerModal } from "./ChatDisclaimerModal";
import { NewChatModal } from "./NewChatModal";
import { NewGroupChatModal } from "./NewGroupChatModal";
import { ChatSidebar } from "./ChatSidebar";
import { ChatWindow } from "./ChatWindow";
import { useMessagesPage } from "@/hooks/useMessagesPage";
import { useIsMobile } from "@/hooks/useIsMobile";

export function MessagesContent() {
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
