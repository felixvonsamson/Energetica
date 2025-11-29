/**
 * Revenues overview page - Stub redirecting to legacy page. TODO: Migrate to
 * React implementation.
 */

import { createFileRoute } from "@tanstack/react-router";
import { RedirectToLegacy } from "@/components/RedirectToLegacy";

export const Route = createFileRoute("/app/overviews/revenues")({
    component: () => <RedirectToLegacy to="/production_overview/revenues" />,

    staticData: { title: "Redirecting..." },
});
