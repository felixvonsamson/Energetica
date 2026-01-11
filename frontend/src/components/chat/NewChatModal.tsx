import { X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";
import { useAuth } from "@/hooks/useAuth";
import { useChatList, useCreateGroupChat } from "@/hooks/useChats";
import { useFilteredPlayers } from "@/hooks/useFilteredPlayers";
import { usePlayers } from "@/hooks/usePlayers";
import type { Player } from "@/types/chats";

interface NewChatModalProps {
    isOpen: boolean;
    onClose: () => void;
    onChatSelected?: (chatId: number) => void;
}

export function NewChatModal({
    isOpen,
    onClose,
    onChatSelected,
}: NewChatModalProps) {
    const [playerInput, setPlayerInput] = useState("");
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { data: playersData } = usePlayers();
    const { data: chatListData } = useChatList();
    const { user } = useAuth();
    const { mutate: createGroupChat, isPending } = useCreateGroupChat();

    const filteredPlayers = useFilteredPlayers(
        playersData,
        playerInput,
        user?.player_id,
    );

    // Reset state when modal closes
    const handleClose = () => {
        setPlayerInput("");
        setSelectedPlayer(null);
        setError(null);
        onClose();
    };

    const handlePlayerInputChange = (value: string) => {
        setPlayerInput(value);
        setError(null);
    };

    const handleSelectPlayer = (player: Player) => {
        setSelectedPlayer(player);
        setError(null);
    };

    const handleRemovePlayer = () => {
        setSelectedPlayer(null);
        setPlayerInput("");
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
            setPlayerInput("");
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
                    setPlayerInput("");
                    setSelectedPlayer(null);
                    onChatSelected?.(data.id);
                    onClose();
                },
                onError: (error: unknown) => {
                    if (
                        (
                            error as unknown as {
                                response?: {
                                    data?: { game_exception_type?: string };
                                };
                            }
                        )?.response?.data?.game_exception_type ===
                        "chatAlreadyExist"
                    ) {
                        // Chat was created concurrently, find it and select it
                        const newChat = chatListData?.chats?.find(
                            (chat) =>
                                chat.display_name === selectedPlayer.username &&
                                !chat.is_group,
                        );
                        if (newChat) {
                            setPlayerInput("");
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
        <Modal isOpen={isOpen} onClose={handleClose} title="Write to player">
            <div className="space-y-0 flex flex-col">
                {error && (
                    <div className="p-3 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 rounded-lg text-sm mb-4 animate-in fade-in duration-200">
                        {error}
                    </div>
                )}

                {/* Selected Player Display */}
                <div className="pb-4">
                    {selectedPlayer ? (
                        <div className="space-y-2">
                            <p className="text-sm font-medium">
                                Selected player
                            </p>
                            <button
                                onClick={handleRemovePlayer}
                                aria-label={`Remove ${selectedPlayer.username}`}
                                className="flex items-center gap-2 bg-pine dark:bg-brand-green text-white px-3 py-1 rounded-full text-sm hover:opacity-80 transition-opacity animate-in zoom-in duration-200"
                            >
                                {selectedPlayer.username}
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <label
                                htmlFor="player-search"
                                className="block text-sm font-medium"
                            >
                                Select a player
                            </label>
                            <input
                                id="player-search"
                                type="search"
                                autoComplete="off"
                                value={playerInput}
                                onChange={(e) =>
                                    handlePlayerInputChange(e.target.value)
                                }
                                placeholder="Search players..."
                                className="w-full px-4 py-2 rounded-lg border border-input bg-card focus:outline-none focus:ring-2 focus:ring-pine dark:focus:ring-brand-green"
                            />
                        </div>
                    )}
                </div>

                {/* Player List */}
                {!selectedPlayer && (
                    <div className="border-t border-border">
                        <div className="max-h-60 overflow-y-auto bg-card rounded-lg">
                            {filteredPlayers.length > 0 ? (
                                <div className="divide-y divide-gray-200 dark:divide-dark-border">
                                    {filteredPlayers.map((player: Player) => (
                                        <button
                                            key={player.id}
                                            onClick={() =>
                                                handleSelectPlayer(player)
                                            }
                                            className="w-full text-left px-4 py-3 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-muted transition-colors"
                                        >
                                            {player.username}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                                    {playerInput.trim()
                                        ? "No players found"
                                        : "No players available"}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="border-t border-border pt-4">
                    <Button
                        onClick={handleCreateChat}
                        disabled={!selectedPlayer || isPending}
                        className="w-full transition-opacity"
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
            </div>
        </Modal>
    );
}
