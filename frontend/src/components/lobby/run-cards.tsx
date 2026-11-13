/**
 * The picker's run cards — the lobby's signature element. Tiers sharing one
 * frame (the landing's `RunCard` idiom, so returning players recognise it):
 * "your runs" carry a pine icon tile (a bolt, or a presentation board for a
 * Workshop run) and a "Play" affordance; "open runs" stay quieter with a "Join"
 * affordance; "runs you facilitate" (#1032) carry a distinct shield tile and a
 * "Manage" affordance, so a facilitator card never reads as a played run out of
 * context.
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
 * so "Play"/"Join" into the live run is still meaningful even after the recap
 * exists.
 *
 * At `ended` it replaces that primary action instead of sitting beside it: the
 * reap has stopped the instance (T7), so the cross-origin link would point at a
 * subdomain that no longer answers. The recap is what survived, so it becomes
 * the whole card's destination, for every kind of card.
 *
 * These rules live in `runEntry` (`@energetica/core/instances`), which the
 * in-run switcher is meant to share (#1337); the cards only turn its action
 * into a link.
 */

import { Link } from "@tanstack/react-router";
import {
    ChevronRight,
    FileClock,
    Presentation,
    Shield,
    Zap,
} from "lucide-react";
import { useState } from "react";

import { useJoinRun } from "@/hooks/use-lobby";
import type { FacilitatedRun, MyRun } from "@/lib/api/lobby";
import { getUserFriendlyError } from "@/lib/error-utils";
import { runAppHref, runFacilitatorHref } from "@/lib/lobby";
import {
    derivePhase,
    runEntry,
    type InstanceFragment,
    type RunEntry,
} from "@energetica/core/instances";
import { Button } from "@energetica/ui/components/button";
import { InfoBanner } from "@energetica/ui/components/info-banner";
import { Spinner } from "@energetica/ui/components/spinner";
import { TypographyMuted } from "@energetica/ui/components/typography";

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

/**
 * The card for one run. Its action, label and recap row all come from
 * {@link runEntry}, meant to be shared with the in-run switcher; the card only
 * turns the action into a link. `href` is where the live action (play, manage
 * or the logged-out join) goes; a `recap` action links to the in-lobby recap
 * route instead.
 */
function RunCardFrame({
    href,
    slug,
    entry,
    children,
}: {
    href: string;
    slug: string;
    entry: RunEntry;
    children: React.ReactNode;
}) {
    const body = (
        <>
            {children}
            <div className="flex flex-row items-center gap-1 text-primary shrink-0">
                <p className="font-semibold">{entry.actionLabel}</p>
                <ChevronRight />
            </div>
        </>
    );
    const rowClasses =
        "p-5 flex flex-row justify-between items-center gap-4 hover:bg-muted transition-all";
    return (
        <div className="bg-card text-foreground border border-border rounded-4xl shadow-md overflow-hidden">
            {entry.action === "recap" ? (
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
            {entry.recapAsSecondary && <ViewRecapRow slug={slug} />}
        </div>
    );
}

/** An emphasized card for a run the account has joined. */
export function MyRunCard({ run }: { run: MyRun }) {
    const joined = formatMonthYear(run.joined_at);
    const RunIcon = run.mode === "workshop" ? Presentation : Zap;
    return (
        <RunCardFrame
            href={runAppHref(run.slug)}
            slug={run.slug}
            entry={runEntry(run, "player")}
        >
            <div className="flex flex-row items-center gap-4 min-w-0">
                <div className="bg-primary/10 text-primary rounded-2xl p-3 shrink-0">
                    <RunIcon className="w-6 h-6" />
                </div>
                <div className="flex flex-col min-w-0">
                    <p className="text-lg font-semibold truncate">{run.name}</p>
                    {joined && (
                        <TypographyMuted>Joined {joined}</TypographyMuted>
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
 * of the played-run bolt or presentation board, a "Facilitator" label instead
 * of a joined-date, and a "Manage" CTA that links to the run's facilitator page
 * rather than its play view.
 */
export function FacilitatedRunCard({ run }: { run: FacilitatedRun }) {
    return (
        <RunCardFrame
            href={runFacilitatorHref(run.slug)}
            slug={run.slug}
            entry={runEntry(run, "facilitator")}
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
 * where "Play" lives.
 */
function JoinableOpenRunCard({
    instance,
    entry,
}: {
    instance: InstanceFragment;
    entry: RunEntry;
}) {
    const [selected, setSelected] = useState(false);
    const joinRun = useJoinRun();

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
            {entry.recapAsSecondary && <ViewRecapRow slug={instance.slug} />}
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
    const entry = runEntry(instance, "visitor");
    // An ended run cannot be joined, so a logged-in visitor gets the same recap card as a
    // logged-out one; the two-click join is only for a run that is still up.
    if (loggedIn && entry.action === "join") {
        return <JoinableOpenRunCard instance={instance} entry={entry} />;
    }
    return (
        <RunCardFrame
            href={`/login?return=${encodeURIComponent(instance.slug)}`}
            slug={instance.slug}
            entry={entry}
        >
            <OpenRunCardContent instance={instance} />
        </RunCardFrame>
    );
}
