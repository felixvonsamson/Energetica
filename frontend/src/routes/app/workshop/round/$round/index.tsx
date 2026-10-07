/** A Round's overview page. A placeholder until #1008 builds it. */

import { createFileRoute } from "@tanstack/react-router";

import { WorkshopPlaceholder } from "@/components/workshop/workshop-placeholder";

export const Route = createFileRoute("/app/workshop/round/$round/")({
    component: RoundOverviewPage,
    staticData: { title: "Round overview", runMode: "workshop" },
});

function RoundOverviewPage() {
    const { round } = Route.useParams();
    return (
        <WorkshopPlaceholder title={`Round ${round}`}>
            The Round overview is not built yet.
        </WorkshopPlaceholder>
    );
}
