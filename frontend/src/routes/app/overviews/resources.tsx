/**
 * Resources overview page - Stub redirecting to legacy page. TODO: Migrate to
 * React implementation.
 */

import { createFileRoute } from "@tanstack/react-router";

import { RedirectToLegacy } from "@/components/RedirectToLegacy";

export const Route = createFileRoute("/app/overviews/resources")({
    component: () => <RedirectToLegacy to="/production_overview/resources" />,

    staticData: {
        title: "Resources Overview",
        routeConfig: {
            requiredRole: "player",
            requiresSettledTile: true,
            isUnlocked: (cap) => cap.has_warehouse,
        },
    },
});
