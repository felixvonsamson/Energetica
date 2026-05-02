import { ArrowLeft, Bell, BellOff } from "lucide-react";

import { MessageContainer } from "@/components/chat/message-container";
import { MessageInput } from "@/components/chat/message-input";
import { PlayerName } from "@/components/ui/player-name";
import { TypographyH2 } from "@/components/ui/typography";
import { useMuteChat, useUnmuteChat } from "@/hooks/use-chats";
import { useMyId, usePlayerMap } from "@/hooks/use-players";
import type { Message, Chat } from "@/types/chats";

interface ChatWindowProps {
    selectedChat: Chat | undefined;
    selectedChatId: number | null;
    isMessagesLoading: boolean;
    messages: Message[];
    hasMore: boolean;
    isLoadingMore: boolean;
    onLoadMore: () => void;
    onSend: (text: string, playerId: number) => Promise<void>;
    isDialogOpen: boolean;
    onBackClick?: () => void;
    showBackButton?: boolean;
}

export function ChatWindow({
    selectedChat,
    selectedChatId,
    isMessagesLoading,
    messages,
    hasMore,
    isLoadingMore,
    onLoadMore,
    onSend,
    isDialogOpen,
    onBackClick,
    showBackButton,
}: ChatWindowProps) {
    const myId = useMyId();
    const playerMap = usePlayerMap();
    const muteChat = useMuteChat();
    const unmuteChat = useUnmuteChat();

    const otherPlayer =
        selectedChat && !selectedChat.is_group && myId && playerMap
            ? (playerMap[
                  selectedChat.participant_ids.find((id) => id !== myId) ?? -1
              ] ?? null)
            : null;

    const handleMuteToggle = () => {
        if (!selectedChatId || !selectedChat) return;
        if (selectedChat.is_muted) {
            unmuteChat.mutate(selectedChatId);
        } else {
            muteChat.mutate(selectedChatId);
        }
    };

    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex-1 flex flex-col overflow-hidden bg-card rounded-lg text-foreground">
                {/* Chat Header */}
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
                        <TypographyH2 className="text-center flex-1 flex items-center justify-center">
                            {otherPlayer ? (
                                <PlayerName player={otherPlayer} />
                            ) : selectedChat ? (
                                selectedChat.display_name
                            ) : (
                                "Select a chat"
                            )}
                        </TypographyH2>
                        {selectedChat && (
                            <button
                                onClick={handleMuteToggle}
                                disabled={
                                    muteChat.isPending || unmuteChat.isPending
                                }
                                aria-label={
                                    selectedChat.is_muted
                                        ? "Unmute notifications"
                                        : "Mute notifications"
                                }
                                className="shrink-0 p-2 hover:bg-gray-100 dark:hover:bg-muted rounded-lg transition-colors text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {selectedChat.is_muted ? (
                                    <BellOff className="w-5 h-5" />
                                ) : (
                                    <Bell className="w-5 h-5" />
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {/* Scrollable content area */}
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden px-6 pb-6">
                    <MessageContainer
                        isLoading={isMessagesLoading}
                        messages={messages}
                        selectedChatId={selectedChatId}
                        isGroupChat={selectedChat?.is_group ?? false}
                        hasMore={hasMore}
                        isLoadingMore={isLoadingMore}
                        onLoadMore={onLoadMore}
                    />

                    {selectedChatId && (
                        <MessageInput
                            onSend={onSend}
                            isDisabled={!selectedChat}
                            isDialogOpen={isDialogOpen}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
