/**
 * Parts of the public join page (#1021): link → confirm → enter.
 *
 * The visitor-facing counterpart to the facilitator's join-link page. Anyone
 * holding the link (with the token) can open it, so the app must not guard it
 * by role. That matters here: a visitor mid-join has a valid SSO session but
 * isn't access-allowed yet, which the app's own auth state may read as "not
 * logged in". These parts read the visitor's state from `useJoinLink` instead.
 */

import { lobbyLoginHref } from "@energetica/core/instances";
import { Button } from "@energetica/ui/components/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@energetica/ui/components/card";
import { InfoBanner } from "@energetica/ui/components/info-banner";
import { Spinner } from "@energetica/ui/components/spinner";
import { ThemeToggle } from "@energetica/ui/components/theme-toggle";
import {
    TypographyH2,
    TypographyMuted,
} from "@energetica/ui/components/typography";
import type { ReactElement, ReactNode } from "react";

import { LogOutButton, TopBar, TopBarLogo } from "#instance/components/top-bar";
import { useConfirmJoin, useJoinLink } from "#instance/hooks/use-join";
import type { FormatError } from "#instance/lib/format-error";
import { rememberPendingJoinToken } from "#instance/lib/join";
import type { ApiSchema } from "@api";

type Viewer = ApiSchema<"Viewer">;

/** Renders a link to one of the app's pages, labelled `label`. */
export type RenderLink = (label: ReactNode) => ReactElement;

/**
 * The join page's top bar. It shows "Signed in as X" and a "Log out" button
 * only once the visitor has a session (`viewer` is non-null): before that, no
 * identity exists yet to log out of.
 */
export function JoinHeader({ viewer }: { viewer?: Viewer | null }) {
    return (
        <TopBar>
            <TopBarLogo />
            <div className="flex items-center gap-3">
                {viewer && (
                    <>
                        <span className="text-sm text-muted-foreground">
                            Signed in as{" "}
                            <span className="font-medium text-foreground">
                                {viewer.username}
                            </span>
                        </span>
                        <LogOutButton size="sm" />
                    </>
                )}
                <ThemeToggle variant="icon-only" />
            </div>
        </TopBar>
    );
}

interface JoinCardProps {
    token: string;
    formatError: FormatError;
    /**
     * Runs once the visitor has joined. The app re-reads whatever its entry
     * gate depends on and takes the visitor into the app. The join button keeps
     * spinning until the promise it returns settles.
     */
    onJoined: () => void | Promise<void>;
    /** A link to the app's home page, for a visitor who already joined. */
    renderHomeLink: RenderLink;
    /** A link to the facilitator's join-link page, for a facilitator. */
    renderFacilitatorLink: RenderLink;
}

/** What the visitor can do with this join link, as one card. */
export function JoinCard({
    token,
    formatError,
    onJoined,
    renderHomeLink,
    renderFacilitatorLink,
}: JoinCardProps) {
    const { data, isLoading, isError, error } = useJoinLink(token);

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

    // A facilitator, or a player who already joined, sees the same card whether or not the
    // join link is still open.
    if (data.viewer?.membership === "facilitator") {
        return (
            <AlreadyFacilitatorCard
                instanceName={data.instance_name}
                renderFacilitatorLink={renderFacilitatorLink}
            />
        );
    }

    if (data.viewer?.membership === "player") {
        return (
            <AlreadyMemberCard
                instanceName={data.instance_name}
                renderHomeLink={renderHomeLink}
            />
        );
    }

    if (!data.join_open) {
        return (
            <InfoBanner variant="warning">
                Joining <strong>{data.instance_name}</strong> is currently
                closed. Contact the administrator for an invitation.
            </InfoBanner>
        );
    }

    if (data.viewer === null) {
        return (
            <LogInToJoinCard instanceName={data.instance_name} token={token} />
        );
    }

    return (
        <ConfirmJoinCard
            instanceName={data.instance_name}
            token={token}
            formatError={formatError}
            onJoined={onJoined}
        />
    );
}

function LogInToJoinCard({
    instanceName,
    token,
}: {
    instanceName: string;
    token: string;
}) {
    const handleLogIn = () => {
        // Survives the round trip through the lobby's login/signup (a different origin) so the
        // app's home page can send the visitor straight back here afterwards — see `lib/join.ts`.
        rememberPendingJoinToken(token);
        window.location.assign(lobbyLoginHref());
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    <TypographyH2>Join {instanceName}</TypographyH2>
                </CardTitle>
                <TypographyMuted>
                    Log in or create an account to join this instance.
                </TypographyMuted>
            </CardHeader>
            <CardContent>
                <Button onClick={handleLogIn} className="w-full" size="lg">
                    Log in to join
                </Button>
            </CardContent>
        </Card>
    );
}

function ConfirmJoinCard({
    instanceName,
    token,
    formatError,
    onJoined,
}: {
    instanceName: string;
    token: string;
    formatError: FormatError;
    onJoined: () => void | Promise<void>;
}) {
    const {
        mutate: confirmJoin,
        isPending,
        isSuccess,
        isError,
        error,
    } = useConfirmJoin(token, { onJoined });

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    <TypographyH2>Join {instanceName}?</TypographyH2>
                </CardTitle>
                <TypographyMuted>
                    Join this instance to start playing.
                </TypographyMuted>
            </CardHeader>
            <CardContent className="space-y-4">
                {isError && (
                    <InfoBanner variant="error">
                        {formatError(error)}
                    </InfoBanner>
                )}
                <Button
                    onClick={() => confirmJoin()}
                    disabled={isPending || isSuccess}
                    className="w-full flex items-center justify-center gap-2"
                    size="lg"
                >
                    {(isPending || isSuccess) && <Spinner />}
                    Join {instanceName}
                </Button>
            </CardContent>
        </Card>
    );
}

function AlreadyMemberCard({
    instanceName,
    renderHomeLink,
}: {
    instanceName: string;
    renderHomeLink: RenderLink;
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    <TypographyH2>
                        You're already in {instanceName}
                    </TypographyH2>
                </CardTitle>
                <TypographyMuted>
                    You have already joined this instance.
                </TypographyMuted>
            </CardHeader>
            <CardContent>
                <Button asChild className="w-full" size="lg">
                    {renderHomeLink("Go to instance")}
                </Button>
            </CardContent>
        </Card>
    );
}

function AlreadyFacilitatorCard({
    instanceName,
    renderFacilitatorLink,
}: {
    instanceName: string;
    renderFacilitatorLink: RenderLink;
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    <TypographyH2>Join link for {instanceName}</TypographyH2>
                </CardTitle>
                <TypographyMuted>
                    The join link for this instance is currently enabled. Share
                    this page's URL to players so they can join this instance.
                </TypographyMuted>
            </CardHeader>
            <CardContent>
                <Button asChild className="w-full" size="lg">
                    {renderFacilitatorLink("Back to facilitator dashboard")}
                </Button>
            </CardContent>
        </Card>
    );
}
