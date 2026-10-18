/**
 * A Trading period's review page (#1007), with the switch to the Round's
 * balance sheet above it (#1250).
 */

import { createFileRoute } from "@tanstack/react-router";

import { PeriodReview } from "@/components/workshop/period-review";
import { RoundViewSwitch } from "@/components/workshop/round-view-switch";
import { WorkshopPlaceholder } from "@/components/workshop/workshop-placeholder";
import { isSeason, SEASON_LABELS } from "@/lib/workshop-timeline";
import { TypographyH2 } from "@energetica/ui/components/typography";

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
            <RoundViewSwitch round={Number(round)} view="charts" />
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
