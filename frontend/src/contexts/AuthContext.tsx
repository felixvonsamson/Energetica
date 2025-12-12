/**
 * Authentication context providing auth state throughout the app. Reads session
 * cookies and fetches user data from the backend.
 */

import React, {
    createContext,
    useState,
    useEffect,
    useCallback,
    type ReactNode,
} from "react";

import { authApi } from "@/lib/api/auth";
import { ApiClientError } from "@/lib/api-client";
import { queryClient } from "@/lib/query-client";
import type { ApiSchema } from "@/types/api-helpers";

type User = ApiSchema<"UserOut">;

interface AuthContextValue {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
    logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(
    undefined,
);

export interface AuthProviderProps {
    children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const fetchUser = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            const userData = await authApi.me();
            setUser(userData);
        } catch (err) {
            if (err instanceof ApiClientError && err.status === 401) {
                // Not authenticated - this is expected for logged-out users
                setUser(null);
            } else {
                // Actual error
                setError(
                    err instanceof Error
                        ? err
                        : new Error("Failed to fetch user"),
                );
                setUser(null);
            }
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUser();
    }, [fetchUser]);

    const logout = useCallback(() => {
        // Just clear the frontend state. The API logout is handled by the logout route.
        setUser(null);
        setError(null);
        // Clear all cached queries
        queryClient.clear();
    }, []);

    const value: AuthContextValue = {
        user,
        isAuthenticated: user !== null,
        isLoading,
        error,
        refetch: fetchUser,
        logout,
    };

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
}
