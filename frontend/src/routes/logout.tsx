/**
 * Logout page - Redirects to legacy logout endpoint.
 */

import { createFileRoute } from "@tanstack/react-router";
import { RedirectToLegacy } from "@/components/RedirectToLegacy";

export const Route = createFileRoute("/logout")({
    component: () => <RedirectToLegacy to="/logout" />,
    staticData: { title: "Logging out..." },
});
