/**
 * Network page - Stub redirecting to legacy page.
 * TODO: Migrate to React implementation.
 */

import { createFileRoute } from "@tanstack/react-router";
import { RedirectToLegacy } from "@/components/RedirectToLegacy";

export const Route = createFileRoute("/app/community/network")({
    component: () => <RedirectToLegacy to="/network" />,

    staticData: { title: "Redirecting..." },
});
