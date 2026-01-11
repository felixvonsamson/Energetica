import { useEffect, useRef } from "react";

import { useAuth } from "@/hooks/useAuth";
import { usePlayerMap } from "@/hooks/usePlayers";
import { cn } from "@/lib/classname-utils";
import { formatTimestamp } from "@/lib/format-utils";
import type { Message } from "@/types/chats";

interface MessageContainerProps {
    isLoading: boolean;
    messages: Message[];
    selectedChatId: number | null;
    isGroupChat: boolean;
}

interface MessageGroup {
    playerId: number;
    messages: Message[];
    showTimestamp: boolean;
}

export function MessageContainer({
    isLoading,
    messages,
    selectedChatId,
    isGroupChat,
}: MessageContainerProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const playerMap = usePlayerMap();
    const { user } = useAuth();

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Group messages by sender and time proximity (5 minutes threshold)
    const groupMessages = (messages: Message[]): MessageGroup[] => {
        const groups: MessageGroup[] = [];
        const TIME_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

        for (let i = 0; i < messages.length; i++) {
            const currentMessage = messages[i];
            const previousMessage = i > 0 ? messages[i - 1] : null;

            const shouldStartNewGroup =
                !previousMessage ||
                previousMessage.player_id !== currentMessage.player_id ||
                new Date(currentMessage.timestamp).getTime() -
                    new Date(previousMessage.timestamp).getTime() >
                    TIME_THRESHOLD_MS;

            if (shouldStartNewGroup) {
                groups.push({
                    playerId: currentMessage.player_id,
                    messages: [currentMessage],
                    showTimestamp: true,
                });
            } else {
                groups[groups.length - 1].messages.push(currentMessage);
            }
        }

        return groups;
    };

    const messageGroups = groupMessages(messages);

    if (!selectedChatId) {
        return (
            <div className="flex-1 flex items-center justify-center text-gray-500">
                Select a chat to start messaging
            </div>
        );
    }

    if (isLoading || !playerMap) {
        return (
            <div className="flex-1 flex items-center justify-center text-gray-500">
                Loading messages...
            </div>
        );
    }

    if (messages.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center text-gray-500">
                No messages yet. Start the conversation!
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
            {messageGroups.map((group, groupIndex) => {
                const isOwnMessage = group.playerId === user?.player_id;
                const showPlayerName = isGroupChat && !isOwnMessage;

                return (
                    <div
                        key={`group-${groupIndex}`}
                        className={cn(
                            "flex flex-col",
                            isOwnMessage ? "items-end" : "items-start",
                        )}
                    >
                        {/* Show player name and timestamp only for the first message in the group */}
                        {group.showTimestamp && (
                            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1 px-1">
                                {showPlayerName && (
                                    <>{playerMap[group.playerId].username} • </>
                                )}
                                {formatTimestamp(group.messages[0].timestamp)}
                            </div>
                        )}

                        {/* Render all messages in the group */}
                        <div
                            className={cn(
                                "space-y-1 flex flex-col",
                                isOwnMessage ? "items-end" : "items-start",
                            )}
                        >
                            {group.messages.map((message) => (
                                <div
                                    key={message.id}
                                    className={cn(
                                        "p-3 rounded-lg wrap-break-word max-w-[70%]",
                                        isOwnMessage
                                            ? "bg-pine dark:bg-brand-green text-white rounded-br-none"
                                            : "bg-secondary rounded-bl-none",
                                    )}
                                >
                                    {message.text}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
            <div ref={messagesEndRef} />
        </div>
    );
}
