/** The recap that closes a Round. A placeholder until #1013 builds it. */

import { createFileRoute } from "@tanstack/react-router";

import { WorkshopPlaceholder } from "@/components/workshop/workshop-placeholder";

export const Route = createFileRoute("/app/workshop/recap/$round")({
    component: RecapPage,
    staticData: { title: "Recap", runMode: "workshop" },
});

function RecapPage() {
    const { round } = Route.useParams();
    return (
        <WorkshopPlaceholder title={`Round ${round} recap`}>
            The recap is not built yet.
        </WorkshopPlaceholder>
    );
}
