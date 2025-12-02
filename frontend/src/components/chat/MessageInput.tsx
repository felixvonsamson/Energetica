import { useState, useRef, useEffect } from "react";
import { Button } from "@components/ui";
import { useSendMessage } from "@hooks/useChats";

interface MessageInputProps {
    chatId: number;
    isDisabled: boolean;
    isModalOpen: boolean;
}

export function MessageInput({
    chatId,
    isDisabled,
    isModalOpen,
}: MessageInputProps) {
    const [message, setMessage] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    const { mutate: sendMessage, isPending } = useSendMessage();

    const handleSend = () => {
        if (!message.trim()) return;

        sendMessage(
            {
                chatId,
                data: { new_message: message },
            },
            {
                onSuccess: () => {
                    setMessage("");
                    inputRef.current?.focus();
                },
            },
        );
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    useEffect(() => {
        if (!isModalOpen) {
            inputRef.current?.focus();
        }
    }, [isModalOpen]);

    return (
        <div className="flex gap-2 pt-4 border-t border-gray-300 dark:border-dark-border">
            <input
                ref={inputRef}
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                disabled={isDisabled || isPending}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-dark-border dark:bg-dark-bg-tertiary focus:outline-none focus:ring-2 focus:ring-inset focus:ring-pine dark:focus:ring-brand-green disabled:opacity-50 min-w-0"
            />
            <Button
                onClick={handleSend}
                disabled={isDisabled || isPending || !message.trim()}
                aria-label="Send message"
            >
                Send
            </Button>
        </div>
    );
}
