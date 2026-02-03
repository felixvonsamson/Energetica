import { X } from "lucide-react";
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

    const handleCreateChat = (e: React.FormEvent) => {
        e.preventDefault();
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
                        ).response?.data?.game_exception_type ===
                        "chatAlreadyExist"
                    ) {
                        // Chat was created concurrently, find it and select it
                        const newChat = chatListData?.chats.find(
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
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <form onSubmit={handleCreateChat} id="new-chat-form">
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Write to player</DialogTitle>
                        <DialogDescription>
                            Select a player to start a conversation.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        {error && (
                            <InfoBanner variant="error">{error}</InfoBanner>
                        )}

                        <div>
                            {selectedPlayer ? (
                                <div className="space-y-2">
                                    <p className="text-sm font-medium">
                                        Selected player
                                    </p>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={handleRemovePlayer}
                                        aria-label={`Remove ${selectedPlayer.username}`}
                                        className="rounded-full"
                                    >
                                        {selectedPlayer.username}
                                        <X className="w-3 h-3 ml-2" />
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <Label htmlFor="player-search">
                                        Select a player
                                    </Label>
                                    <Input
                                        id="player-search"
                                        type="search"
                                        autoComplete="off"
                                        value={playerInput}
                                        onChange={(e) =>
                                            handlePlayerInputChange(
                                                e.target.value,
                                            )
                                        }
                                        placeholder="Search players..."
                                    />
                                </div>
                            )}
                        </div>

                        {!selectedPlayer && (
                            <div className="max-h-60 overflow-y-auto bg-card rounded-lg border border-border">
                                {filteredPlayers.length > 0 ? (
                                    <div className="divide-y divide-border">
                                        {filteredPlayers.map(
                                            (player: Player) => (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    key={player.id}
                                                    onClick={() =>
                                                        handleSelectPlayer(
                                                            player,
                                                        )
                                                    }
                                                    className="w-full justify-start rounded-none px-4 py-3 h-auto"
                                                >
                                                    {player.username}
                                                </Button>
                                            ),
                                        )}
                                    </div>
                                ) : (
                                    <div className="px-4 py-8 text-center text-muted-foreground">
                                        {playerInput.trim()
                                            ? "No players found"
                                            : "No players available"}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline" disabled={isPending}>
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button
                            type="submit"
                            form="new-chat-form"
                            variant={isPending ? "outline" : "default"}
                            disabled={!selectedPlayer || isPending}
                            className="flex items-center gap-2"
                        >
                            {isPending && <Spinner />}
                            {existingChat
                                ? "Go to existing chat"
                                : "Create new chat"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </form>
        </Dialog>
    );
}
