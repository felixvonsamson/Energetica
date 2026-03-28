import { useState, useRef, useEffect, useCallback } from "react";

import { Button } from "@/components/ui";
import { useAuth } from "@/hooks/use-auth";
import { useSendMessage } from "@/hooks/use-chats";

interface MessageInputProps {
    chatId: number;
    isDisabled: boolean;
    isDialogOpen: boolean;
}

export function MessageInput({
    chatId,
    isDisabled,
    isDialogOpen,
}: MessageInputProps) {
    const [message, setMessage] = useState("");
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const { mutate: sendMessage } = useSendMessage();
    const { user } = useAuth();

    // Auto-resize textarea as content changes
    const adjustHeight = useCallback(() => {
        const textarea = inputRef.current;
        if (textarea) {
            textarea.style.height = "auto";
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    }, []);

    const handleSend = () => {
        if (!message.trim() || !user?.player_id) return;
        const messageText = message;

        // Clear input immediately (optimistic)
        setMessage("");
        if (inputRef.current) {
            inputRef.current.style.height = "auto";
            inputRef.current.focus();
        }

        sendMessage(
            {
                chatId,
                data: { new_message: messageText },
                playerId: user!.player_id!,
            },
            {
                onError: () => {
                    // Restore message text if the request fails
                    setMessage(messageText);
                },
            },
        );
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
        // Shift+Enter will naturally insert a new line in textarea
    };

    useEffect(() => {
        if (!isDialogOpen) {
            inputRef.current?.focus();
        }
    }, [isDialogOpen]);

    useEffect(() => {
        adjustHeight();
    }, [message, adjustHeight]);

    return (
        <div className="flex gap-2 pt-4 border-t border-border items-end">
            <textarea
                ref={inputRef}
                value={message}
                onChange={(e) => {
                    setMessage(e.target.value);
                    adjustHeight();
                }}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                disabled={isDisabled}
                rows={1}
                className="flex-1 px-3 py-2 rounded-lg border border-input bg-card focus:outline-none focus:ring-2 focus:ring-inset focus:ring-pine dark:focus:ring-brand-green disabled:opacity-50 min-w-0 resize-none max-h-32 overflow-y-auto"
            />
            <Button
                onClick={handleSend}
                disabled={isDisabled || !message.trim()}
                aria-label="Send message"
                className="max-h-12"
            >
                Send
            </Button>
        </div>
    );
}
