/**
 * The switch at the top of a Round's pages (#1250): it moves a player between a
 * season's charts (the Trading period's review) and the Round's balance sheet.
 * The timeline links still lead to both.
 *
 * From the balance sheet, the charts open on the latest Trading period of the
 * Round the session has reached. Until the Round's first one opens there are no
 * charts, so that side of the switch is disabled. A facilitator has no balance
 * sheet, so sees no switch.
 */

import { useNavigate } from "@tanstack/react-router";

import {
    SegmentedPicker,
    SegmentedPickerOption,
} from "@/components/ui/segmented-picker";
import { useWorkshopEntry, useWorkshopSession } from "@/hooks/use-workshop";
import {
    latestSeason,
    roundPage,
    tradingPeriodPage,
    workshopTimeline,
} from "@/lib/workshop-timeline";

type RoundView = "charts" | "balance_sheet";

export function RoundViewSwitch({
    round,
    view,
}: {
    round: number;
    view: RoundView;
}) {
    const navigate = useNavigate();
    const { data: entry } = useWorkshopEntry();
    const { data: session } = useWorkshopSession();
    if (entry?.role !== "player" || !session) return null;

    const timelineRound = workshopTimeline(
        session.checkpoint,
        session.round_count,
        session.blackouts,
    ).find((candidate) => candidate.round === round);
    if (!timelineRound) return null;
    const season = latestSeason(timelineRound);

    function onValueChange(next: RoundView) {
        if (next === view) return;
        if (next === "balance_sheet") void navigate(roundPage(round));
        else if (season) void navigate(tradingPeriodPage(round, season));
    }

    return (
        <SegmentedPicker
            value={view}
            onValueChange={onValueChange}
            activationMode="manual"
        >
            <SegmentedPickerOption value="charts" disabled={!season}>
                Charts
            </SegmentedPickerOption>
            <SegmentedPickerOption value="balance_sheet">
                Balance sheet
            </SegmentedPickerOption>
        </SegmentedPicker>
    );
}
