/**
 * Public join flow (#1021): link → confirm → enter, through which a private Run
 * admits a player (#995). The page is assembled from the parts in
 * `@energetica/instance/components/join`.
 *
 * Anyone holding the link (with the token) can open this page, so it renders
 * outside the gate that enters the Run: a visitor mid-join has a valid session
 * but is not on the roster yet, so entering would refuse them. The page renders
 * its own state off `useJoinLink` instead.
 */

import { JoinCard, JoinHeader } from "@energetica/instance/components/join";
import { useJoinLink } from "@energetica/instance/hooks/use-join";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { getUserFriendlyError } from "@/lib/error-messages";
import { queryKeys } from "@/lib/query-client";

export const Route = createFileRoute("/join/$token")({
    component: JoinPage,
    staticData: { title: "Join" },
});

function JoinPage() {
    const { token } = Route.useParams();
    const { data } = useJoinLink(token);
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    // Once joined, the home re-enters the Run, which now admits the visitor, and lands them on
    // the page for where the session is: the same redirect any returning player gets.
    const onJoined = async () => {
        await queryClient.invalidateQueries({
            queryKey: queryKeys.workshop.entry,
        });
        void navigate({ to: "/" });
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
                        renderHomeLink={(label) => <Link to="/">{label}</Link>}
                        renderFacilitatorLink={(label) => (
                            <Link to="/facilitator">{label}</Link>
                        )}
                    />
                </div>
            </main>
        </div>
    );
}
