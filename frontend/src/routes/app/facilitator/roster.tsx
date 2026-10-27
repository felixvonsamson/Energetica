/**
 * Facilitator roster page (#1022): the private instance's allowlist, plus a
 * search-and-add control and a ban/remove action per row. In a Workshop Run
 * with teams (#1384), the accounts are grouped by team, each showing how many
 * of its members have entered.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { FacilitatorHeader } from "@/components/facilitator/facilitator-header";
import {
    useAddToRoster,
    useFacilitatorRoster,
    useRemoveFromRoster,
    useRosterCandidates,
} from "@/hooks/use-facilitator-roster";
import { useRunMode } from "@/hooks/use-run-mode";
import { useWorkshopSession } from "@/hooks/use-workshop";
import { getUserFriendlyError } from "@/lib/error-utils";
import type { ApiSchema } from "@/types/api-helpers";
import { Button } from "@energetica/ui/components/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@energetica/ui/components/card";
import { ConfirmDialog } from "@energetica/ui/components/confirm-dialog";
import { InfoBanner } from "@energetica/ui/components/info-banner";
import { Input } from "@energetica/ui/components/input";
import { Spinner } from "@energetica/ui/components/spinner";
import {
    TypographyH2,
    TypographyMuted,
} from "@energetica/ui/components/typography";

function RosterHelp() {
    return (
        <div className="space-y-3">
            <p>
                The roster lists every account allowed to enter this instance,
                whether it has entered yet or not.
            </p>
            <p>
                Banning removes an account from the allowlist — its next entry
                attempt is denied. It doesn't interrupt a session already in
                progress.
            </p>
        </div>
    );
}

export const Route = createFileRoute("/app/facilitator/roster")({
    component: RosterPage,
    staticData: {
        title: "Roster",
        // Shown in a Workshop Run too, where the console links here (#1018). Without it, the
        // Workshop's route guard sends every page that is not a Workshop page back to the Workshop
        // home. The backend refuses anyone but the facilitator.
        runMode: "any",
        routeConfig: { requiredRole: "facilitator" },
        infoDialog: { contents: <RosterHelp /> },
    },
});

function RosterPage() {
    return (
        <div className="flex min-h-svh flex-col">
            <FacilitatorHeader />
            <main className="flex-1 overflow-auto p-4 md:p-8">
                <div className="max-w-2xl mx-auto space-y-6">
                    <AddAccountCard />
                    <RosterCard />
                </div>
            </main>
        </div>
    );
}

function AddAccountCard() {
    const [query, setQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");

    // Debounce the search-as-you-type prefix so every keystroke doesn't fire a request.
    useEffect(() => {
        const timeout = setTimeout(() => setDebouncedQuery(query.trim()), 300);
        return () => clearTimeout(timeout);
    }, [query]);

    const { data, isFetching } = useRosterCandidates(debouncedQuery);
    const {
        mutate: addToRoster,
        isPending,
        variables: pendingUsername,
    } = useAddToRoster();

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    <TypographyH2>Add to roster</TypographyH2>
                </CardTitle>
                <TypographyMuted>
                    Search for an existing account by username and add it to
                    this instance's allowlist.
                </TypographyMuted>
            </CardHeader>
            <CardContent className="space-y-3">
                <Input
                    placeholder="Search by username…"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                />
                {debouncedQuery.length > 0 && (
                    <div className="divide-y rounded-md border">
                        {isFetching && !data ? (
                            <div className="flex justify-center p-3">
                                <Spinner />
                            </div>
                        ) : data && data.usernames.length > 0 ? (
                            data.usernames.map((username) => (
                                <div
                                    key={username}
                                    className="flex items-center justify-between px-3 py-2"
                                >
                                    <span className="text-sm">{username}</span>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={
                                            isPending &&
                                            pendingUsername === username
                                        }
                                        onClick={() => addToRoster(username)}
                                    >
                                        {isPending &&
                                        pendingUsername === username ? (
                                            <Spinner />
                                        ) : (
                                            "Add"
                                        )}
                                    </Button>
                                </div>
                            ))
                        ) : (
                            <p className="px-3 py-2 text-sm text-muted-foreground">
                                No matching accounts.
                            </p>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function RosterCard() {
    const { data, isLoading, isError, error } = useFacilitatorRoster();
    const { data: runMode } = useRunMode();
    // Read as often as the roster, since this page does not follow the session's socket.
    const { data: session } = useWorkshopSession({
        enabled: runMode === "workshop",
        refetchInterval: 5 * 1000,
    });
    const {
        mutate: removeFromRoster,
        isPending,
        variables: pendingUsername,
    } = useRemoveFromRoster();

    if (isLoading) {
        return (
            <div className="flex justify-center py-12">
                <Spinner />
            </div>
        );
    }

    if (isError || !data) {
        return (
            <InfoBanner variant="error">
                {getUserFriendlyError(error)}
            </InfoBanner>
        );
    }

    const pending = isPending ? pendingUsername : null;
    if (session?.teams) {
        return (
            <TeamSections
                teams={session.teams}
                players={session.players}
                members={data.members}
                onBan={removeFromRoster}
                pendingUsername={pending}
            />
        );
    }

    return (
        <RosterSection
            title={`Members (${data.members.length})`}
            usernames={data.members}
            emptyLabel="No one is on the roster yet."
            onBan={removeFromRoster}
            pendingUsername={pending}
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
}: {
    teams: ApiSchema<"WorkshopTeamOut">[];
    players: ApiSchema<"WorkshopMemberOut">[];
    members: string[];
    onBan: (username: string) => void;
    pendingUsername: string | null;
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
                        emptyLabel=""
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
                    emptyLabel=""
                    onBan={onBan}
                    pendingUsername={pendingUsername}
                />
            )}
        </>
    );
}

function RosterSection({
    title,
    usernames,
    emptyLabel,
    entered,
    canBan = () => true,
    onBan,
    pendingUsername,
}: {
    title: string;
    usernames: string[];
    emptyLabel: string;
    /**
     * The usernames that have entered the Run, marked as such. Unmarked when
     * absent.
     */
    entered?: Set<string>;
    canBan?: (username: string) => boolean;
    onBan: (username: string) => void;
    pendingUsername: string | null;
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    <TypographyH2>{title}</TypographyH2>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {usernames.length === 0 ? (
                    <TypographyMuted>{emptyLabel}</TypographyMuted>
                ) : (
                    <ul className="divide-y">
                        {usernames.map((username) => (
                            <li
                                key={username}
                                className="flex items-center justify-between py-2"
                            >
                                <span className="text-sm">
                                    {username}
                                    {entered && (
                                        <span className="text-muted-foreground">
                                            {entered.has(username)
                                                ? " · entered"
                                                : " · not entered"}
                                        </span>
                                    )}
                                </span>
                                {canBan(username) && (
                                    <ConfirmDialog
                                        trigger={
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                disabled={
                                                    pendingUsername === username
                                                }
                                            >
                                                Ban
                                            </Button>
                                        }
                                        title={`Ban ${username}?`}
                                        description={`This removes ${username} from the allowlist. Their next entry attempt is denied — a session already in progress isn't interrupted.`}
                                        confirmLabel="Ban"
                                        variant="danger"
                                        isPending={pendingUsername === username}
                                        onConfirm={() => onBan(username)}
                                    />
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}
