import { createFileRoute, Link } from "@tanstack/react-router";
import { Compass, LogIn, UserPlus } from "lucide-react";
import { useEffect, useRef } from "react";

import { MyRunCard, OpenRunCard } from "@/components/lobby/run-cards";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { InfoBanner } from "@/components/ui/info-banner";
import { Spinner } from "@/components/ui/spinner";
import {
    TypographyBrand,
    TypographyH2,
    TypographyLead,
    TypographyMuted,
} from "@/components/ui/typography";
import { useInstancesManifest, useMyRuns } from "@/hooks/use-lobby";
import type { MyRun } from "@/lib/api/lobby";
import type { InstanceFragment } from "@/lib/instances";
import { runAppHref, validateReturnSearch } from "@/lib/lobby";
import { isSingleOriginHost } from "@/lib/single-origin";

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
            // multi-run UI below is never rendered here. See lib/single-origin.ts
            // and the ADR-0002 amendment.
            bounceHref = "/app";
        } else if (returnSlug && instances.data !== undefined) {
            // `?return=` bounce (client-side by design): once both run lists are
            // known, forward a *validated* slug to its run. The URL is built
            // against the fixed apex (runAppHref), never taken from the
            // parameter — no open redirect. Unknown slugs fall through.
            const knownSlugs = new Set([
                ...myRuns.data.runs.map((run) => run.slug),
                ...instances.data.map((instance) => instance.slug),
            ]);
            if (knownSlugs.has(returnSlug)) {
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

    const advertised = (instances.data ?? []).filter(
        (instance) => instance.advertised,
    );

    if (myRuns.data === null) {
        return (
            <LoggedOutPicker openRuns={advertised} returnSlug={returnSlug} />
        );
    }
    return <LoggedInPicker runs={myRuns.data.runs} advertised={advertised} />;
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
                <TypographyLead>One account for all your runs.</TypographyLead>
                <TypographyMuted>
                    Log in to pick up your runs, or create an account to join
                    one.
                </TypographyMuted>
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

            {openRuns.length > 0 && (
                <section className="flex flex-col gap-4">
                    <TypographyH2 className="text-primary">
                        Runs open to join
                    </TypographyH2>
                    <div className="flex flex-col gap-4">
                        {openRuns.map((instance) => (
                            <OpenRunCard
                                key={instance.slug}
                                instance={instance}
                                loggedIn={false}
                            />
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}

function LoggedInPicker({
    runs,
    advertised,
}: {
    runs: MyRun[];
    advertised: InstanceFragment[];
}) {
    const myRunSlugs = new Set(runs.map((run) => run.slug));
    const openRuns = advertised.filter(
        (instance) => !myRunSlugs.has(instance.slug),
    );

    return (
        <div className="flex flex-col gap-12 pt-8">
            <section className="flex flex-col gap-4">
                <TypographyH2 className="text-primary">Your runs</TypographyH2>
                {runs.length > 0 ? (
                    <div className="flex flex-col gap-4">
                        {runs.map((run) => (
                            <MyRunCard key={run.slug} run={run} />
                        ))}
                    </div>
                ) : (
                    <EmptyState
                        icon={Compass}
                        title="No runs joined yet"
                        description={
                            openRuns.length > 0
                                ? "Join an open run below to start playing."
                                : "No runs are open right now. Check back soon."
                        }
                    />
                )}
            </section>

            {openRuns.length > 0 && (
                <section className="flex flex-col gap-4">
                    <TypographyH2 className="text-primary">
                        Open runs
                    </TypographyH2>
                    <div className="flex flex-col gap-4">
                        {openRuns.map((instance) => (
                            <OpenRunCard
                                key={instance.slug}
                                instance={instance}
                                loggedIn
                            />
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
