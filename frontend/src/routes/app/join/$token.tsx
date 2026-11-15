/**
 * Public join flow (#1021): link → confirm → enter. The page is assembled from
 * the parts in `@energetica/instance/components/join`.
 *
 * Anyone holding the link (with the token) can access this page.
 * `staticData.routeConfig` is `{ requiredRole: null }` so `__root.tsx`'s guard
 * leaves it alone regardless of auth state, which matters here: a visitor
 * mid-join has a valid SSO session but isn't access-allowed yet, a state
 * `fetchCurrentUser` deliberately reads as "unauthenticated" (see
 * `contexts/auth-context.tsx`) — this page renders its own state off
 * `useJoinLink` instead of `useAuth()`.
 *
 * Doesn't use `GameLayout`/`AppSidebar` (same reasoning as the facilitator page
 * — no settled player to render chrome around) or `GameLayout`'s sibling admin
 * shell.
 */

import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { getUserFriendlyError } from "@/lib/error-utils";
import { queryKeys } from "@/lib/query-client";
import { JoinCard, JoinHeader } from "@energetica/instance/components/join";
import { useJoinLink } from "@energetica/instance/hooks/use-join";

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

function JoinPage() {
    const { token } = Route.useParams();
    const { data } = useJoinLink(token);
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    // Once joined, `/app` re-resolves the now-passing entry gate, `GET /auth/me`, and lands the
    // visitor on their role-appropriate page — the same redirect any returning player gets, not a
    // special case for joining.
    const onJoined = async () => {
        await queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
        void navigate({ to: "/app" });
    };

    return (
        <div className="flex min-h-svh flex-col">
            <JoinHeader viewer={data?.viewer} />
            <main className="flex-1 overflow-auto p-4 md:p-8">
                <div className="max-w-xl mx-auto">
                    <JoinCard
                        token={token}
                        formatError={getUserFriendlyError}
                        onJoined={onJoined}
                        renderHomeLink={(label) => (
                            <Link to="/app">{label}</Link>
                        )}
                        renderFacilitatorLink={(label) => (
                            <Link to="/app/facilitator">{label}</Link>
                        )}
                    />
                </div>
            </main>
        </div>
    );
}
