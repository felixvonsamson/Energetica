import { PlayerName } from "@/components/ui/player-name";
import { useMyId, usePlayerMap } from "@/hooks/use-players";
import type { Chat } from "@/types/chats";

interface ChatListItemProps {
    chat: Chat;
    isSelected: boolean;
    onClick: () => void;
}

export function ChatListItem({ chat, isSelected, onClick }: ChatListItemProps) {
    const myId = useMyId();
    const playerMap = usePlayerMap();
    const otherPlayer =
        !chat.is_group && myId && playerMap
            ? (playerMap[
                  chat.participant_ids.find((id) => id !== myId) ?? -1
              ] ?? null)
            : null;

    return (
        <button
            onClick={onClick}
            className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                isSelected
                    ? "bg-pine dark:bg-brand text-white"
                    : "hover:bg-gray-100 dark:hover:bg-muted"
            }`}
        >
            <div className="flex justify-between items-start gap-2">
                <span className="font-medium truncate flex-1">
                    {otherPlayer ? (
                        <PlayerName player={otherPlayer} />
                    ) : (
                        chat.display_name
                    )}
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
