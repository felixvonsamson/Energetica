import {
    createRootRoute,
    Outlet,
    useMatches,
    useNavigate,
} from "@tanstack/react-router";
import { useEffect } from "react";

import { AnnouncedScreen } from "@/components/lifecycle/announced-screen";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/use-auth";
import { useCapabilities } from "@/hooks/use-capabilities";
import { useGameEngine } from "@/hooks/use-game";
import { usePhase } from "@/hooks/use-phase";
import { lobbyLoginHref } from "@/lib/instances";
import { computeRedirect, isAnnouncedTakeover } from "@/lib/route-guard";

export const Route = createRootRoute({
    staticData: { title: "", routeConfig: { requiredRole: null } },
    component: RootComponent,
    validateSearch: (
        search: Record<string, unknown>,
    ): {
        help?: "";
    } => ({
        help: search.help === "" ? "" : undefined,
    }),
});

function RootComponent() {
    const matches = useMatches();
    const navigate = useNavigate();
    const { user, isAuthenticated, isLoading } = useAuth();
    const capabilities = useCapabilities();
    const phase = usePhase();
    const { data: engine } = useGameEngine();
    const staticData = matches[matches.length - 1]?.staticData;
    const routeConfig = staticData?.routeConfig;

    // Redirects are only decided once auth and capabilities are resolved.
    const authResolved = !isLoading && capabilities !== undefined;
    const routeNeedsAuth = !!routeConfig && routeConfig.requiredRole !== null;
    // A protected route with no session sends the player to the lobby to sign in — a full-page,
    // cross-origin redirect to lobby.{apex}, not an in-app navigate (the instance owns no login
    // page after the cutover, ADR-0002/0003).
    const mustLogIn =
        authResolved && routeNeedsAuth && (!isAuthenticated || !user);
    // Announced-phase takeover (#862, T4): before `starts_at` the sim is paused and there is nothing
    // to play, so an authenticated visitor sees the waiting screen on ANY app route. Gated at the
    // root (not in GameLayout) so it also covers `/app/settle`, which renders outside GameLayout —
    // this is what keeps "settle-during-announced" genuinely un-built (it stays fog, #856): a player
    // can't reach the settle flow before the run starts. Fails open to the game — `usePhase` is
    // `undefined` while the engine config loads or on an unconfigured/open-ended run — mirroring the
    // backend's fail-open-to-active phase read (#861). Freeze/ended stay ungated here (that in-game
    // read-only surface is T8, #866).
    // Facilitator (`requiredRole: "admin"`) routes are exempt (#1028): a facilitator manages the
    // roster and join link precisely during this pre-start window, and the backend imposes no
    // phase gate on those endpoints.
    // `phase === "announced"` already implies `engine.starts_at` is set (usePhase returns undefined
    // otherwise); the render branch below narrows it for the prop.
    const announced =
        authResolved &&
        isAuthenticated &&
        !!user &&
        isAnnouncedTakeover(routeConfig, phase);
    const redirectTo =
        !announced && authResolved && isAuthenticated && user
            ? computeRedirect(routeConfig, user, capabilities)
            : null;

    useEffect(() => {
        if (mustLogIn) {
            window.location.assign(lobbyLoginHref());
            return;
        }
        if (redirectTo) void navigate({ to: redirectTo });
    }, [mustLogIn, redirectTo, navigate]);

    // While auth or capabilities are still resolving, show a centred spinner rather than
    // leaking debug placeholders to users (these returns previously rendered raw strings).
    if (isLoading || capabilities === undefined) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Spinner />
            </div>
        );
    }
    if (staticData === undefined) return "Unknown page";
    // Before the run starts, an authenticated visitor waits here instead of entering the game or
    // being routed to settle (#862, T4). Placed before the redirect gate so it preempts the
    // settle/dashboard navigation the effect would otherwise fire.
    if (announced && engine?.starts_at) {
        return <AnnouncedScreen startsAt={engine.starts_at} />;
    }
    // Block rendering until the redirect from the effect fires.
    if (mustLogIn || redirectTo) return null;

    return <Outlet />;
}
