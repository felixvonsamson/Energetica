import { ArrowLeft } from "lucide-react";

import { MessageContainer } from "./MessageContainer";
import { MessageInput } from "./MessageInput";

import type { Message, Chat } from "@/types/chats";

interface ChatWindowProps {
    selectedChat: Chat | undefined;
    selectedChatId: number | null;
    isMessagesLoading: boolean;
    messages: Message[];
    isModalOpen: boolean;
    onBackClick?: () => void;
    showBackButton?: boolean;
}

export function ChatWindow({
    selectedChat,
    selectedChatId,
    isMessagesLoading,
    messages,
    isModalOpen,
    onBackClick,
    showBackButton,
}: ChatWindowProps) {
    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex-1 flex flex-col overflow-hidden bg-card rounded-lg text-foreground">
                {/* Chat Header - sticky to stay visible when scrolling */}
                <div className="shrink-0 border-b border-border pb-4 mb-4 px-6 pt-6">
                    <div className="flex items-center gap-3">
                        {showBackButton && (
                            <button
                                onClick={onBackClick}
                                aria-label="Back to chat list"
                                className="shrink-0 p-2 hover:bg-gray-100 dark:hover:bg-muted rounded-lg transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                        )}
                        <h2 className="text-2xl font-bold text-center flex-1">
                            {selectedChat
                                ? selectedChat.display_name
                                : "Select a chat"}
                        </h2>
                    </div>
                </div>

                {/* Scrollable content area */}
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden px-6 pb-6">
                    {/* Messages Container */}
                    <MessageContainer
                        isLoading={isMessagesLoading}
                        messages={messages}
                        selectedChatId={selectedChatId}
                        isGroupChat={selectedChat?.is_group ?? false}
                    />

                    {/* Message Input - stays at bottom */}
                    {selectedChatId && (
                        <MessageInput
                            chatId={selectedChatId}
                            isDisabled={!selectedChat}
                            isModalOpen={isModalOpen}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
