/**
 * Messages page - Chat and messaging interface.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { MessageSquare, Plus, X } from "lucide-react";

import { RequireSettledPlayer } from "@/components/auth/ProtectedRoute";
import { GameLayout } from "@/components/layout/GameLayout";
import { Card, CardTitle } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";
import {
    useChatList,
    useChatMessages,
    useSendMessage,
    useCreateGroupChat,
    useOpenChat,
} from "@/hooks/useChats";
import { useSettings, useUpdateSettings } from "@/hooks/useSettings";
import { usePlayers } from "@/hooks/usePlayers";
import { useSocketEvent } from "@/contexts/SocketContext";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/app/community/messages")({
    component: MessagesPage,
    staticData: { title: "Messages" },
});

function MessagesPage() {
    return (
        <RequireSettledPlayer>
            <GameLayout>
                <MessagesContent />
            </GameLayout>
        </RequireSettledPlayer>
    );
}

function MessagesContent() {
    const [selectedChatId, setSelectedChatId] = useState<number | null>(null);
    const [showDisclaimer, setShowDisclaimer] = useState(true);
    const [showNewChatModal, setShowNewChatModal] = useState(false);
    const [showGroupChatModal, setShowGroupChatModal] = useState(false);

    const { data: chatListData, isLoading: isChatListLoading } = useChatList();
    const { data: chatMessagesData, isLoading: isChatMessagesLoading } =
        useChatMessages(selectedChatId);
    const { data: settingsData } = useSettings();
    const { mutate: updateSettings } = useUpdateSettings();
    const { mutate: openChat } = useOpenChat();

    // When a message is received, mark the chat as opened if it's the selected chat
    const handleNewMessage = useCallback(
        (data: {
            time: string;
            player_id: number;
            text: string;
            chat_id: number;
        }) => {
            if (data.chat_id === selectedChatId) {
                openChat(data.chat_id);
            }
        },
        [selectedChatId, openChat],
    );

    useSocketEvent("display_new_message", handleNewMessage);

    // Initialize disclaimer visibility based on settings
    useEffect(() => {
        if (settingsData?.show_disclaimer) {
            setShowDisclaimer(true);
        } else {
            setShowDisclaimer(false);
        }
    }, [settingsData]);

    // Auto-select first chat if available and mark it as opened
    useEffect(() => {
        if (
            !selectedChatId &&
            chatListData?.chats &&
            chatListData.chats.length > 0
        ) {
            const firstChatId = chatListData.chats[0].id;
            setSelectedChatId(firstChatId);
            openChat(firstChatId);
        }
    }, [chatListData, selectedChatId, openChat]);

    const selectedChat = chatListData?.chats?.find(
        (chat) => chat.id === selectedChatId,
    );

    const handleDismissDisclaimer = () => {
        setShowDisclaimer(false);
        updateSettings({ show_disclaimer: false });
    };

    return (
        <div className="p-4 md:p-8">
            {/* Disclaimer Modal */}
            {showDisclaimer && (
                <Modal
                    isOpen={true}
                    onClose={handleDismissDisclaimer}
                    title="Chat Disclaimer"
                >
                    <div className="space-y-4">
                        <p>
                            This is a disclaimer that tells you that the chat is
                            not censored and that any message can be read by the
                            administrators.
                        </p>
                        <button
                            onClick={handleDismissDisclaimer}
                            className="w-full bg-pine hover:bg-pine-dark dark:bg-brand-green dark:hover:bg-brand-green-dark text-white px-4 py-2 rounded-lg font-medium transition-colors"
                        >
                            OK
                        </button>
                    </div>
                </Modal>
            )}

            {/* New Chat Modal */}
            <NewChatModal
                isOpen={showNewChatModal}
                onClose={() => setShowNewChatModal(false)}
                onChatSelected={(chatId) => {
                    setSelectedChatId(chatId);
                    openChat(chatId);
                }}
            />

            {/* New Group Chat Modal */}
            <NewGroupChatModal
                isOpen={showGroupChatModal}
                onClose={() => {
                    setShowGroupChatModal(false);
                }}
                onChatSelected={(chatId) => {
                    setSelectedChatId(chatId);
                    openChat(chatId);
                }}
            />

            {/* Main Chat Layout */}
            <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-120px)]">
                {/* Chat Sidebar */}
                <div className="w-full lg:w-72 flex flex-col gap-4">
                    <Card className="flex-1 flex flex-col overflow-hidden">
                        <CardTitle className="text-center mb-4">
                            <MessageSquare className="inline w-6 h-6 mr-2" />
                            Chats
                        </CardTitle>

                        {/* Chat List */}
                        <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                            {isChatListLoading ? (
                                <div className="text-center text-gray-500 py-4">
                                    Loading chats...
                                </div>
                            ) : !chatListData?.chats ||
                              chatListData.chats.length === 0 ? (
                                <div className="text-center text-gray-500 py-4">
                                    No chats yet
                                </div>
                            ) : (
                                chatListData.chats.map((chat) => (
                                    <ChatListItem
                                        key={chat.id}
                                        chat={chat}
                                        isSelected={selectedChatId === chat.id}
                                        onClick={() => {
                                            setSelectedChatId(chat.id);
                                            openChat(chat.id);
                                        }}
                                    />
                                ))
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="space-y-2">
                            <button
                                onClick={() => setShowNewChatModal(true)}
                                className="w-full flex items-center justify-center gap-2 bg-pine hover:bg-pine-dark dark:bg-brand-green dark:hover:bg-brand-green-dark text-white px-4 py-2 rounded-lg font-medium transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                Write to player
                            </button>
                            <button
                                onClick={() => setShowGroupChatModal(true)}
                                className="w-full flex items-center justify-center gap-2 bg-pine hover:bg-pine-dark dark:bg-brand-green dark:hover:bg-brand-green-dark text-white px-4 py-2 rounded-lg font-medium transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                Create group chat
                            </button>
                        </div>
                    </Card>
                </div>

                {/* Chat Window */}
                <div className="flex-1 flex flex-col">
                    <Card className="flex-1 flex flex-col overflow-hidden">
                        {/* Chat Header */}
                        <div className="border-b border-gray-300 dark:border-dark-border pb-4 mb-4">
                            <h2 className="text-2xl font-bold text-center">
                                {selectedChat
                                    ? selectedChat.display_name
                                    : "Select a chat"}
                            </h2>
                        </div>

                        {/* Messages Container */}
                        <MessageContainer
                            isLoading={isChatMessagesLoading}
                            messages={chatMessagesData?.messages || []}
                            selectedChatId={selectedChatId}
                        />

                        {/* Message Input */}
                        {selectedChatId && (
                            <MessageInput
                                chatId={selectedChatId}
                                isDisabled={!selectedChat}
                            />
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
}

interface ChatListItemProps {
    chat: {
        id: number;
        display_name: string;
        unread_messages_count: number;
    };
    isSelected: boolean;
    onClick: () => void;
}

function ChatListItem({ chat, isSelected, onClick }: ChatListItemProps) {
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

interface MessageContainerProps {
    isLoading: boolean;
    messages: Array<{
        id: number;
        text: string;
        player_id: number;
        timestamp: string;
    }>;
    selectedChatId: number | null;
}

function MessageContainer({
    isLoading,
    messages,
    selectedChatId,
}: MessageContainerProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { data: playersData } = usePlayers();

    // Create a map of player IDs to usernames for quick lookup
    const playerMap = useMemo(() => {
        const map: Record<number, string> = {};
        if (playersData) {
            playersData.forEach((player) => {
                map[player.id] = player.username;
            });
        }
        return map;
    }, [playersData]);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    if (!selectedChatId) {
        return (
            <div className="flex-1 flex items-center justify-center text-gray-500">
                Select a chat to start messaging
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center text-gray-500">
                Loading messages...
            </div>
        );
    }

    if (messages.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center text-gray-500">
                No messages yet. Start the conversation!
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
            {messages.map((message) => (
                <div key={message.id} className="space-y-1">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                        {playerMap[message.player_id] ||
                            `Player ${message.player_id}`}{" "}
                        • {new Date(message.timestamp).toLocaleString()}
                    </div>
                    <div className="bg-gray-50 dark:bg-dark-bg-tertiary p-3 rounded-lg break-words">
                        {message.text}
                    </div>
                </div>
            ))}
            <div ref={messagesEndRef} />
        </div>
    );
}

interface MessageInputProps {
    chatId: number;
    isDisabled: boolean;
}

function MessageInput({ chatId, isDisabled }: MessageInputProps) {
    const [message, setMessage] = useState("");
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
                },
            },
        );
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex gap-2 pt-4 border-t border-gray-300 dark:border-dark-border">
            <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                disabled={isDisabled || isPending}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-dark-border dark:bg-dark-bg-tertiary focus:outline-none focus:ring-2 focus:ring-pine dark:focus:ring-brand-green disabled:opacity-50"
            />
            <button
                onClick={handleSend}
                disabled={isDisabled || isPending || !message.trim()}
                className="px-4 py-2 bg-pine hover:bg-pine-dark dark:bg-brand-green dark:hover:bg-brand-green-dark text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Send
            </button>
        </div>
    );
}

interface NewChatModalProps {
    isOpen: boolean;
    onClose: () => void;
    onChatSelected?: (chatId: number) => void;
}

function NewChatModal({ isOpen, onClose, onChatSelected }: NewChatModalProps) {
    const [playerName, setPlayerName] = useState("");
    const [filteredPlayers, setFilteredPlayers] = useState<
        Array<{ id: number; username: string }>
    >([]);
    const [selectedPlayer, setSelectedPlayer] = useState<{
        id: number;
        username: string;
    } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { data: playersData } = usePlayers();
    const { data: chatListData } = useChatList();
    const { user } = useAuth();
    const { mutate: createGroupChat, isPending } = useCreateGroupChat();

    const handlePlayerInputChange = (value: string) => {
        setPlayerName(value);
        setError(null);
        if (value.trim()) {
            const filtered = (playersData || []).filter(
                (player) =>
                    player.username
                        .toLowerCase()
                        .includes(value.toLowerCase()) &&
                    player.id !== user?.player_id,
            );
            setFilteredPlayers(filtered);
        } else {
            setFilteredPlayers([]);
        }
    };

    const handleSelectPlayer = (player: { id: number; username: string }) => {
        setSelectedPlayer(player);
        setPlayerName(player.username);
        setFilteredPlayers([]);
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
                    <label htmlFor="player-name" className="block mb-2">
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
                            {filteredPlayers.map((player) => (
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
                <button
                    onClick={handleCreateChat}
                    disabled={!selectedPlayer || isPending}
                    className="w-full bg-pine hover:bg-pine-dark dark:bg-brand-green dark:hover:bg-brand-green-dark text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isPending
                        ? existingChat
                            ? "Opening..."
                            : "Creating..."
                        : existingChat
                          ? "Go to existing chat"
                          : "Create new chat"}
                </button>
            </div>
        </Modal>
    );
}

interface NewGroupChatModalProps {
    isOpen: boolean;
    onClose: () => void;
    onChatSelected?: (chatId: number) => void;
}

function NewGroupChatModal({
    isOpen,
    onClose,
    onChatSelected,
}: NewGroupChatModalProps) {
    const [chatTitle, setChatTitle] = useState("");
    const [groupMembers, setGroupMembers] = useState<
        Array<{ id: number; username: string }>
    >([]);
    const [playerInput, setPlayerInput] = useState("");
    const [filteredPlayers, setFilteredPlayers] = useState<
        Array<{ id: number; username: string }>
    >([]);
    const [error, setError] = useState<string | null>(null);
    const { mutate: createGroupChat, isPending } = useCreateGroupChat();
    const { data: playersData } = usePlayers();
    const { data: chatListData } = useChatList();
    const { user } = useAuth();

    const handlePlayerInputChange = (value: string) => {
        setPlayerInput(value);
        if (value.trim()) {
            const filtered = (playersData || []).filter(
                (player) =>
                    player.username
                        .toLowerCase()
                        .includes(value.toLowerCase()) &&
                    !groupMembers.some((m) => m.id === player.id) &&
                    player.id !== user?.player_id,
            );
            setFilteredPlayers(filtered);
        } else {
            setFilteredPlayers([]);
        }
    };

    const handleSelectPlayer = (player: { id: number; username: string }) => {
        setGroupMembers([...groupMembers, player]);
        setPlayerInput("");
        setFilteredPlayers([]);
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
                        <button
                            onClick={() => {
                                if (filteredPlayers.length === 1) {
                                    handleSelectPlayer(filteredPlayers[0]);
                                }
                            }}
                            disabled={filteredPlayers.length !== 1}
                            className="px-4 py-2 bg-pine hover:bg-pine-dark dark:bg-brand-green dark:hover:bg-brand-green-dark text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                    {filteredPlayers.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-dark-bg-secondary border border-gray-300 dark:border-dark-border rounded-lg shadow-lg z-10">
                            {filteredPlayers.map((player) => (
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

                <button
                    onClick={handleCreateGroupChat}
                    disabled={
                        isPending ||
                        !chatTitle.trim() ||
                        groupMembers.length === 0
                    }
                    className="w-full bg-pine hover:bg-pine-dark dark:bg-brand-green dark:hover:bg-brand-green-dark text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isPending
                        ? existingGroupChat
                            ? "Opening..."
                            : "Creating..."
                        : existingGroupChat
                          ? "Go to existing chat"
                          : "Create group chat"}
                </button>
            </div>
        </Modal>
    );
}
