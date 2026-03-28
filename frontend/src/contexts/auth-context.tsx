/**
 * Authentication context providing auth state throughout the app. Reads session
 * cookies and fetches user data from the backend.
 */

import { useQuery } from "@tanstack/react-query";
import {
    createContext,
    useCallback,
    type ReactNode,
} from "react";

import { authApi } from "@/lib/api/auth";
import { ApiClientError } from "@/lib/api-client";
import { queryClient, queryKeys } from "@/lib/query-client";
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
    const {
        data: user,
        isLoading,
        error,
        refetch,
    } = useQuery({
        queryKey: queryKeys.auth.me,
        queryFn: async () => {
            try {
                return await authApi.me();
            } catch (err) {
                if (err instanceof ApiClientError && err.status === 401) {
                    // Not authenticated - return null instead of throwing
                    return null;
                }
                throw err;
            }
        },
        // Don't auto-refetch on window focus for auth - only refetch on invalidation
        refetchOnWindowFocus: false,
        // Keep auth data fresh indefinitely until explicitly invalidated
        staleTime: Infinity,
    });

    const logout = useCallback(() => {
        // Just clear the frontend state. The API logout is handled by the logout route.
        // Clear all cached queries
        queryClient.clear();
    }, []);

    const value: AuthContextValue = {
        user: user ?? null,
        isAuthenticated: (user ?? null) !== null,
        isLoading,
        error: error instanceof Error ? error : null,
        refetch: async () => {
            await refetch();
        },
        logout,
    };

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
}
