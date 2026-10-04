/** A Trading period's review page. A placeholder until #1007 builds it. */

import { createFileRoute } from "@tanstack/react-router";

import { WorkshopPlaceholder } from "@/components/workshop/workshop-placeholder";
import { isSeason, SEASON_LABELS } from "@/lib/workshop-timeline";

export const Route = createFileRoute("/app/workshop/round/$round/$season")({
    component: TradingPeriodPage,
    staticData: { title: "Trading period", runMode: "workshop" },
});

function TradingPeriodPage() {
    const { round, season } = Route.useParams();
    if (!isSeason(season)) {
        return (
            <WorkshopPlaceholder title="Unknown Trading period">
                There is no season called “{season}”.
            </WorkshopPlaceholder>
        );
    }
    return (
        <WorkshopPlaceholder
            title={`Round ${round} · ${SEASON_LABELS[season]} trading`}
        >
            The Trading period review is not built yet.
        </WorkshopPlaceholder>
    );
}
