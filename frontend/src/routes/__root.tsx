import {
    createRootRoute,
    Outlet,
    type StaticDataRouteOption,
    useMatches,
    useNavigate,
} from "@tanstack/react-router";
import { useEffect } from "react";

import { useAuth } from "@/hooks/use-auth";
import { useCapabilities } from "@/hooks/use-capabilities";
import type { ApiSchema } from "@/types/api-helpers";
import type { PlayerCapabilities } from "@/types/capabilities";

type User = ApiSchema<"UserOut">;

/**
 * Determines the redirect target for the current route config.
 *
 * Called only when auth and capabilities are fully loaded. Returns null if the
 * current route is accessible, or a path string if a redirect is required.
 */
function computeRedirect(
    routeConfig: StaticDataRouteOption["routeConfig"],
    user: User | null,
    isAuthenticated: boolean,
    capabilities: PlayerCapabilities | null,
): string | null {
    if (!routeConfig || routeConfig.requiredRole === null) return null;
    if (!isAuthenticated || !user) return "/app/login";
    if (routeConfig.requiredRole !== user.role) return "/app/logout";

    const requiredRole = routeConfig.requiredRole;
    switch (requiredRole) {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        case "player":
            if (routeConfig.requiresSettledTile && !user.is_settled)
                return "/app/settle";
            if (!routeConfig.requiresSettledTile && user.is_settled)
                return "/app/dashboard";
            if (!capabilities || !routeConfig.isUnlocked(capabilities).unlocked)
                return "/app/dashboard";
            return null;
        default:
            throw requiredRole satisfies never;
    }
}

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
    const staticData = matches[matches.length - 1]?.staticData;
    const routeConfig = staticData?.routeConfig;

    // Only compute redirect once auth and capabilities are resolved.
    const redirectTo =
        !isLoading && capabilities !== undefined
            ? computeRedirect(routeConfig, user, isAuthenticated, capabilities)
            : null;

    useEffect(() => {
        if (redirectTo) void navigate({ to: redirectTo });
    }, [redirectTo, navigate]);

    if (staticData === undefined) return "Unknown page";
    if (isLoading) return "isLoading (useAuth())";
    if (capabilities === undefined) return "capabilities === undefined";
    // Block rendering until the redirect from the effect fires.
    if (redirectTo) return null;

    return <Outlet />;
}
