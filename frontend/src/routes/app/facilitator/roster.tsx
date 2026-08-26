/**
 * Facilitator roster page (#1022): the private instance's allowlist, split into
 * joined vs invited-not-yet-joined, plus a search-and-add control and a
 * ban/remove action per row.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { FacilitatorHeader } from "@/components/facilitator/facilitator-header";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    InfoBanner,
} from "@/components/ui";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { TypographyH2, TypographyMuted } from "@/components/ui/typography";
import {
    useAddToRoster,
    useFacilitatorRoster,
    useRemoveFromRoster,
    useRosterCandidates,
} from "@/hooks/use-facilitator-roster";
import { getUserFriendlyError } from "@/lib/error-utils";

function RosterHelp() {
    return (
        <div className="space-y-3">
            <p>
                <strong>Joined</strong> accounts have already entered this
                instance. <strong>Invited</strong> accounts are allowlisted but
                haven't shown up yet.
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
        routeConfig: { requiredRole: "admin" },
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

    return (
        <div className="space-y-6">
            <RosterSection
                title="Joined"
                usernames={data.joined}
                emptyLabel="No one has joined yet."
                onBan={removeFromRoster}
                pendingUsername={isPending ? pendingUsername : null}
            />
            <RosterSection
                title="Invited"
                usernames={data.invited}
                emptyLabel="No pending invites."
                onBan={removeFromRoster}
                pendingUsername={isPending ? pendingUsername : null}
            />
        </div>
    );
}

function RosterSection({
    title,
    usernames,
    emptyLabel,
    onBan,
    pendingUsername,
}: {
    title: string;
    usernames: string[];
    emptyLabel: string;
    onBan: (username: string) => void;
    pendingUsername: string | null;
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    <TypographyH2>
                        {title} ({usernames.length})
                    </TypographyH2>
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
                                <span className="text-sm">{username}</span>
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
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}
