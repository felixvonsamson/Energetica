/**
 * The root route's role-gate: given the outgoing route's declared `routeConfig`
 * (`router.d.ts`) and the current user, decide whether to redirect them away —
 * and if so, where.
 *
 * Pure and side-effect-free so it's unit-testable without mounting the router —
 * `__root.tsx` renders nothing itself; it just fires the redirect this returns
 * from an effect. Callers only reach here once auth + capabilities are resolved
 * AND the user is authenticated; the unauthenticated case is a cross-origin
 * redirect to the lobby, decided separately in `__root.tsx`.
 */

import type { StaticDataRouteOption } from "@tanstack/react-router";

import type { Phase } from "@/lib/instances";
import type { ApiSchema } from "@/types/api-helpers";
import type { PlayerCapabilities } from "@/types/capabilities";

type User = ApiSchema<"UserOut">;

/**
 * Whether the announced-phase waiting screen (`__root.tsx`, #862) takes over
 * rendering instead of the requested route. A facilitator route (`requiredRole:
 * "facilitator"`) has no in-game session to wait on — inviting and managing the
 * roster (#1022) is exactly what a facilitator needs to do _before_ the run
 * starts — so it's exempt.
 */
export function isAnnouncedTakeover(
    routeConfig: StaticDataRouteOption["routeConfig"],
    phase: Phase | undefined,
): boolean {
    return phase === "announced" && routeConfig?.requiredRole !== "facilitator";
}

export function computeRedirect(
    routeConfig: StaticDataRouteOption["routeConfig"],
    user: User,
    capabilities: PlayerCapabilities | null,
): string | null {
    if (!routeConfig || routeConfig.requiredRole === null) return null;
    // A route declares one required role; an account whose own role doesn't match has nothing to
    // do here at all (not just "not settled yet" or "not unlocked yet") — sent to logout rather
    // than any in-app page, the same way an unauthenticated visitor leaves the app entirely.
    if (routeConfig.requiredRole !== user.role) return "/app/logout";

    const requiredRole = routeConfig.requiredRole;
    switch (requiredRole) {
        case "player":
            if (routeConfig.requiresSettledTile && !user.is_settled)
                return "/app/settle";
            if (!routeConfig.requiresSettledTile && user.is_settled)
                return "/app/dashboard";
            if (
                !capabilities ||
                (routeConfig.isUnlocked &&
                    !routeConfig.isUnlocked(capabilities).unlocked)
            )
                return "/app/dashboard";
            return null;
        case "facilitator":
            // The role check above is the whole gate: a facilitator route (#989) has no
            // settled-tile or capability-unlock concept the way a player route does.
            return null;
        default:
            throw requiredRole satisfies never;
    }
}
