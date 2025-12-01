/** Protected route components for enforcing authentication and authorization. */

import { useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
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

    if (isLoading) {
        return <>{fallback}</>;
    }

    if (!isAuthenticated) {
        navigate({ to: redirectTo });
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

    if (isLoading) {
        return <>{fallback}</>;
    }

    if (!isAuthenticated) {
        navigate({ to: "/login" });
        return <div>Redirecting to login...</div>;
    }

    if (user?.role === "admin") {
        window.location.href = "/admin-dashboard";
        return <div>Redirecting...</div>;
    }

    if (!user?.is_settled) {
        navigate({ to: "/app/settle" });
        return <div>Redirecting to location choice...</div>;
    }

    return <>{children}</>;
}

/** Require user to be an admin. Redirects to home if not admin. */
export function RequireAdmin({
    children,
    fallback = <div>Loading...</div>,
}: ProtectedRouteProps) {
    const { user, isAuthenticated, isLoading } = useAuth();
    const navigate = useNavigate();

    if (isLoading) {
        return <>{fallback}</>;
    }

    if (!isAuthenticated) {
        navigate({ to: "/login" });
        return <div>Redirecting to login...</div>;
    }

    if (user?.role !== "admin") {
        window.location.href = "/home";
        return <div>Redirecting...</div>;
    }

    return <>{children}</>;
}

/**
 * Redirect authenticated users away from public pages. Useful for login/signup
 * pages.
 */
export function PublicOnlyRoute({
    children,
    fallback = <div>Loading...</div>,
}: ProtectedRouteProps) {
    const { user, isAuthenticated, isLoading } = useAuth();
    const navigate = useNavigate();

    if (isLoading) {
        return <>{fallback}</>;
    }

    if (isAuthenticated && user) {
        // Redirect based on user role and state
        if (user.role === "admin") {
            navigate({ to: "/admin-dashboard" });
        } else if (!user.is_settled) {
            navigate({ to: "/app/settle" });
        } else {
            window.location.href = "/home";
        }
        return <div>Redirecting...</div>;
    }

    return <>{children}</>;
}
