/** A Trading period's review page (#1007). */

import { createFileRoute } from "@tanstack/react-router";

import { TypographyH2 } from "@/components/ui/typography";
import { PeriodReview } from "@/components/workshop/period-review";
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
        <div className="space-y-4">
            <TypographyH2>
                Round {round} · {SEASON_LABELS[season]} trading
            </TypographyH2>
            <PeriodReview
                key={`${round}-${season}`}
                round={Number(round)}
                season={season}
            />
        </div>
    );
}
