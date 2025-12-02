import { useState, useEffect, useMemo } from "react";
import { X, Plus } from "lucide-react";
import { Modal } from "@components/ui/Modal";
import { Button } from "@components/ui";
import { useChatList, useCreateGroupChat } from "@hooks/useChats";
import { usePlayers } from "@hooks/usePlayers";
import { useAuth } from "@hooks/useAuth";
import type { Player } from "@app-types/chats";

interface NewGroupChatModalProps {
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

export function NewGroupChatModal({
    isOpen,
    onClose,
    onChatSelected,
}: NewGroupChatModalProps) {
    const [chatTitle, setChatTitle] = useState("");
    const [groupMembers, setGroupMembers] = useState<Player[]>([]);
    const [playerInput, setPlayerInput] = useState("");
    const [error, setError] = useState<string | null>(null);
    const { mutate: createGroupChat, isPending } = useCreateGroupChat();
    const { data: playersData } = usePlayers();
    const { data: chatListData } = useChatList();
    const { user } = useAuth();

    const filteredPlayers = useFilteredPlayers(
        playersData,
        playerInput,
        user?.player_id,
        groupMembers.map((m) => m.id),
    );

    // Reset state when modal closes
    useEffect(() => {
        if (!isOpen) {
            setChatTitle("");
            setGroupMembers([]);
            setPlayerInput("");
            setError(null);
        }
    }, [isOpen]);

    const handlePlayerInputChange = (value: string) => {
        setPlayerInput(value);
    };

    const handleSelectPlayer = (player: Player) => {
        setGroupMembers([...groupMembers, player]);
        setPlayerInput("");
    };

    const handleRemovePlayer = (id: number) => {
        setGroupMembers(groupMembers.filter((m) => m.id !== id));
    };

    // Check if a chat with the same participants already exists
    // The backend prevents creating chats with identical participant sets
    // Include the current user in the comparison since the backend auto-adds them
    const selectedMemberIds = new Set([
        ...(user?.player_id ? [user.player_id] : []),
        ...groupMembers.map((m) => m.id),
    ]);
    const existingGroupChat =
        groupMembers.length > 0 && chatListData?.chats
            ? chatListData.chats.find((chat) => {
                  if (!chat.is_group) return false;
                  // Check if the participant IDs match exactly
                  const chatParticipantIds = new Set(chat.participant_ids);
                  return (
                      selectedMemberIds.size === chatParticipantIds.size &&
                      Array.from(selectedMemberIds).every((id) =>
                          chatParticipantIds.has(id),
                      )
                  );
              })
            : undefined;

    const handleCreateGroupChat = () => {
        if (!chatTitle.trim() || groupMembers.length === 0) return;

        if (existingGroupChat) {
            // Chat with these participants already exists, just select it
            setChatTitle("");
            setGroupMembers([]);
            onChatSelected?.(existingGroupChat.id);
            onClose();
            return;
        }

        createGroupChat(
            {
                group_chat_name: chatTitle,
                group_member_ids: groupMembers.map((m) => m.id),
            },
            {
                onSuccess: (data) => {
                    setChatTitle("");
                    setGroupMembers([]);
                    onChatSelected?.(data.id);
                    onClose();
                },
                onError: (error: any) => {
                    if (
                        error?.response?.data?.game_exception_type ===
                        "chatAlreadyExist"
                    ) {
                        // Chat was created concurrently, find it and select it
                        if (existingGroupChat) {
                            setChatTitle("");
                            setGroupMembers([]);
                            onChatSelected?.((existingGroupChat as any).id);
                            onClose();
                        } else {
                            setError(
                                "Chat with these participants already exists. Please refresh and try again.",
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
        <Modal isOpen={isOpen} onClose={onClose} title="Create group chat">
            <div className="space-y-4">
                {error && (
                    <div className="p-3 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 rounded-lg text-sm">
                        {error}
                    </div>
                )}
                <div>
                    <label htmlFor="chat-title" className="block mb-2">
                        Chat title
                    </label>
                    <input
                        id="chat-title"
                        type="text"
                        value={chatTitle}
                        onChange={(e) => {
                            setChatTitle(e.target.value);
                            setError(null);
                        }}
                        placeholder="Enter chat title"
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-dark-border dark:bg-dark-bg-tertiary focus:outline-none focus:ring-2 focus:ring-pine dark:focus:ring-brand-green"
                    />
                </div>

                {/* Group Members Display */}
                {groupMembers.length > 0 && (
                    <div>
                        <p className="text-sm font-medium mb-2">
                            Group Members (click to remove):
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {groupMembers.map((member) => (
                                <button
                                    key={member.id}
                                    onClick={() =>
                                        handleRemovePlayer(member.id)
                                    }
                                    aria-label={`Remove ${member.username} from group`}
                                    className="flex items-center gap-2 bg-pine dark:bg-brand-green text-white px-3 py-1 rounded-full text-sm hover:opacity-80 transition-opacity"
                                >
                                    {member.username}
                                    <X className="w-3 h-3" />
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="relative">
                    <label htmlFor="player-input" className="block mb-2">
                        Add player
                    </label>
                    <div className="flex gap-2">
                        <input
                            id="search-group-player"
                            type="search"
                            autoComplete="off"
                            value={playerInput}
                            onChange={(e) =>
                                handlePlayerInputChange(e.target.value)
                            }
                            placeholder="Enter player name"
                            className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-dark-border dark:bg-dark-bg-tertiary focus:outline-none focus:ring-2 focus:ring-pine dark:focus:ring-brand-green"
                        />
                        <Button
                            onClick={() => {
                                if (filteredPlayers.length === 1) {
                                    handleSelectPlayer(filteredPlayers[0]);
                                }
                            }}
                            disabled={filteredPlayers.length !== 1}
                            size="md"
                            aria-label="Add player to group"
                        >
                            <Plus className="w-4 h-4" />
                        </Button>
                    </div>
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
                    onClick={handleCreateGroupChat}
                    disabled={
                        isPending ||
                        !chatTitle.trim() ||
                        groupMembers.length === 0
                    }
                    className="w-full"
                >
                    {isPending
                        ? existingGroupChat
                            ? "Opening..."
                            : "Creating..."
                        : existingGroupChat
                          ? "Go to existing chat"
                          : "Create group chat"}
                </Button>
            </div>
        </Modal>
    );
}
