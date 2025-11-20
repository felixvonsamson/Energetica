/**
 * Wiki introduction page - Redirects to legacy wiki.
 */

import { createFileRoute } from "@tanstack/react-router";
import { RedirectToLegacy } from "@/components/RedirectToLegacy";

export const Route = createFileRoute("/wiki/introduction")({
    component: () => <RedirectToLegacy to="/wiki/introduction" />,
    staticData: { title: "Game Wiki" },
});
