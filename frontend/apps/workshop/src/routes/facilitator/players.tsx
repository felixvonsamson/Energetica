/**
 * Facilitator roster page (#1022): the Run's allowlist, plus a search-and-add
 * control and a ban/remove action per row, from `@energetica/instance`. In a
 * Run with teams (#1384), the accounts are grouped by team, each showing how
 * many of its members have entered. The console links here (#1018).
 *
 * It renders outside the Workshop shell and its gate: the backend refuses its
 * calls to anyone but the facilitator.
 */

import {
    AddAccountCard,
    RosterCard,
    type LoadedRoster,
    RosterSection,
} from "@energetica/instance/components/roster";
import { createFileRoute } from "@tanstack/react-router";

import { FacilitatorHeader } from "@/components/facilitator-header";
import { useWorkshopSession } from "@/hooks/use-workshop";
import { getUserFriendlyError } from "@/lib/error-messages";
import type { ApiSchema } from "@/types/api-helpers";

export const Route = createFileRoute("/facilitator/players")({
    component: PlayersPage,
    staticData: { title: "Players" },
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
 * The roster, grouped by team in a Run with teams. The session is read as often
 * as the roster, since this page does not follow the session's socket.
 */
function PlayersList() {
    const { data: session } = useWorkshopSession({
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
