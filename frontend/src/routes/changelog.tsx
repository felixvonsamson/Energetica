/** Changelog page - Redirects to legacy changelog. */

import { createFileRoute } from "@tanstack/react-router";

import { RedirectToLegacy } from "@/components/redirect-to-legacy";

export const Route = createFileRoute("/changelog")({
    component: () => <RedirectToLegacy to="/changelog" />,
    staticData: { title: "Changelog" },
});
