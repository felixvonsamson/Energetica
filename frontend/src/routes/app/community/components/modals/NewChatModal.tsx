import { useState, useEffect, useMemo } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui";
import { useChatList, useCreateGroupChat } from "@/hooks/useChats";
import { usePlayers } from "@/hooks/usePlayers";
import { useAuth } from "@/hooks/useAuth";
import type { Player } from "@/types/chats";

interface NewChatModalProps {
    isOpen: boolean;
    onClose: () => void;
    onChatSelected?: (chatId: number) => void;
}

function useFilteredPlayers(
    playersData: Player[] | undefined,
    searchInput: string,
    currentUserId: number | null | undefined,
    excludePlayerIds?: number[],
) {
    return useMemo(() => {
        if (!searchInput.trim()) {
            return [];
        }

        const excluded = new Set<number>();
        if (currentUserId) {
            excluded.add(currentUserId);
        }
        (excludePlayerIds || []).forEach((id) => excluded.add(id));

        return (playersData || []).filter(
            (player) =>
                player.username
                    .toLowerCase()
                    .includes(searchInput.toLowerCase()) &&
                !excluded.has(player.id),
        );
    }, [playersData, searchInput, currentUserId, excludePlayerIds]);
}

export function NewChatModal({
    isOpen,
    onClose,
    onChatSelected,
}: NewChatModalProps) {
    const [playerName, setPlayerName] = useState("");
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { data: playersData } = usePlayers();
    const { data: chatListData } = useChatList();
    const { user } = useAuth();
    const { mutate: createGroupChat, isPending } = useCreateGroupChat();

    const filteredPlayers = useFilteredPlayers(
        playersData,
        playerName,
        user?.player_id,
    );

    // Reset state when modal closes
    useEffect(() => {
        if (!isOpen) {
            setPlayerName("");
            setSelectedPlayer(null);
            setError(null);
        }
    }, [isOpen]);

    const handlePlayerInputChange = (value: string) => {
        setPlayerName(value);
        setError(null);
    };

    const handleSelectPlayer = (player: Player) => {
        setSelectedPlayer(player);
        setPlayerName(player.username);
        setError(null);
    };

    // Check if chat already exists with this player
    const existingChat =
        selectedPlayer && chatListData?.chats
            ? chatListData.chats.find(
                  (chat) =>
                      chat.display_name === selectedPlayer.username &&
                      !chat.is_group,
              )
            : undefined;

    const handleCreateChat = () => {
        if (!selectedPlayer) return;

        if (existingChat) {
            // Chat already exists, just select it
            setPlayerName("");
            setSelectedPlayer(null);
            onChatSelected?.(existingChat.id);
            onClose();
            return;
        }

        createGroupChat(
            {
                group_chat_name: null,
                group_member_ids: [selectedPlayer.id],
            },
            {
                onSuccess: (data) => {
                    setPlayerName("");
                    setSelectedPlayer(null);
                    onChatSelected?.(data.id);
                    onClose();
                },
                onError: (error: any) => {
                    if (
                        error?.response?.data?.game_exception_type ===
                        "chatAlreadyExist"
                    ) {
                        // Chat was created concurrently, find it and select it
                        const newChat = chatListData?.chats?.find(
                            (chat) =>
                                chat.display_name === selectedPlayer.username &&
                                !chat.is_group,
                        );
                        if (newChat) {
                            setPlayerName("");
                            setSelectedPlayer(null);
                            onChatSelected?.(newChat.id);
                            onClose();
                        } else {
                            setError(
                                "Chat already exists. Please refresh and try again.",
                            );
                        }
                    } else {
                        setError("Failed to create chat. Please try again.");
                    }
                },
            },
        );
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Write to player">
            <div className="space-y-4">
                {error && (
                    <div className="p-3 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 rounded-lg text-sm">
                        {error}
                    </div>
                )}
                <div className="relative">
                    <label htmlFor="search-player" className="block mb-2">
                        Player name
                    </label>
                    <input
                        id="search-player"
                        type="search"
                        autoComplete="off"
                        value={playerName}
                        onChange={(e) =>
                            handlePlayerInputChange(e.target.value)
                        }
                        placeholder="Enter player name"
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-dark-border dark:bg-dark-bg-tertiary focus:outline-none focus:ring-2 focus:ring-pine dark:focus:ring-brand-green"
                    />
                    {filteredPlayers.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-dark-bg-secondary border border-gray-300 dark:border-dark-border rounded-lg shadow-lg z-10">
                            {filteredPlayers.map((player: Player) => (
                                <button
                                    key={player.id}
                                    onClick={() => handleSelectPlayer(player)}
                                    className="w-full text-left px-4 py-2 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary transition-colors"
                                >
                                    {player.username}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <Button
                    onClick={handleCreateChat}
                    disabled={!selectedPlayer || isPending}
                    className="w-full"
                >
                    {isPending
                        ? existingChat
                            ? "Opening..."
                            : "Creating..."
                        : existingChat
                          ? "Go to existing chat"
                          : "Create new chat"}
                </Button>
            </div>
        </Modal>
    );
}
