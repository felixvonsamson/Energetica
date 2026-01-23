/** Logout page - Clears session and redirects to login. */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { useAuth } from "@/hooks/useAuth";
import { authApi } from "@/lib/api/auth";
import { queryClient } from "@/lib/query-client";

function LogoutComponent() {
    const navigate = useNavigate();
    const { logout: clearAuthContext } = useAuth();

    useEffect(() => {
        const performLogout = async () => {
            try {
                // Call logout endpoint to clear cookie
                await authApi.logout();
            } catch (error) {
                // Even if logout fails, still clear local cache and redirect
                console.error("[LogoutComponent] Logout failed:", error);
            } finally {
                // Clear all cached data
                queryClient.clear();
                // Clear frontend auth state
                await clearAuthContext();
                // Redirect to login
                navigate({ to: "/app/login" });
            }
        };

        performLogout();
    }, [navigate, clearAuthContext]);

    return <div>Logging out...</div>;
}

export const Route = createFileRoute("/app/logout")({
    component: LogoutComponent,
    staticData: { title: "Logging out..." },
});
