/**
 * Facilitator roster page (#1022): the private instance's allowlist, plus a
 * search-and-add control and a ban/remove action per row, from
 * `@energetica/instance`.
 */

import {
    AddAccountCard,
    RosterCard,
} from "@energetica/instance/components/roster";
import { createFileRoute } from "@tanstack/react-router";

import { FacilitatorHeader } from "@/components/facilitator/facilitator-header";
import { getUserFriendlyError } from "@/lib/error-utils";

function PlayersHelp() {
    return (
        <div className="space-y-3">
            <p>
                This page lists every player allowed to enter this run, whether
                they have entered yet or not.
            </p>
            <p>
                Banning removes a player from this list, so their next attempt
                to enter is denied. It doesn't interrupt a session already in
                progress.
            </p>
        </div>
    );
}

export const Route = createFileRoute("/app/facilitator/players")({
    component: PlayersPage,
    staticData: {
        title: "Players",
        routeConfig: { requiredRole: "facilitator" },
        infoDialog: { contents: <PlayersHelp /> },
    },
});

function PlayersPage() {
    return (
        <div className="flex min-h-svh flex-col">
            <FacilitatorHeader />
            <main className="flex-1 overflow-auto p-4 md:p-8">
                <div className="max-w-2xl mx-auto space-y-6">
                    <AddAccountCard />
                    <RosterCard formatError={getUserFriendlyError} />
                </div>
            </main>
        </div>
    );
}
