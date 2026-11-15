/**
 * A Trading period's review page (#1007), with the switch to the Round's
 * balance sheet above it (#1250) and buttons to the previous and next seasons
 * in its margins (#1273).
 */

import { TypographyH2 } from "@energetica/ui/components/typography";
import { createFileRoute } from "@tanstack/react-router";

import { PeriodReview } from "@/components/period-review";
import { RoundViewSwitch } from "@/components/round-view-switch";
import { SeasonStepButtons } from "@/components/season-step-buttons";
import { WorkshopPlaceholder } from "@/components/workshop-placeholder";
import { isSeason, SEASON_LABELS } from "@/lib/workshop-timeline";

export const Route = createFileRoute("/_entered/_shell/round/$round/$season")({
    component: TradingPeriodPage,
    staticData: { title: "Trading period" },
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
        <div className="relative space-y-4">
            <SeasonStepButtons round={Number(round)} season={season} />
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
