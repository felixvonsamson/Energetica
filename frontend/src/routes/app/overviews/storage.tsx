/**
 * Storage overview page - Stub redirecting to legacy page.
 * TODO: Migrate to React implementation.
 */

import { createFileRoute } from "@tanstack/react-router";
import { RedirectToLegacy } from "@/components/RedirectToLegacy";

export const Route = createFileRoute("/app/overviews/storage")({
    component: () => <RedirectToLegacy to="/production_overview/storage" />,

    staticData: { title: "Redirecting..." },
});
