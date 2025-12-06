import { MessageSquare, Plus } from "lucide-react";
import { Card, CardTitle, Button } from "@/components/ui";
import { ChatListItem } from "./ChatListItem";
import type { Chat } from "@/types/chats";

interface ChatSidebarProps {
    isLoading: boolean;
    chats: Chat[];
    selectedChatId: number | null;
    onChatSelect: (chatId: number) => void;
    onNewChatClick: () => void;
    onNewGroupChatClick: () => void;
}

export function ChatSidebar({
    isLoading,
    chats,
    selectedChatId,
    onChatSelect,
    onNewChatClick,
    onNewGroupChatClick,
}: ChatSidebarProps) {
    return (
        <div className="w-full lg:w-72 flex flex-col gap-4">
            <Card className="flex-1 flex flex-col overflow-hidden">
                <CardTitle className="text-center mb-4">
                    <MessageSquare className="inline w-6 h-6 mr-2" />
                    Chats
                </CardTitle>

                {/* Chat List */}
                <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                    {isLoading ? (
                        <div className="text-center text-gray-500 py-4">
                            Loading chats...
                        </div>
                    ) : !chats || chats.length === 0 ? (
                        <div className="text-center text-gray-500 py-4">
                            No chats yet
                        </div>
                    ) : (
                        chats.map((chat) => (
                            <ChatListItem
                                key={chat.id}
                                chat={chat}
                                isSelected={selectedChatId === chat.id}
                                onClick={() => onChatSelect(chat.id)}
                            />
                        ))
                    )}
                </div>

                {/* Action Buttons */}
                <div className="space-y-2">
                    <Button
                        onClick={onNewChatClick}
                        aria-label="Write to player"
                        className="w-full flex items-center justify-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Write to player
                    </Button>
                    <Button
                        onClick={onNewGroupChatClick}
                        aria-label="Create group chat"
                        className="w-full flex items-center justify-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Create group chat
                    </Button>
                </div>
            </Card>
        </div>
    );
}
