/**
 * Socket.IO context for real-time game updates. Manages connection lifecycle
 * and provides socket instance to components.
 */

import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    useRef,
    type ReactNode,
} from "react";
import io from "socket.io-client";

import { useAuth } from "@/hooks/useAuth";

// Socket type is the return type of io()
type Socket = ReturnType<typeof io>;

interface SocketContextValue {
    socket: Socket | null;
    isConnected: boolean;
    error: Error | null;
}

const SocketContext = createContext<SocketContextValue | undefined>(undefined);

export interface SocketProviderProps {
    children: ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
    const { user, isAuthenticated } = useAuth();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const socketRef = useRef<Socket | null>(null);

    // Socket.IO requires a settled player (not admin, not unsettled)
    const canConnect =
        isAuthenticated && user?.role === "player" && user?.is_settled;

    useEffect(() => {
        // Only connect if user is a settled player
        if (!canConnect) {
            console.log("[Socket.IO] Not connecting:", {
                isAuthenticated,
                role: user?.role,
                isSettled: user?.is_settled,
                reason: !isAuthenticated
                    ? "Not authenticated"
                    : user?.role !== "player"
                      ? "User is not a player (admin?)"
                      : "User not settled (needs location choice)",
            });
            // Disconnect if we have a connection and user logged out
            if (socketRef.current) {
                console.log("[Socket.IO] Disconnecting existing socket");
                socketRef.current.disconnect();
                socketRef.current = null;
            }
            return;
        }

        // Don't create a new connection if we already have one
        if (socketRef.current?.connected) {
            console.log(
                "[Socket.IO] Socket already connected, skipping reconnect",
            );
            return;
        }

        // If we have a disconnected socket, try to reconnect it instead of creating new one
        if (socketRef.current && !socketRef.current.connected) {
            console.log(
                "[Socket.IO] Socket exists but disconnected, attempting reconnect...",
            );
            socketRef.current.connect();
            return;
        }

        console.log("[Socket.IO] Attempting connection for settled player...");

        // Create socket connection
        const newSocket = io();

        socketRef.current = newSocket;

        // Connection event handlers
        newSocket.on("connect", () => {
            console.log("[Socket.IO] ✓ Connected successfully");
            setSocket(newSocket);
            setIsConnected(true);
            setError(null);
        });

        newSocket.on("disconnect", (reason: string) => {
            console.log("[Socket.IO] ✗ Disconnected:", reason);
            setSocket(null);
            setIsConnected(false);
        });

        newSocket.on("connect_error", (err: Error) => {
            const errorData = (err as unknown as Record<string, unknown>).data;
            console.error("[Socket.IO] ✗ Connection error:");
            console.error("  Message:", err.message || "(empty)");
            console.error("  Data:", errorData);
            console.error("  Full error:", err);

            setError(err);
            setIsConnected(false);
        });

        newSocket.on("error", (err: unknown) => {
            console.error("[Socket.IO] ✗ Generic error:", err);
            setError(new Error(String(err)));
        });

        // Now connect manually after all handlers are set up
        console.log("[Socket.IO] Connecting...");
        newSocket.connect();

        // Cleanup: DON'T disconnect immediately (handles React StrictMode double-mounting)
        // Only set a flag for real cleanup
        let isCleanedUp = false;
        return () => {
            isCleanedUp = true;
            // Wait a bit to see if this is just StrictMode remounting
            setTimeout(() => {
                if (isCleanedUp && socketRef.current === newSocket) {
                    console.log(
                        "[Socket.IO] Cleaning up socket (real unmount)",
                    );
                    newSocket.disconnect();
                    socketRef.current = null;
                }
            }, 100);
        };
    }, [canConnect, isAuthenticated, user?.role, user?.is_settled]);

    const value: SocketContextValue = {
        socket,
        isConnected,
        error,
    };

    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    );
}

/** Hook to access socket context. Must be used within a SocketProvider. */
export function useSocket() {
    const context = useContext(SocketContext);
    if (context === undefined) {
        throw new Error("useSocket must be used within a SocketProvider");
    }
    return context;
}

/** Hook to listen to specific socket events. Automatically handles cleanup. */
export function useSocketEvent<T = unknown>(
    eventName: string,
    handler: (data: T) => void,
) {
    const { socket, isConnected } = useSocket();
    const handlerRef = useRef(handler);

    // Keep handler ref up to date
    useEffect(() => {
        handlerRef.current = handler;
    }, [handler]);

    useEffect(() => {
        if (!socket || !isConnected) return;

        const wrappedHandler = (data: T) => {
            handlerRef.current(data);
        };

        socket.on(eventName, wrappedHandler);

        return () => {
            socket.off(eventName, wrappedHandler);
        };
    }, [socket, isConnected, eventName]);
}

/** Hook to emit socket events. Returns a stable emit function. */
export function useSocketEmit() {
    const { socket } = useSocket();

    const emit = useCallback(
        <T = unknown,>(eventName: string, data?: T) => {
            if (!socket) {
                console.warn(
                    `Cannot emit "${eventName}": socket not connected`,
                );
                return;
            }
            socket.emit(eventName, data);
        },
        [socket],
    );

    return emit;
}
