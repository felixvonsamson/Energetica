import type { InstanceFragment } from "@energetica/core/instances";
import type { ListedRun } from "@energetica/core/run-list";
import { isSingleOriginHost } from "@energetica/core/single-origin";
import { Button } from "@energetica/ui/components/button";
import { InfoBanner } from "@energetica/ui/components/info-banner";
import { Spinner } from "@energetica/ui/components/spinner";
import {
    TypographyBrand,
    TypographyLead,
} from "@energetica/ui/components/typography";
import { createFileRoute, Link } from "@tanstack/react-router";
import { LogIn, UserPlus } from "lucide-react";
import { useEffect, useRef } from "react";

import { RunList } from "@/components/run-list";
import { useInstancesManifest, useMyRuns } from "@/hooks/use-lobby";
import type { FacilitatedRun, MyRun } from "@/lib/api/lobby";
import { runAppHref, validateReturnSearch } from "@/lib/lobby";

export const Route = createFileRoute("/")({
    validateSearch: validateReturnSearch,
    component: PickerPage,
    staticData: { title: "Lobby" },
});

function PickerPage() {
    const { return: returnSlug } = Route.useSearch();
    const myRuns = useMyRuns();
    const instances = useInstancesManifest();

    // Where an authenticated player is forwarded, if anywhere. Derived in render
    // (so the spinner below holds while the navigation is in flight, instead of
    // flashing the picker); the ref keeps the assign one-shot across refetches.
    let bounceHref: string | null = null;
    if (myRuns.data) {
        if (isSingleOriginHost()) {
            // Single-origin proxy host (e.g. energetica.ethz.ch): exactly one
            // run is reachable through this origin, so the picker's choice is
            // moot. Send the player straight into the app — the instance's
            // entry gate provisions/authorises them per its access policy. The
            // multi-run UI below is never rendered here. See @energetica/core/single-origin
            // and the ADR-0002 amendment.
            bounceHref = "/app";
        } else if (returnSlug) {
            // `?return=` bounce (client-side by design): forward a *validated* slug straight to
            // its run, but only when the account has already joined it — a run the account has
            // never joined stops here instead, on the picker, where the two-click join (#1030) is
            // the only way in. This keeps "joined" meaning one consistent thing everywhere: no
            // path silently joins an account without the explicit click. The URL is built against
            // the fixed apex (runAppHref), never taken from the parameter — no open redirect.
            const joinedSlugs = new Set(
                myRuns.data.runs.map((run) => run.slug),
            );
            if (joinedSlugs.has(returnSlug)) {
                bounceHref = runAppHref(returnSlug);
            }
        }
    }
    const bouncedRef = useRef(false);
    useEffect(() => {
        if (bounceHref && !bouncedRef.current) {
            bouncedRef.current = true;
            window.location.assign(bounceHref);
        }
    }, [bounceHref]);

    if (bounceHref !== null || myRuns.isPending || instances.isPending) {
        return (
            <div className="flex justify-center py-24">
                <Spinner />
            </div>
        );
    }

    if (myRuns.isError) {
        return (
            <div className="py-12 max-w-md mx-auto">
                <InfoBanner variant="error">
                    The lobby can&apos;t be reached right now. Try again in a
                    moment.
                </InfoBanner>
                <Button
                    variant="outline"
                    className="mt-4 w-full"
                    onClick={() => void myRuns.refetch()}
                >
                    Retry
                </Button>
            </div>
        );
    }

    // Private runs are never listed here: they aren't freely joinable (this list's whole point,
    // #1030), and the two-click join is a public-run-only endpoint that would just 403 on one.
    // A private run's admission is entirely through its own facilitator-issued join link/roster
    // (#1019-#1022), not this picker.
    const advertised = (instances.data ?? []).filter(
        (instance) => instance.advertised && !instance.private,
    );

    if (myRuns.data === null) {
        return (
            <LoggedOutPicker openRuns={advertised} returnSlug={returnSlug} />
        );
    }
    return (
        <LoggedInPicker
            runs={myRuns.data.runs}
            facilitatedRuns={myRuns.data.facilitated_runs}
            advertised={advertised}
            isTemporaryAccount={myRuns.data.expires_at !== null}
        />
    );
}

/** A run from the public manifest, which the account has not joined. */
function visitorRun(instance: InstanceFragment): ListedRun {
    return { ...instance, relation: "visitor" };
}

function LoggedOutPicker({
    openRuns,
    returnSlug,
}: {
    openRuns: InstanceFragment[];
    returnSlug: string | undefined;
}) {
    return (
        <div className="flex flex-col gap-14 pt-12">
            {/* Hero: the front door states its one job. */}
            <div className="text-center flex flex-col items-center gap-4">
                <TypographyBrand className="text-5xl text-primary">
                    Energetica
                </TypographyBrand>
                <TypographyLead>
                    Log in to play your runs, or create an account to join one.
                </TypographyLead>
                <div className="flex flex-row gap-3 mt-2">
                    <Link to="/login" search={{ return: returnSlug }}>
                        <Button size="lg" className="gap-2">
                            <LogIn className="w-5 h-5" />
                            Log in
                        </Button>
                    </Link>
                    <Link to="/signup" search={{ return: returnSlug }}>
                        <Button variant="secondary" size="lg" className="gap-2">
                            <UserPlus className="w-5 h-5" />
                            Create account
                        </Button>
                    </Link>
                </div>
            </div>

            <RunList runs={openRuns.map(visitorRun)} loggedIn={false} />
        </div>
    );
}

function LoggedInPicker({
    runs,
    facilitatedRuns,
    advertised,
    isTemporaryAccount,
}: {
    runs: MyRun[];
    facilitatedRuns: FacilitatedRun[];
    advertised: InstanceFragment[];
    isTemporaryAccount: boolean;
}) {
    const myRunSlugs = new Set(runs.map((run) => run.slug));
    const facilitatedSlugs = new Set(facilitatedRuns.map((run) => run.slug));
    // A run the account plays or facilitates is listed once, from my-runs. A facilitator's own run
    // can also be public and advertised; listed again from the manifest, it would get a "Join"
    // button that would just fail server-side — player and facilitator are mutually exclusive per
    // (account_id, slug) (ADR-0004).
    // A temporary account, made for one workshop, cannot join a freeplay run: it is deleted after
    // the workshop and would leave a player behind with no account (#1383). The join route refuses
    // it, so its "Join" button would only fail.
    const openRuns = advertised.filter(
        (instance) =>
            !myRunSlugs.has(instance.slug) &&
            !facilitatedSlugs.has(instance.slug) &&
            !(
                isTemporaryAccount &&
                (instance.mode ?? "freeplay") === "freeplay"
            ),
    );

    const listed: ListedRun[] = [
        ...runs.map((run) => ({ ...run, relation: "player" as const })),
        ...facilitatedRuns.map((run) => ({
            ...run,
            relation: "facilitator" as const,
        })),
        ...openRuns.map(visitorRun),
    ];

    return (
        <div className="pt-8">
            <RunList runs={listed} loggedIn />
        </div>
    );
}
