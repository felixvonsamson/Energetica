import { X, Check } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { InfoBanner } from "@/components/ui/info-banner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/useAuth";
import { useChatList, useCreateGroupChat } from "@/hooks/useChats";
import { useFilteredPlayers } from "@/hooks/useFilteredPlayers";
import { usePlayers } from "@/hooks/usePlayers";
import { cn } from "@/lib/utils";
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

    const handleCreateGroupChat = (e: React.FormEvent) => {
        e.preventDefault();
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
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <form onSubmit={handleCreateGroupChat} id="new-group-chat-form">
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create group chat</DialogTitle>
                        <DialogDescription>
                            Start a group conversation with multiple players.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        {error && (
                            <InfoBanner variant="error">{error}</InfoBanner>
                        )}

                        <div className="grid gap-3">
                            <Label htmlFor="chat-title">
                                Chat title
                                {isTitleRequired && (
                                    <span className="text-destructive"> *</span>
                                )}
                            </Label>
                            <Input
                                id="chat-title"
                                type="text"
                                value={chatTitle}
                                onChange={(e) => {
                                    setChatTitle(e.target.value);
                                    setError(null);
                                }}
                                placeholder="Enter chat title"
                                aria-invalid={isTitleMissing}
                            />
                            {isTitleMissing && (
                                <p className="text-sm text-destructive">
                                    Group chat name is required
                                </p>
                            )}
                        </div>

                        <div>
                            <p className="text-sm font-medium mb-3">
                                Selected Players{" "}
                                {groupMembers.length > 0 &&
                                    `(${groupMembers.length})`}
                            </p>
                            {groupMembers.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {groupMembers.map((member) => (
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            key={member.id}
                                            onClick={() =>
                                                handleRemovePlayer(member.id)
                                            }
                                            aria-label={`Remove ${member.username} from group`}
                                            className="rounded-full"
                                        >
                                            {member.username}
                                            <X className="w-3 h-3 ml-2" />
                                        </Button>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground italic">
                                    No players selected yet
                                </p>
                            )}
                        </div>

                        <div>
                            <Label htmlFor="player-search" className="mb-3">
                                Add players
                            </Label>
                            <Input
                                id="player-search"
                                type="search"
                                autoComplete="off"
                                value={playerInput}
                                onChange={(e) =>
                                    handlePlayerInputChange(e.target.value)
                                }
                                placeholder="Search players..."
                            />
                            <div className="max-h-60 overflow-y-auto border border-border rounded-lg bg-card mt-2">
                                {filteredPlayers.length > 0 ? (
                                    <div className="divide-y divide-border">
                                        {filteredPlayers.map(
                                            (player: Player) => {
                                                const isSelected =
                                                    groupMembers.some(
                                                        (m) =>
                                                            m.id === player.id,
                                                    );
                                                return (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        key={player.id}
                                                        onClick={() =>
                                                            handleTogglePlayer(
                                                                player,
                                                            )
                                                        }
                                                        className="w-full justify-start rounded-none px-4 py-3 h-auto"
                                                    >
                                                        <div
                                                            className={cn(
                                                                "shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                                                                isSelected
                                                                    ? "bg-primary border-primary"
                                                                    : "border-muted-foreground",
                                                            )}
                                                        >
                                                            {isSelected && (
                                                                <Check className="w-4 h-4 text-primary-foreground" />
                                                            )}
                                                        </div>
                                                        <span>
                                                            {player.username}
                                                        </span>
                                                    </Button>
                                                );
                                            },
                                        )}
                                    </div>
                                ) : (
                                    <div className="px-4 py-8 text-center text-muted-foreground">
                                        No players available
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline" disabled={isPending}>
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button
                            type="submit"
                            form="new-group-chat-form"
                            variant={isPending ? "outline" : "default"}
                            disabled={
                                isPending ||
                                groupMembers.length === 0 ||
                                isTitleMissing
                            }
                            className="flex items-center gap-2"
                        >
                            {isPending && <Spinner />}
                            {existingGroupChat
                                ? "Go to existing chat"
                                : groupMembers.length === 1
                                  ? "Create 1-on-1 chat"
                                  : "Create group chat"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </form>
        </Dialog>
    );
}
