import { createFileRoute } from "@tanstack/react-router";

import { WorkshopPage } from "@/components/workshop-page";

export const Route = createFileRoute("/workshop")({
    component: WorkshopPage,
    staticData: { title: "Workshops" },
    // PROTOTYPE (#1462): which facility-card showcase variant to show.
    validateSearch: (search: Record<string, unknown>): { variant?: string } =>
        typeof search.variant === "string" ? { variant: search.variant } : {},
});
