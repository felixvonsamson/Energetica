/** Protected route components for enforcing authentication and authorization. */

import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import type { ReactNode } from "react";

interface ProtectedRouteProps {
    children: ReactNode;
    /** Redirect path if not authenticated */
    redirectTo?: string;
    /** Show loading state while checking auth */
    fallback?: ReactNode;
}

/** Require user to be authenticated. Redirects to login if not authenticated. */
export function ProtectedRoute({
    children,
    redirectTo = "/login",
    fallback = <div>Loading...</div>,
}: ProtectedRouteProps) {
    const { isAuthenticated, isLoading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            navigate({ to: redirectTo });
        }
    }, [isLoading, isAuthenticated, redirectTo, navigate]);

    if (isLoading) {
        return <>{fallback}</>;
    }

    if (!isAuthenticated) {
        return <div>Redirecting to login...</div>;
    }

    return <>{children}</>;
}

/**
 * Require user to be a settled player (has chosen location). Redirects to
 * location choice if not settled.
 */
export function RequireSettledPlayer({
    children,
    fallback = <div>Loading...</div>,
}: ProtectedRouteProps) {
    const { user, isAuthenticated, isLoading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (isLoading) return;

        if (!isAuthenticated || !user || user.role !== "player") {
            console.log(
                "[REDIRECT] RequireSettledPlayer redirecting to /app/login",
                {
                    isAuthenticated,
                    user: user?.username,
                    role: user?.role,
                },
            );
            navigate({ to: "/app/login" });
            return;
        }

        if (!user.is_settled) {
            console.log(
                "[REDIRECT] RequireSettledPlayer redirecting to /app/settle",
                {
                    is_settled: user.is_settled,
                },
            );
            navigate({ to: "/app/settle" });
        }
    }, [isLoading, isAuthenticated, user, navigate]);

    if (isLoading) {
        return <>{fallback}</>;
    }

    if (!isAuthenticated || !user || user.role !== "player") {
        return <div>Redirecting to login...</div>;
    }

    if (!user.is_settled) {
        return <div>Redirecting to location choice...</div>;
    }

    return <>{children}</>;
}
