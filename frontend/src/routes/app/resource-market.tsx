/**
 * Resource market page - Stub redirecting to legacy page.
 * TODO: Migrate to React implementation.
 */

import { createFileRoute } from "@tanstack/react-router";
import { RedirectToLegacy } from "@/components/RedirectToLegacy";

export const Route = createFileRoute("/app/resource-market")({
    component: () => <RedirectToLegacy to="/resource_market" />,

    staticData: { title: "Redirecting..." },
});
