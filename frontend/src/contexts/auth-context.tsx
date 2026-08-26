/**
 * Authentication context providing auth state throughout the app. Reads session
 * cookies and fetches user data from the backend.
 */

import { useQuery } from "@tanstack/react-query";
import { createContext, type ReactNode } from "react";

import { authApi } from "@/lib/api/auth";
import { ApiClientError } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-client";
import type { ApiSchema } from "@/types/api-helpers";

type User = ApiSchema<"UserOut">;

interface AuthContextValue {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(
    undefined,
);

export interface AuthProviderProps {
    children: ReactNode;
}

/**
 * Fetch the current user (the instance entry gate), or `null` if
 * unauthenticated.
 *
 * Exported (not inlined in `AuthProvider`'s `useQuery`) so `/app/`'s root
 * loader can resolve the same `queryKeys.auth.me` data through
 * `queryClient.ensureQueryData` — the loader needs the user's role _before_ the
 * app renders (to send an admin to `/app/facilitator` instead of the
 * player-only `/app/dashboard`, #1020), which a query only read from inside the
 * React tree can't guarantee has resolved yet.
 */
export async function fetchCurrentUser(): Promise<User | null> {
    try {
        return await authApi.me();
    } catch (err) {
        if (err instanceof ApiClientError && err.status === 401) {
            // Not authenticated - return null instead of throwing
            return null;
        }
        throw err;
    }
}

export function AuthProvider({ children }: AuthProviderProps) {
    const {
        data: user,
        isLoading,
        error,
        refetch,
    } = useQuery({
        queryKey: queryKeys.auth.me,
        queryFn: fetchCurrentUser,
        // Don't auto-refetch on window focus for auth - only refetch on invalidation
        refetchOnWindowFocus: false,
        // Keep auth data fresh indefinitely until explicitly invalidated
        staleTime: Infinity,
    });

    const value: AuthContextValue = {
        user: user ?? null,
        isAuthenticated: (user ?? null) !== null,
        isLoading,
        error: error instanceof Error ? error : null,
        refetch: async () => {
            await refetch();
        },
    };

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
}
