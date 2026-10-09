/**
 * A Round's overview page (#1008): the player's balance sheet for the Round,
 * filling in as each of its Trading periods is settled. Players only: a
 * facilitator moderates rather than plays, so is sent back to the Workshop
 * home.
 */

import { createFileRoute, Navigate } from "@tanstack/react-router";

import { Spinner } from "@/components/ui/spinner";
import { TypographyMuted } from "@/components/ui/typography";
import { BalanceSheetView } from "@/components/workshop/balance-sheet";
import {
    useWorkshopBalanceSheet,
    useWorkshopEntry,
    useWorkshopSession,
} from "@/hooks/use-workshop";
import { ApiClientError } from "@/lib/api-client";

export const Route = createFileRoute("/app/workshop/round/$round/")({
    component: RoundOverviewPage,
    staticData: { title: "Round overview", runMode: "workshop", wide: true },
});

function RoundOverviewPage() {
    const { data: entry } = useWorkshopEntry();
    if (!entry) return <Loading />;
    if (entry.role !== "player") return <Navigate to="/app/workshop" replace />;
    return <PlayerRoundOverview />;
}

function PlayerRoundOverview() {
    const { round } = Route.useParams();
    const sheet = useWorkshopBalanceSheet(Number(round));
    const session = useWorkshopSession();
    const checkpoint = session.data?.checkpoint;
    const activeRound =
        checkpoint && "round" in checkpoint ? checkpoint.round : null;

    if (sheet.isError) {
        const noSuchRound =
            sheet.error instanceof ApiClientError && sheet.error.status === 404;
        return (
            <TypographyMuted>
                {noSuchRound
                    ? `The session has no Round ${round}.`
                    : "The balance sheet could not be loaded."}
            </TypographyMuted>
        );
    }
    // The session says which Round is active, which picks the period the
    // sheet opens on, so it is waited for too. If it cannot be read, the sheet
    // opens as for a past Round.
    if (sheet.isPending || session.isPending) return <Loading />;
    // Keyed by Round, so moving to another Round's sheet starts it afresh.
    return (
        <BalanceSheetView
            key={sheet.data.round}
            sheet={sheet.data}
            activeRound={activeRound}
        />
    );
}

function Loading() {
    return (
        <div className="flex justify-center py-12">
            <Spinner />
        </div>
    );
}
