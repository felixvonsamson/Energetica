/**
 * A Round's overview page (#1008): the player's balance sheet for the Round,
 * filling in as each of its Trading periods is settled. It is where players
 * land in the Investment phase, so in a Round that holds a carbon tax vote, the
 * ballot shows above the sheet while the phase is open (#1014). Players only: a
 * facilitator runs the session rather than plays, so is sent back to the
 * Workshop home.
 */

import { createFileRoute, Navigate } from "@tanstack/react-router";

import { BalanceSheetView } from "@/components/workshop/balance-sheet";
import { CarbonTaxBallot } from "@/components/workshop/carbon-tax-vote";
import {
    useWorkshopBalanceSheet,
    useWorkshopEntry,
    useWorkshopSession,
} from "@/hooks/use-workshop";
import { ApiClientError } from "@energetica/core/api-client";
import { Spinner } from "@energetica/ui/components/spinner";
import { TypographyMuted } from "@energetica/ui/components/typography";

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
        <div className="space-y-6">
            {/* The vote is the current Round's, so a past Round's page leaves it out. */}
            {sheet.data.round === activeRound && <CarbonTaxBallot />}
            <BalanceSheetView
                key={sheet.data.round}
                sheet={sheet.data}
                activeRound={activeRound}
            />
        </div>
    );
}

function Loading() {
    return (
        <div className="flex justify-center py-12">
            <Spinner />
        </div>
    );
}
