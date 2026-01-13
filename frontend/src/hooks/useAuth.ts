/**
 * Hook to access authentication context. Must be used within an AuthProvider.
 *
 * Returns the current user and authentication state.
 *
 * @example
 *     const { user, isAuthenticated } = useAuth();
 *     if (user?.player_id) {
 *         // Use current player ID
 *     }
 *
 * @throws {Error} If used outside of AuthProvider
 */

import { useContext } from "react";

import { AuthContext } from "@/contexts/auth-context";

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
