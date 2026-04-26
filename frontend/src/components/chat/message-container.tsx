import { useEffect, useLayoutEffect, useRef } from "react";

import { PlayerName } from "@/components/ui/player-name";
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
    hasMore: boolean;
    isLoadingMore: boolean;
    onLoadMore: () => void;
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
    hasMore,
    isLoadingMore,
    onLoadMore,
}: MessageContainerProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const isNearBottomRef = useRef(true);
    const prevChatIdRef = useRef<number | null>(selectedChatId);
    const initialScrollDoneRef = useRef(false);
    // Scroll height before "load more" prepend — used to restore scroll position
    const prevScrollHeightRef = useRef(0);
    const playerMap = usePlayerMap();
    const { user } = useAuth();

    const handleScroll = () => {
        const el = scrollContainerRef.current;
        if (!el) return;
        isNearBottomRef.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    };

    // Capture scroll height before messages are prepended (when isLoadingMore goes true)
    // then restore position after the new messages land in the DOM.
    useLayoutEffect(() => {
        const el = scrollContainerRef.current;
        if (!el) return;
        if (isLoadingMore) {
            prevScrollHeightRef.current = el.scrollHeight;
        } else if (prevScrollHeightRef.current > 0) {
            el.scrollTop += el.scrollHeight - prevScrollHeightRef.current;
            prevScrollHeightRef.current = 0;
        }
    }, [isLoadingMore]);

    useEffect(() => {
        const chatChanged = selectedChatId !== prevChatIdRef.current;
        prevChatIdRef.current = selectedChatId;

        if (chatChanged) {
            isNearBottomRef.current = true;
            initialScrollDoneRef.current = false;
            const el = scrollContainerRef.current;
            if (el) el.scrollTop = el.scrollHeight;
            return;
        }

        if (!initialScrollDoneRef.current && messages.length > 0) {
            initialScrollDoneRef.current = true;
            const el = scrollContainerRef.current;
            if (el) el.scrollTop = el.scrollHeight;
            return;
        }

        const lastMessage = messages[messages.length - 1];
        const isOwnMessage = lastMessage?.player_id === user?.player_id;

        if (isNearBottomRef.current || isOwnMessage) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, selectedChatId, user?.player_id]);

    const groupMessages = (messages: Message[]): MessageGroup[] => {
        const groups: MessageGroup[] = [];
        const TIME_THRESHOLD_MS = 5 * 60 * 1000;

        for (let i = 0; i < messages.length; i++) {
            const currentMessage = messages[i];
            if (!currentMessage) continue;

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

    const messageGroups = groupMessages(messages);

    return (
        <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2"
            onScroll={handleScroll}
        >
            {/* Load more button */}
            {hasMore && (
                <div className="flex justify-center pt-2 pb-1">
                    <button
                        onClick={onLoadMore}
                        disabled={isLoadingMore}
                        className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
                    >
                        {isLoadingMore ? "Loading…" : "Load older messages"}
                    </button>
                </div>
            )}

            {messageGroups.map((group) => {
                const isOwnMessage = group.playerId === user?.player_id;
                const showPlayerName = isGroupChat && !isOwnMessage;
                const firstMessage = group.messages[0];
                const player = playerMap[group.playerId];

                if (!firstMessage) return null;

                return (
                    <div
                        key={`group-${firstMessage.id}`}
                        className={cn(
                            "w-full flex flex-col",
                            isOwnMessage ? "items-end" : "items-start",
                        )}
                    >
                        {group.showTimestamp && (
                            <div className="text-sm text-muted-foreground mb-1 px-1 inline-flex items-center gap-1">
                                {showPlayerName && player && (
                                    <><PlayerName player={player} /> •</>
                                )}
                                {formatTimestamp(firstMessage.timestamp)}
                            </div>
                        )}

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
                                        "p-3 rounded-lg break-words max-w-[70%] whitespace-pre-line transition-opacity",
                                        isOwnMessage
                                            ? "bg-primary text-primary-foreground rounded-br-none"
                                            : "bg-secondary text-secondary-foreground rounded-bl-none",
                                        message.id < 0 && "opacity-60",
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
