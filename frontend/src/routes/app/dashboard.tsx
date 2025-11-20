/**
 * Example dashboard route demonstrating the foundation infrastructure.
 * This shows how to use auth, socket.io, and TanStack Query together.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket, useSocketEvent } from "@/contexts/SocketContext";
import { RequireSettledPlayer } from "@/components/auth/ProtectedRoute";
import { GameLayout } from "@/components/layout";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/app/dashboard")({
    component: DashboardPage,
    staticData: {
        title: "Dashboard",
    },
});

function DashboardPage() {
    return (
        <RequireSettledPlayer>
            <GameLayout>
                <DashboardContent />
            </GameLayout>
        </RequireSettledPlayer>
    );
}

function DashboardContent() {
    const { user, logout } = useAuth();
    const { isConnected, error: socketError } = useSocket();
    const [tickCount, setTickCount] = useState(0);

    // Example: Listen to socket events
    useSocketEvent("tick", () => {
        setTickCount((prev) => prev + 1);
    });

    useSocketEvent("player_update", (data: unknown) => {
        console.log("Player update received:", data);
    });

    return (
        <div className="p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-4xl font-bold mb-4">Dashboard</h1>

                {/* User Info */}
                <div className="bg-bone p-6 rounded-lg mb-6">
                    <h2 className="text-2xl font-bold mb-4">
                        User Information
                    </h2>
                    <div className="space-y-2">
                        <p>
                            <strong>Username:</strong> {user?.username}
                        </p>
                        <p>
                            <strong>Role:</strong> {user?.role}
                        </p>
                        <p>
                            <strong>Player ID:</strong> {user?.player_id}
                        </p>
                        <p>
                            <strong>Is Settled:</strong>{" "}
                            {user?.is_settled ? "Yes" : "No"}
                        </p>
                    </div>
                    <button
                        onClick={logout}
                        className="mt-4 px-4 py-2 bg-pine text-white rounded hover:bg-pine-darker"
                    >
                        Logout
                    </button>
                </div>

                {/* Socket.IO Status */}
                <div className="bg-tan-green p-6 rounded-lg mb-6">
                    <h2 className="text-2xl font-bold mb-4">
                        Real-time Connection
                    </h2>
                    <div className="space-y-2">
                        <p>
                            <strong>Status:</strong>{" "}
                            <span
                                className={
                                    isConnected
                                        ? "text-brand-green"
                                        : "text-alert-red"
                                }
                            >
                                {isConnected ? "Connected" : "Disconnected"}
                            </span>
                        </p>
                        <p>
                            <strong>Ticks received:</strong> {tickCount}
                        </p>
                        {socketError && (
                            <p className="text-alert-red">
                                <strong>Error:</strong> {socketError.message}
                            </p>
                        )}
                    </div>
                </div>

                {/* Quick Start Guide */}
                <div className="bg-white p-6 rounded-lg border-2 border-pine">
                    <h2 className="text-2xl font-bold mb-4">
                        Using the Foundation
                    </h2>
                    <div className="space-y-4">
                        <div>
                            <h3 className="font-bold text-lg">
                                1. Authentication
                            </h3>
                            <code className="block bg-gray-100 p-2 rounded mt-2">
                                const {"{"}user, isAuthenticated, logout{"}"} =
                                useAuth();
                            </code>
                        </div>
                        <div>
                            <h3 className="font-bold text-lg">
                                2. Socket.IO Events
                            </h3>
                            <code className="block bg-gray-100 p-2 rounded mt-2">
                                useSocketEvent("event_name", (data) ={"> {"}
                                console.log(data) {"}"});
                            </code>
                        </div>
                        <div>
                            <h3 className="font-bold text-lg">
                                3. API Requests
                            </h3>
                            <code className="block bg-gray-100 p-2 rounded mt-2">
                                import {"{"} apiClient {"}"} from
                                "@/lib/api-client";
                                <br />
                                const data = await apiClient.get("/endpoint");
                            </code>
                        </div>
                        <div>
                            <h3 className="font-bold text-lg">
                                4. Protected Routes
                            </h3>
                            <code className="block bg-gray-100 p-2 rounded mt-2">
                                {"<"}RequireSettledPlayer{">"}
                                <br />
                                {"  <"}YourComponent /{">"}
                                <br />
                                {"</"}RequireSettledPlayer{">"}
                            </code>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
