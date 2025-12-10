/**
 * Emissions overview page - Stub redirecting to legacy page. TODO: Migrate to
 * React implementation.
 */

import { createFileRoute } from "@tanstack/react-router";
import { RedirectToLegacy } from "@/components/RedirectToLegacy";

export const Route = createFileRoute("/app/overviews/emissions")({
    component: () => <RedirectToLegacy to="/production_overview/emissions" />,

    staticData: {
        title: "Emissions Overview",
        routeConfig: {
            requiredRole: "player",
            requiresSettledTile: true,
            isUnlocked: (cap) => cap.has_greenhouse_gas_effect,
        },
    },
});
