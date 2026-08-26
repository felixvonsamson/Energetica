/**
 * Public join flow (#1021): link → confirm → enter.
 *
 * The visitor-facing counterpart to #1020's facilitator page. Reachable by
 * anyone holding the link — `staticData.routeConfig` is `{ requiredRole: null
 * }` so `__root.tsx`'s guard leaves it alone regardless of auth state, which
 * matters here: a visitor mid-join has a valid SSO session but isn't
 * access-allowed yet, a state `fetchCurrentUser` deliberately reads as
 * "unauthenticated" (see `contexts/auth-context.tsx`) — this page renders its
 * own state off `useJoinLink` instead of `useAuth()`.
 *
 * Doesn't use `GameLayout`/`AppSidebar` (same reasoning as the facilitator page
 * — no settled player to render chrome around) or `GameLayout`'s sibling admin
 * shell (no "Log out" affordance makes sense for someone who may not even have
 * an account yet).
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import Logo from "@/assets/simplified_logo.svg?react";
import {
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    InfoBanner,
} from "@/components/ui";
import { Spinner } from "@/components/ui/spinner";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { TypographyH2, TypographyMuted } from "@/components/ui/typography";
import { useConfirmJoin, useJoinLink } from "@/hooks/use-join";
import { getUserFriendlyError } from "@/lib/error-utils";
import { lobbyLoginHref } from "@/lib/instances";
import { rememberPendingJoinToken } from "@/lib/join";

function JoinHelp() {
    return (
        <p>
            Someone shared this link (or its QR code) to invite you into a
            private Energetica instance. Confirming adds your account to that
            instance — nothing happens until you do.
        </p>
    );
}

export const Route = createFileRoute("/app/join/$token")({
    component: JoinPage,
    staticData: {
        title: "Join",
        routeConfig: { requiredRole: null },
        infoDialog: { contents: <JoinHelp /> },
    },
});

function JoinHeader() {
    return (
        <header className="shrink-0 flex h-(--topbar-height) items-center justify-between border-b border-border-brand bg-topbar px-4">
            <div className="flex items-center gap-1.5">
                <Logo className="size-10 fill-foreground" />
                <span className="font-titles text-lg">Energetica</span>
            </div>
            <ThemeToggle variant="icon-only" />
        </header>
    );
}

function JoinPage() {
    return (
        <div className="flex min-h-svh flex-col">
            <JoinHeader />
            <main className="flex-1 overflow-auto p-4 md:p-8">
                <div className="max-w-xl mx-auto">
                    <JoinCard />
                </div>
            </main>
        </div>
    );
}

function JoinCard() {
    const { token } = Route.useParams();
    const { data, isLoading, isError, error } = useJoinLink(token);

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

    if (!data.join_open) {
        return (
            <InfoBanner variant="warning">
                Joining <strong>{data.instance_name}</strong> is currently
                closed. Contact the administrator for an invitation.
            </InfoBanner>
        );
    }

    if (data.viewer_username === null) {
        return (
            <LogInToJoinCard instanceName={data.instance_name} token={token} />
        );
    }

    return <ConfirmJoinCard instanceName={data.instance_name} token={token} />;
}

function LogInToJoinCard({
    instanceName,
    token,
}: {
    instanceName: string;
    token: string;
}) {
    const handleLogIn = () => {
        // Survives the round trip through the lobby's login/signup (a different origin) so
        // `/app/`'s root loader can send the visitor straight back here afterwards — see `lib/join.ts`.
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
}: {
    instanceName: string;
    token: string;
}) {
    const navigate = useNavigate();
    const {
        mutate: confirmJoin,
        isPending,
        isSuccess,
        isError,
        error,
    } = useConfirmJoin(token);

    // Once confirmed, `/app` re-resolves the now-passing entry gate (`auth.me`, invalidated by
    // the mutation) and lands the visitor on their role-appropriate page — the same redirect any
    // returning player gets, not a special case for joining.
    useEffect(() => {
        if (isSuccess) {
            void navigate({ to: "/app" });
        }
    }, [isSuccess, navigate]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    <TypographyH2>Join {instanceName}?</TypographyH2>
                </CardTitle>
                <TypographyMuted>
                    You're signed in. Confirming adds your account to this
                    instance so you can play.
                </TypographyMuted>
            </CardHeader>
            <CardContent className="space-y-4">
                {isError && (
                    <InfoBanner variant="error">
                        {getUserFriendlyError(error)}
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
