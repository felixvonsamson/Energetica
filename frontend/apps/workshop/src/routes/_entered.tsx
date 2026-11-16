/**
 * The gate in front of the Run's pages (#995): the visitor enters the Run
 * through `POST /workshop:enter`, and one who may not is sent to the lobby to
 * log in. The join page and the facilitator pages sit outside it: a visitor on
 * the join page has not been admitted yet, and the backend refuses the
 * facilitator pages' calls to anyone but the facilitator.
 */

import { lobbyHref, lobbyLoginHref } from "@energetica/core/instances";
import { isSingleOriginHost } from "@energetica/core/single-origin";
import { LogOutButton } from "@energetica/instance/components/top-bar";
import { takePendingJoinToken } from "@energetica/instance/lib/join";
import { Button } from "@energetica/ui/components/button";
import { Spinner } from "@energetica/ui/components/spinner";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";

import { useWorkshopEntry } from "@/hooks/use-workshop";
import { getUserFriendlyError, isErrorType } from "@/lib/error-messages";

export const Route = createFileRoute("/_entered")({
    // A join in progress (#1021) comes first. A visitor who followed a join link while signed out
    // was sent to the lobby to log in, and the lobby sends them back to `/app`. Entering would
    // refuse them, since they are not on the roster yet, and send them back to the lobby in a
    // loop. `takePendingJoinToken` is how the join page survives that round trip: see
    // `lib/join.ts` in `@energetica/instance`.
    beforeLoad: () => {
        const pendingJoinToken = takePendingJoinToken();
        if (pendingJoinToken !== null) {
            throw redirect({
                to: "/join/$token",
                params: { token: pendingJoinToken },
            });
        }
    },
    component: EnteredLayout,
    staticData: { title: "" },
});

function EnteredLayout() {
    const {
        data: entry,
        isLoading,
        isError,
        error,
        refetch,
    } = useWorkshopEntry();
    const mustLogIn = !isLoading && !isError && !entry;

    useEffect(() => {
        if (mustLogIn) window.location.assign(lobbyLoginHref());
    }, [mustLogIn]);

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Spinner />
            </div>
        );
    }
    if (isError) {
        // An account on no team in a Run with teams (#1384) is refused for good, so trying again cannot help.
        // The player may be signed in with the wrong account, so they can log out or go back to the lobby, as
        // from the Workshop's account menu.
        if (isErrorType(error, "WORKSHOP_NOT_ON_A_TEAM")) {
            return (
                <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
                    <p>{getUserFriendlyError(error)}</p>
                    <div className="flex gap-2">
                        {/* On a single-origin host the lobby sends a logged-in
                            account straight back here, so there is no lobby to go to. */}
                        {!isSingleOriginHost() && (
                            <Button variant="outline" asChild>
                                <a href={lobbyHref("/")}>Back to lobby</a>
                            </Button>
                        )}
                        <LogOutButton />
                    </div>
                </div>
            );
        }
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-4">
                <p>Could not enter the Workshop.</p>
                <Button variant="outline" onClick={() => void refetch()}>
                    Try again
                </Button>
            </div>
        );
    }
    // Rendering nothing until the effect has sent the visitor to the lobby.
    if (mustLogIn) return null;
    return <Outlet />;
}
