/**
 * Storage facilities page - Stub redirecting to legacy page.
 * TODO: Migrate to React implementation.
 */

import { createFileRoute } from "@tanstack/react-router";
import { RedirectToLegacy } from "@/components/RedirectToLegacy";

export const Route = createFileRoute("/app/facilities/storage")({
    component: () => <RedirectToLegacy to="/storage_facilities" />,

    staticData: { title: "Redirecting..." },
});
