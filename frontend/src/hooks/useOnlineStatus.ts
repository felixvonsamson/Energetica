/** Hook to track online/offline status and disable actions when offline */

import { useState, useEffect } from "react";

import { useSocket } from "@/contexts/SocketContext";

export function useOnlineStatus() {
    const { isConnected } = useSocket();
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        return () => {
            window.removeEventListener("online", handleOffline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    return {
        /** Browser reports we have internet */
        isOnline,
        /** Socket is connected to server */
        isConnected,
        /** Both online AND connected - safe to perform actions */
        canPerformActions: isOnline && isConnected,
    };
}
