import { useEffect, useRef } from "react";

import { useAuth } from "@/hooks/use-auth";
import { usePlayerMap } from "@/hooks/use-players";
import { formatTimestamp } from "@/lib/format-utils";
import { cn } from "@/lib/utils";
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
            if (!currentMessage) continue; // Skip if undefined (shouldn't happen)

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
                const lastGroup = groups[groups.length - 1];
                if (lastGroup) {
                    lastGroup.messages.push(currentMessage);
                }
            }
        }

        return groups;
    };

    const messageGroups = groupMessages(messages);

    if (!selectedChatId) {
        return (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
                Select a chat to start messaging
            </div>
        );
    }

    if (isLoading || !playerMap) {
        return (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
                Loading messages...
            </div>
        );
    }

    if (messages.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
                No messages yet. Start the conversation!
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
            {messageGroups.map((group) => {
                const isOwnMessage = group.playerId === user?.player_id;
                const showPlayerName = isGroupChat && !isOwnMessage;
                const firstMessage = group.messages[0];
                const player = playerMap[group.playerId];

                // Skip groups without messages (shouldn't happen but type-safety)
                if (!firstMessage) {
                    return null;
                }

                return (
                    <div
                        key={`group-${firstMessage.id}`}
                        className={cn(
                            "w-full flex flex-col",
                            isOwnMessage ? "items-end" : "items-start",
                        )}
                    >
                        {/* Show player name and timestamp only for the first message in the group */}
                        {group.showTimestamp && (
                            <div className="text-sm text-muted-foreground mb-1 px-1">
                                {showPlayerName && player && (
                                    <>{player.username} • </>
                                )}
                                {formatTimestamp(firstMessage.timestamp)}
                            </div>
                        )}

                        {/* Render all messages in the group */}
                        <div
                            className={cn(
                                "w-full space-y-1 flex flex-col",
                                isOwnMessage ? "items-end" : "items-start",
                            )}
                        >
                            {group.messages.map((message) => (
                                <div
                                    key={message.id}
                                    className={cn(
                                        "p-3 rounded-lg wrap-break-word max-w-[70%] whitespace-pre-line",
                                        isOwnMessage
                                            ? "bg-primary text-primary-foreground rounded-br-none"
                                            : "bg-secondary text-secondary-foreground rounded-bl-none",
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
