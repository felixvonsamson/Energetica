import type { Chat } from "@/types/chats";

interface ChatListItemProps {
    chat: Chat;
    isSelected: boolean;
    onClick: () => void;
}

export function ChatListItem({ chat, isSelected, onClick }: ChatListItemProps) {
    return (
        <button
            onClick={onClick}
            className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                isSelected
                    ? "bg-pine dark:bg-brand-green text-white"
                    : "hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary"
            }`}
        >
            <div className="flex justify-between items-start gap-2">
                <span className="font-medium truncate flex-1">
                    {chat.display_name}
                </span>
                {chat.unread_messages_count > 0 && (
                    <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full shrink-0">
                        {chat.unread_messages_count}
                    </span>
                )}
            </div>
        </button>
    );
}
