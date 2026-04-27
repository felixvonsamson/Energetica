import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui";
import { useAuth } from "@/hooks/use-auth";
import { resolveErrorMessage } from "@/lib/game-messages";

interface MessageInputProps {
    onSend: (text: string, playerId: number) => Promise<void>;
    isDisabled: boolean;
    isDialogOpen: boolean;
}

export function MessageInput({ onSend, isDisabled, isDialogOpen }: MessageInputProps) {
    const [message, setMessage] = useState("");
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const { user } = useAuth();

    const adjustHeight = useCallback(() => {
        const textarea = inputRef.current;
        if (textarea) {
            textarea.style.height = "auto";
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    }, []);

    const handleSend = async () => {
        if (!message.trim() || !user?.player_id) return;
        const messageText = message;
        setMessage("");
        if (inputRef.current) {
            inputRef.current.style.height = "auto";
            inputRef.current.focus();
        }
        try {
            await onSend(messageText, user.player_id);
        } catch (err) {
            setMessage(messageText);
            toast.error(resolveErrorMessage(err));
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void handleSend();
        }
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
                onClick={() => void handleSend()}
                disabled={isDisabled || !message.trim()}
                aria-label="Send message"
                className="max-h-12"
            >
                Send
            </Button>
        </div>
    );
}
