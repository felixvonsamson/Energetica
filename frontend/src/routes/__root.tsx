import {
    createRootRoute,
    Outlet,
    useMatches,
    useNavigate,
} from "@tanstack/react-router";
import { useEffect } from "react";

import { useAuth } from "@/hooks/useAuth";
import { useCapabilities } from "@/hooks/useCapabilities";

export const Route = createRootRoute({
    staticData: { title: "", routeConfig: { requiredRole: null } },
    component: RootComponent,
    validateSearch: (
        search: Record<string, unknown>,
    ): {
        help?: "";
    } => ({
        help: search.help === "" ? "" : undefined,
    }),
});

function RootComponent() {
    const matches = useMatches();
    const navigate = useNavigate();
    const { user, isAuthenticated, isLoading } = useAuth();
    const capabilities = useCapabilities();
    const routeConfig = matches[matches.length - 1].staticData?.routeConfig;

    useEffect(() => {
        if (isLoading) return;

        if (!routeConfig || routeConfig.requiredRole === null) return;

        // Check user is authenticated
        if (!isAuthenticated || !user) {
            navigate({ to: "/app/login" });
            return;
        }

        // Check user has the correct role
        if (routeConfig.requiredRole !== user?.role) {
            navigate({ to: "/app/logout" });
            return;
        }

        const requiredRole = routeConfig.requiredRole;

        switch (requiredRole) {
            case "player":
                // Redirect according to settled status
                if (routeConfig.requiresSettledTile && !user.is_settled) {
                    navigate({ to: "/app/settle" });
                    return;
                }
                if (!routeConfig.requiresSettledTile && user.is_settled) {
                    navigate({ to: "/app/dashboard" });
                    return;
                }
                // Check page is unlocked
                if (!capabilities) return;
                const routeIsUnlocked = routeConfig.isUnlocked(capabilities);
                if (!routeIsUnlocked) {
                    navigate({ to: "/app/dashboard" });
                    return;
                }
                break;
            default:
                throw requiredRole satisfies never;
        }
    }, [
        matches,
        isLoading,
        isAuthenticated,
        user,
        capabilities,
        navigate,
        routeConfig,
    ]);

    if (isLoading || capabilities === undefined) return "Loading...";

    // Prevent rendering protected routes before redirect logic runs
    if (routeConfig && routeConfig.requiredRole !== null) {
        if (!isAuthenticated || !user) return "Loading...";
        if (routeConfig.requiredRole !== user?.role) return "Loading...";
        if (routeConfig.requiredRole === "player") {
            if (routeConfig.requiresSettledTile && !user.is_settled)
                return "Loading...";
            if (!routeConfig.requiresSettledTile && user.is_settled)
                return "Loading...";
            if (capabilities === null) return "Loading...";
            const routeIsUnlocked = routeConfig.isUnlocked(capabilities);
            if (!routeIsUnlocked) return "Loading...";
        }
    }

    return <Outlet />;
}
