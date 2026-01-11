import { X, Check } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";
import { useAuth } from "@/hooks/useAuth";
import { useChatList, useCreateGroupChat } from "@/hooks/useChats";
import { useFilteredPlayers } from "@/hooks/useFilteredPlayers";
import { usePlayers } from "@/hooks/usePlayers";
import type { Player, Chat } from "@/types/chats";

interface NewGroupChatModalProps {
    isOpen: boolean;
    onClose: () => void;
    onChatSelected?: (chatId: number) => void;
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
    );

    // Reset state when modal closes
    const handleClose = () => {
        setChatTitle("");
        setGroupMembers([]);
        setPlayerInput("");
        setError(null);
        onClose();
    };

    const handlePlayerInputChange = (value: string) => {
        setPlayerInput(value);
    };

    const handleTogglePlayer = (player: Player) => {
        const isSelected = groupMembers.some((m) => m.id === player.id);
        if (isSelected) {
            setGroupMembers(groupMembers.filter((m) => m.id !== player.id));
        } else {
            setGroupMembers([...groupMembers, player]);
        }
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
    const existingGroupChat: Chat | undefined =
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

    const isTitleRequired = groupMembers.length >= 2 && !existingGroupChat;
    const isTitleMissing = isTitleRequired && !chatTitle.trim();

    const handleCreateGroupChat = () => {
        if (groupMembers.length === 0) return;
        if (isTitleRequired && !chatTitle.trim()) return;

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
                group_chat_name: groupMembers.length === 1 ? null : chatTitle,
                group_member_ids: groupMembers.map((m) => m.id),
            },
            {
                onSuccess: (data) => {
                    setChatTitle("");
                    setGroupMembers([]);
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
                        if (existingGroupChat) {
                            setChatTitle("");
                            setGroupMembers([]);
                            onChatSelected?.((existingGroupChat as Chat).id);
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
        <Modal isOpen={isOpen} onClose={handleClose} title="Create group chat">
            <div className="space-y-0 flex flex-col">
                {error && (
                    <div className="p-3 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 rounded-lg text-sm mb-4 animate-in fade-in duration-200">
                        {error}
                    </div>
                )}
                <div className="pb-4">
                    <label htmlFor="chat-title" className="block mb-2">
                        Chat title
                        {isTitleRequired && (
                            <span className="text-red-600 dark:text-red-400">
                                {" "}
                                *
                            </span>
                        )}
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
                        className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 transition ${
                            isTitleMissing
                                ? "border-red-500 dark:border-red-500 bg-red-50 dark:bg-red-900/20 focus:ring-red-500 dark:focus:ring-red-500"
                                : "border-border bg-card focus:ring-pine dark:focus:ring-brand-green"
                        }`}
                    />
                    <div className="h-6 mt-1">
                        {isTitleMissing && (
                            <p className="text-sm text-red-600 dark:text-red-400 animate-in fade-in duration-200">
                                Group chat name is required
                            </p>
                        )}
                    </div>
                </div>

                {/* Group Members Display */}
                <div className="border-t border-border py-4">
                    <p className="text-sm font-medium mb-3">
                        Selected Players{" "}
                        {groupMembers.length > 0 && `(${groupMembers.length})`}
                    </p>
                    <div className="min-h-8">
                        {groupMembers.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {groupMembers.map((member) => (
                                    <button
                                        key={member.id}
                                        onClick={() =>
                                            handleRemovePlayer(member.id)
                                        }
                                        aria-label={`Remove ${member.username} from group`}
                                        className="flex items-center gap-2 bg-pine dark:bg-brand-green text-white px-3 py-1 rounded-full text-sm hover:opacity-80 transition-opacity animate-in zoom-in duration-200"
                                    >
                                        {member.username}
                                        <X className="w-3 h-3" />
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                                No players selected yet
                            </p>
                        )}
                    </div>
                </div>

                <div className="border-t border-border py-4">
                    <label htmlFor="player-search" className="block mb-3">
                        Add players
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
                        className="w-full px-4 py-2 rounded-lg border border-input bg-card focus:outline-none focus:ring-2 focus:ring-pine dark:focus:ring-brand-green mb-3"
                    />
                    <div className="max-h-60 overflow-y-auto border border-border rounded-lg bg-card">
                        {filteredPlayers.length > 0 ? (
                            <div className="divide-y divide-border">
                                {filteredPlayers.map((player: Player) => {
                                    const isSelected = groupMembers.some(
                                        (m) => m.id === player.id,
                                    );
                                    return (
                                        <button
                                            key={player.id}
                                            onClick={() =>
                                                handleTogglePlayer(player)
                                            }
                                            className="w-full text-left px-4 py-3 flex items-center gap-3 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-muted transition-colors"
                                        >
                                            <div
                                                className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                                    isSelected
                                                        ? "bg-pine dark:bg-brand-green border-pine dark:border-brand-green"
                                                        : "border-gray-300 dark:border-gray-500"
                                                }`}
                                            >
                                                {isSelected && (
                                                    <Check className="w-4 h-4 text-white" />
                                                )}
                                            </div>
                                            <span>{player.username}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                                No players available
                            </div>
                        )}
                    </div>
                </div>

                <div className="border-t border-border pt-4">
                    <Button
                        onClick={handleCreateGroupChat}
                        disabled={
                            isPending ||
                            groupMembers.length === 0 ||
                            isTitleMissing
                        }
                        className="w-full transition-opacity"
                    >
                        {isPending
                            ? existingGroupChat
                                ? "Opening..."
                                : "Creating..."
                            : existingGroupChat
                              ? "Go to existing chat"
                              : groupMembers.length === 1
                                ? "Create 1-on-1 chat"
                                : "Create group chat"}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
