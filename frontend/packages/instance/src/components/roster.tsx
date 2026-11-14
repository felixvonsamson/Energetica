/**
 * Parts of the facilitator's roster page (#1022): the private instance's
 * allowlist, a search-and-add control, and a ban/remove action per row.
 */

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
import { type ReactNode, useEffect, useState } from "react";

import {
    useAddToRoster,
    useFacilitatorRoster,
    useRemoveFromRoster,
    useRosterCandidates,
} from "#instance/hooks/use-facilitator-roster";

export function AddAccountCard() {
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

/** The loaded roster, and what a section listing its members needs. */
export interface RosterMembers {
    /** Every account allowed to enter the instance. */
    members: string[];
    onBan: (username: string) => void;
    /** The username being banned right now, if any. */
    pendingUsername: string | null;
}

interface RosterCardProps {
    /** Turns an API error into a message for the facilitator. */
    formatError: (error: unknown) => string;
    /**
     * Lists the members in the app's own way, such as grouped by team. By
     * default they are listed in one section.
     */
    renderMembers?: (roster: RosterMembers) => ReactNode;
}

/** The roster, once loaded, listed by `renderMembers`. */
export function RosterCard({ formatError, renderMembers }: RosterCardProps) {
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
        return <InfoBanner variant="error">{formatError(error)}</InfoBanner>;
    }

    const roster: RosterMembers = {
        members: data.members,
        onBan: removeFromRoster,
        pendingUsername: isPending ? pendingUsername : null,
    };
    if (renderMembers) return renderMembers(roster);

    return (
        <RosterSection
            title={`Members (${data.members.length})`}
            usernames={data.members}
            emptyLabel="No one is on the roster yet."
            onBan={roster.onBan}
            pendingUsername={roster.pendingUsername}
        />
    );
}

export function RosterSection({
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
    /** Shown when no one is listed. A list that cannot be empty needs none. */
    emptyLabel?: string;
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
