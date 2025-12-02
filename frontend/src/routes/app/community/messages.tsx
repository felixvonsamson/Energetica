/** Messages page - Chat and messaging interface. */

import { createFileRoute } from "@tanstack/react-router";
import { RequireSettledPlayer } from "@components/auth/ProtectedRoute";
import { GameLayout } from "@components/layout/GameLayout";
import { MessagesContent } from "@components/chat/MessagesContent";

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
