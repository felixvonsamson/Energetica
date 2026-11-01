import { createFileRoute } from "@tanstack/react-router";

import { WorkshopPage } from "@/components/workshop-page";

export const Route = createFileRoute("/workshop")({
    component: WorkshopPage,
    staticData: { title: "Workshops" },
});
