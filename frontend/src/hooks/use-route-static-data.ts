import {
    LinkProps,
    StaticDataRouteOption,
    useRouter,
} from "@tanstack/react-router";

import type { UnlockStatus } from "@/router";
import type { Capabilities } from "@/types/players";

/**
 * Get the staticData for a route by its path. Uses the router's internal
 * routesByPath map for O(1) lookup.
 */
export function useRouteStaticData(
    to: LinkProps["to"],
): StaticDataRouteOption | null {
    const router = useRouter();
    if (!to) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pathStr = typeof to === "string" ? to : (to as any).pathname;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const route = (router as any).routesByPath?.[pathStr];

    if (!route) return null;
    return route.options?.staticData || null;
}

/** Check if a route is unlocked based on its capabilities. */
export function useRouteUnlocked(
    to: LinkProps["to"],
    capabilities: Capabilities | null | undefined,
): UnlockStatus {
    // Get the router instance to access the route data
    // Note: This hook must be called in a component context
    // For use outside components, use getRouteIsUnlockedFn directly with staticData
    const staticData = useRouteStaticData(to);
    if (!capabilities) return { unlocked: false, reason: "Loading..." };
    if (!staticData) return { unlocked: true };
    const routeConfig = staticData.routeConfig;
    if (!routeConfig || routeConfig.requiredRole !== "player")
        return { unlocked: true };
    return routeConfig.isUnlocked ? routeConfig.isUnlocked(capabilities) : { unlocked: true };
}
