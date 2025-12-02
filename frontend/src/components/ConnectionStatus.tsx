/**
 * Connection status indicator Shows a banner when the socket disconnects or
 * queries are failing
 */

import { useSocket } from "@contexts/SocketContext";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { useState, useEffect } from "react";

export function ConnectionStatus() {
    const { isConnected, error: socketError } = useSocket();
    const isFetching = useIsFetching();
    const isMutating = useIsMutating();
    const [wasConnected, setWasConnected] = useState(isConnected);
    const [showReconnected, setShowReconnected] = useState(false);

    // Track connection changes
    useEffect(() => {
        if (isConnected && !wasConnected) {
            // Just reconnected!
            setShowReconnected(true);
            setTimeout(() => setShowReconnected(false), 3000);
        }
        setWasConnected(isConnected);
    }, [isConnected, wasConnected]);

    // Don't show anything if connected and no errors
    if (isConnected && !socketError && !showReconnected) {
        return null;
    }

    return (
        <div className="fixed top-0 left-0 right-0 z-50">
            {/* Reconnected banner (success) */}
            {showReconnected && (
                <div className="bg-green-600 text-white px-4 py-2 text-center text-sm font-medium">
                    <i className="fa fa-check-circle mr-2"></i>
                    Reconnected! Your data is up to date.
                </div>
            )}

            {/* Disconnected banner (warning) */}
            {!isConnected && (
                <div className="bg-yellow-600 text-white px-4 py-2 text-center text-sm font-medium">
                    <i className="fa fa-exclamation-triangle mr-2"></i>
                    Connection lost. Showing cached data.
                    {isFetching > 0 && " Attempting to reconnect..."}
                </div>
            )}

            {/* Socket error banner (error) */}
            {socketError && (
                <div className="bg-red-600 text-white px-4 py-2 text-center text-sm font-medium">
                    <i className="fa fa-times-circle mr-2"></i>
                    Cannot connect to server. Please check your internet
                    connection.
                </div>
            )}
        </div>
    );
}
