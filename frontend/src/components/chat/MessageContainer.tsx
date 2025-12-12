import { useEffect, useRef } from "react";

import { useAuth } from "@/hooks/useAuth";
import { usePlayerMap } from "@/hooks/usePlayers";
import { formatTimestamp } from "@/lib/format-utils";
import type { Message } from "@/types/chats";

interface MessageContainerProps {
    isLoading: boolean;
    messages: Message[];
    selectedChatId: number | null;
}

export function MessageContainer({
    isLoading,
    messages,
    selectedChatId,
}: MessageContainerProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const playerMap = usePlayerMap();
    const { user } = useAuth();

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

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
            {messages.map((message) => {
                const isOwnMessage = message.player_id === user?.player_id;
                return (
                    <div
                        key={message.id}
                        className={`flex ${
                            isOwnMessage ? "justify-end" : "justify-start"
                        }`}
                    >
                        <div className="max-w-xs space-y-1">
                            {!isOwnMessage && (
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                    {playerMap[message.player_id].username} •{" "}
                                    {formatTimestamp(message.timestamp)}
                                </div>
                            )}
                            <div
                                className={`p-3 rounded-lg break-words ${
                                    isOwnMessage
                                        ? "bg-pine dark:bg-brand-green text-white rounded-br-none"
                                        : "bg-gray-50 dark:bg-dark-bg-tertiary rounded-bl-none"
                                }`}
                            >
                                {message.text}
                            </div>
                            {isOwnMessage && (
                                <div className="text-sm text-gray-600 dark:text-gray-400 text-right">
                                    {formatTimestamp(message.timestamp)}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
            <div ref={messagesEndRef} />
        </div>
    );
}
