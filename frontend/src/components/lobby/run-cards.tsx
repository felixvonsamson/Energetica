/**
 * The picker's run cards — the lobby's signature element. Tiers sharing one
 * frame (the landing's `RunCard` idiom, so returning players recognise it):
 * "your runs" carry a pine icon tile and a "Continue"/"Settle" affordance;
 * "open runs" stay quieter with a "Join" affordance; "runs you facilitate"
 * (#1032) carry a distinct shield tile and a "Manage" affordance, so a
 * facilitator card never reads as a played run out of context.
 *
 * "Your runs" cards render as plain `<a href>`: run links are cross-origin
 * (`{slug}.{apex}/app`), which a full page load handles fine. A logged-in "open
 * run" card is different: joining (#1030) is an explicit two-click in-lobby
 * action — click the card to reveal a "Join run" button, click that to record
 * the join — so it never navigates on its own; the run simply reappears under
 * "Your runs" once `my-runs` refetches. Logged out, there is no account to join
 * with yet, so that card stays the original single link through
 * `/login?return={slug}`.
 *
 * Once a run reaches `freeze` (its recap is minted and published, T5/G1), both
 * "your runs" and the logged-out "open run" card grow a secondary "View recap"
 * row — a same-origin, in-lobby route, so it uses TanStack Router's `Link`
 * rather than the frame's cross-origin `<a>`. It sits alongside, not instead
 * of, the primary action: freeze keeps the live instance up and readable (G2),
 * so "Continue"/"Join" into the live run is still meaningful even after the
 * recap exists.
 *
 * At `ended` it replaces that primary action instead of sitting beside it: the
 * reap has stopped the instance (T7), so the cross-origin link would point at a
 * subdomain that no longer answers. The recap is what survived, so it becomes
 * the whole card's destination.
 */

import { Link } from "@tanstack/react-router";
import { ChevronRight, FileClock, Shield, Zap } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { InfoBanner } from "@/components/ui/info-banner";
import { Spinner } from "@/components/ui/spinner";
import { TypographyMuted } from "@/components/ui/typography";
import { useJoinRun } from "@/hooks/use-lobby";
import type { FacilitatedRun, MyRun } from "@/lib/api/lobby";
import { getUserFriendlyError } from "@/lib/error-utils";
import { derivePhase, type InstanceFragment } from "@/lib/instances";
import { runAppHref, runFacilitatorHref } from "@/lib/lobby";

/** "March 2026" from an ISO timestamp, or null when unparseable. */
function formatMonthYear(iso: string): string | null {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat(undefined, {
        month: "long",
        year: "numeric",
    }).format(date);
}

/** The "View recap" row, shown once a run's recap can exist (`freeze`/`ended`). */
function ViewRecapRow({ slug }: { slug: string }) {
    return (
        <Link
            to="/runs/$slug/recap"
            params={{ slug }}
            className="flex flex-row items-center gap-1.5 px-5 py-2.5 text-sm text-muted-foreground hover:text-primary transition-colors border-t border-border"
        >
            <FileClock className="w-4 h-4" />
            View recap
        </Link>
    );
}

function RunCardFrame({
    href,
    cta,
    slug,
    phase,
    children,
}: {
    href: string;
    cta: string;
    slug: string;
    phase: ReturnType<typeof derivePhase>;
    children: React.ReactNode;
}) {
    // Once the run is `ended` its process has been reaped (T7) and `{slug}.{apex}` no longer
    // answers, so "Continue"/"Join" would be a link into nothing. The recap is all that outlived
    // the reap, so it becomes the card's primary — and only — action. During `freeze` the
    // instance is still up and readable (G2), which is why the recap is merely an extra row there.
    const reaped = phase === "ended";
    const body = (
        <>
            {children}
            <div className="flex flex-row items-center gap-1 text-primary shrink-0">
                <p className="font-semibold">{reaped ? "View recap" : cta}</p>
                <ChevronRight />
            </div>
        </>
    );
    const rowClasses =
        "p-5 flex flex-row justify-between items-center gap-4 hover:bg-muted transition-all";
    return (
        <div className="bg-card text-foreground border border-border rounded-4xl shadow-md overflow-hidden">
            {reaped ? (
                <Link
                    to="/runs/$slug/recap"
                    params={{ slug }}
                    className={rowClasses}
                >
                    {body}
                </Link>
            ) : (
                <a href={href} className={rowClasses}>
                    {body}
                </a>
            )}
            {phase === "freeze" && <ViewRecapRow slug={slug} />}
        </div>
    );
}

/** An emphasized card for a run the account has joined. */
export function MyRunCard({ run }: { run: MyRun }) {
    const joined = formatMonthYear(run.joined_at);
    const settled = run.settled_at !== null;
    return (
        <RunCardFrame
            href={runAppHref(run.slug)}
            cta={settled ? "Continue" : "Settle"}
            slug={run.slug}
            phase={derivePhase(run)}
        >
            <div className="flex flex-row items-center gap-4 min-w-0">
                <div className="bg-primary/10 text-primary rounded-2xl p-3 shrink-0">
                    <Zap className="w-6 h-6" />
                </div>
                <div className="flex flex-col min-w-0">
                    <p className="text-lg font-semibold truncate">{run.name}</p>
                    {joined && (
                        <TypographyMuted>
                            {settled
                                ? `Joined ${joined}`
                                : `Joined ${joined} · pick your tile to settle`}
                        </TypographyMuted>
                    )}
                </div>
            </div>
        </RunCardFrame>
    );
}

/**
 * A card for a run the account facilitates (instance-scoped grant, #1032).
 * Reuses {@link RunCardFrame} so freeze/ended recap behavior comes for free, but
 * is otherwise visually distinct from {@link MyRunCard}: a `Shield` tile instead
 * of the played-run `Zap` bolt, a "Facilitator" label instead of a joined-date,
 * and a "Manage" CTA that links to the run's facilitator page rather than its
 * play view.
 */
export function FacilitatedRunCard({ run }: { run: FacilitatedRun }) {
    return (
        <RunCardFrame
            href={runFacilitatorHref(run.slug)}
            cta="Manage"
            slug={run.slug}
            phase={derivePhase(run)}
        >
            <div className="flex flex-row items-center gap-4 min-w-0">
                <div className="bg-primary/10 text-primary rounded-2xl p-3 shrink-0">
                    <Shield className="w-6 h-6" />
                </div>
                <div className="flex flex-col min-w-0">
                    <p className="text-lg font-semibold truncate">{run.name}</p>
                    <TypographyMuted>Facilitator</TypographyMuted>
                </div>
            </div>
        </RunCardFrame>
    );
}

/** The shared name/date content of an "open run" card, either variant. */
function OpenRunCardContent({ instance }: { instance: InstanceFragment }) {
    const when = formatMonthYear(instance.starts_at);
    const phase = derivePhase(instance);
    // An announced run advertises before it's playable (#862, T4): the fragment is published at
    // creation with a future `starts_at`, so the card must say "Starts …", not "Running since …".
    const label = phase === "announced" ? "Starts" : "Running since";
    return (
        <div className="flex flex-col min-w-0">
            <p className="text-lg font-semibold truncate">{instance.name}</p>
            {when && (
                <TypographyMuted>
                    {label} {when}
                </TypographyMuted>
            )}
        </div>
    );
}

/**
 * A logged-in visitor's "open run" card: click to select (reveals a "Join run"
 * button), click that to record the join (#1030). Never navigates itself — once
 * joined, the run moves to "Your runs" on the next `my-runs` refetch, which is
 * where "Continue"/"Settle" lives.
 */
function JoinableOpenRunCard({ instance }: { instance: InstanceFragment }) {
    const [selected, setSelected] = useState(false);
    const joinRun = useJoinRun();
    const phase = derivePhase(instance);
    const recapAvailable = phase === "freeze" || phase === "ended";

    return (
        <div className="bg-card text-foreground border border-border rounded-4xl shadow-md overflow-hidden">
            <button
                type="button"
                onClick={() => setSelected(true)}
                disabled={selected}
                className="w-full p-5 flex flex-row justify-between items-center gap-4 text-left hover:bg-muted transition-all disabled:hover:bg-transparent"
            >
                <OpenRunCardContent instance={instance} />
                {!selected && (
                    <div className="flex flex-row items-center gap-1 text-primary shrink-0">
                        <p className="font-semibold">Join</p>
                        <ChevronRight />
                    </div>
                )}
            </button>
            {selected && (
                <div className="px-5 pb-5 pt-4 border-t border-border flex flex-col gap-3">
                    {joinRun.isError && (
                        <InfoBanner variant="error">
                            {getUserFriendlyError(joinRun.error)}
                        </InfoBanner>
                    )}
                    <div className="flex flex-row justify-end gap-2">
                        <Button
                            variant="ghost"
                            onClick={() => setSelected(false)}
                            disabled={joinRun.isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => joinRun.mutate(instance.slug)}
                            disabled={joinRun.isPending}
                            className="gap-2"
                        >
                            {joinRun.isPending && <Spinner />}
                            Join run
                        </Button>
                    </div>
                </div>
            )}
            {recapAvailable && <ViewRecapRow slug={instance.slug} />}
        </div>
    );
}

/**
 * A quieter card for an advertised run the account has not joined. Logged in,
 * it's the two-click join ({@link JoinableOpenRunCard}); logged out it routes
 * through the lobby login, carrying the run as the validated `?return=` slug —
 * there is no account yet to join with, so login comes first.
 */
export function OpenRunCard({
    instance,
    loggedIn,
}: {
    instance: InstanceFragment;
    loggedIn: boolean;
}) {
    if (loggedIn) {
        return <JoinableOpenRunCard instance={instance} />;
    }
    return (
        <RunCardFrame
            href={`/login?return=${encodeURIComponent(instance.slug)}`}
            cta="Join"
            slug={instance.slug}
            phase={derivePhase(instance)}
        >
            <OpenRunCardContent instance={instance} />
        </RunCardFrame>
    );
}
