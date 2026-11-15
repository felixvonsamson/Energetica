/**
 * Facilitator roster page (#1022): the private instance's allowlist, plus a
 * search-and-add control and a ban/remove action per row, from
 * `@energetica/instance`. In a Workshop Run with teams (#1384), the accounts
 * are grouped by team, each showing how many of its members have entered.
 */

import { createFileRoute } from "@tanstack/react-router";

import { FacilitatorHeader } from "@/components/facilitator/facilitator-header";
import { useRunMode } from "@/hooks/use-run-mode";
import { useWorkshopSession } from "@/hooks/use-workshop";
import { getUserFriendlyError } from "@/lib/error-utils";
import type { ApiSchema } from "@/types/api-helpers";
import {
    AddAccountCard,
    RosterCard,
    type LoadedRoster,
    RosterSection,
} from "@energetica/instance/components/roster";

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
        // Shown in a Workshop Run too, where the console links here (#1018). Without it, the
        // Workshop's route guard sends every page that is not a Workshop page back to the Workshop
        // home. The backend refuses anyone but the facilitator.
        runMode: "any",
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
                    <PlayersList />
                </div>
            </main>
        </div>
    );
}

/**
 * The roster, grouped by team in a Workshop Run with teams. The session is read
 * as often as the roster, since this page does not follow the session's
 * socket.
 */
function PlayersList() {
    const { data: runMode } = useRunMode();
    const { data: session } = useWorkshopSession({
        enabled: runMode === "workshop",
        refetchInterval: 5 * 1000,
    });
    const teams = session?.teams;
    const players = session?.players ?? [];
    return (
        <RosterCard
            formatError={getUserFriendlyError}
            renderMembers={
                teams
                    ? (roster) => (
                          <TeamSections
                              teams={teams}
                              players={players}
                              {...roster}
                          />
                      )
                    : undefined
            }
        />
    );
}

/**
 * One section per team, titled with how many of its members have entered, then
 * any account on the roster but on no team. Only an account on the roster can
 * be banned. A team can be incomplete when the session starts.
 */
function TeamSections({
    teams,
    players,
    members,
    onBan,
    pendingUsername,
}: LoadedRoster & {
    teams: ApiSchema<"WorkshopTeamOut">[];
    players: ApiSchema<"WorkshopMemberOut">[];
}) {
    const entered = new Set(players.map((player) => player.username));
    const onRoster = new Set(members);
    const onTeam = new Set(teams.flatMap((team) => team.members));
    const noTeam = members.filter((username) => !onTeam.has(username));
    return (
        <>
            {teams.map((team) => {
                const count = players.filter(
                    (player) => player.team === team.name,
                ).length;
                return (
                    <RosterSection
                        key={team.name}
                        title={`${team.name} ${count}/${team.members.length}`}
                        usernames={team.members}
                        entered={entered}
                        canBan={(username) => onRoster.has(username)}
                        onBan={onBan}
                        pendingUsername={pendingUsername}
                    />
                );
            })}
            {noTeam.length > 0 && (
                <RosterSection
                    title={`On no team (${noTeam.length})`}
                    usernames={noTeam}
                    onBan={onBan}
                    pendingUsername={pendingUsername}
                />
            )}
        </>
    );
}
