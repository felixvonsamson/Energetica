/**
 * The lobby's run list: every run the account can see, ordered by one shared
 * function and cut into the Now, Coming up and Past bands. Each band is one
 * panel of dense rows. Decided in "What should the lobby's run list look like?"
 * (#1039).
 *
 * The order, the bands, the badge text and its colour come from
 * `@energetica/core/run-list`, and each row's actions from `runEntry` in
 * `@energetica/core/instances`. The run app's "Switch run" menu uses the same
 * functions, so a run sits in the same order with the same badge in both. The
 * icons and colour classes are drawn here; sharing them waits on a React
 * package both bundles can use (#1379).
 *
 * Run links are cross-origin (`{slug}.{apex}/app`), so they are plain `<a
 * href>`. The recap is an in-lobby route, so it uses TanStack Router's `Link`.
 * Joining a run is an explicit two-click action (#1030): "Join" opens a
 * confirmation below the row, and "Join run" records the join and then sends
 * the player into the run (#1034). Logged out, "Join" goes through the login
 * page instead, carrying the run as the `?return=` slug.
 */

import { runEntry, type RunEntry } from "@energetica/core/instances";
import {
    bandRuns,
    RUN_BAND_TITLES,
    runBadge,
    type ListedRun,
    type RunBadge,
    type RunBadgeColour,
    type RunBand,
} from "@energetica/core/run-list";
import { Button } from "@energetica/ui/components/button";
import { EmptyState } from "@energetica/ui/components/empty-state";
import { InfoBanner } from "@energetica/ui/components/info-banner";
import { Spinner } from "@energetica/ui/components/spinner";
import { TypographyH2 } from "@energetica/ui/components/typography";
import { cn } from "@energetica/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import {
    Archive,
    CalendarDays,
    ChevronDown,
    Compass,
    Eye,
    type LucideIcon,
    Presentation,
    Snowflake,
    Timer,
    Zap,
} from "lucide-react";
import { useState } from "react";

import { useJoinRun } from "@/hooks/use-lobby";
import { useNow } from "@/hooks/use-now";
import { getUserFriendlyError } from "@/lib/error-utils";
import { runAppHref, runFacilitatorHref } from "@/lib/lobby";

/** How many Past rows show before "Show all past runs". */
const PAST_PREVIEW = 3;

const BADGE_ICONS: Record<RunBadge["status"], LucideIcon> = {
    "starting-soon": Timer,
    upcoming: CalendarDays,
    frozen: Snowflake,
    ended: Archive,
};

const BADGE_COLOURS: Record<RunBadgeColour, string> = {
    warning: "text-warning",
    info: "text-info",
    frozen: "text-frozen",
    "muted-foreground": "text-muted-foreground",
};

/**
 * The run list, or the page's one empty state when every band is empty.
 * `loggedIn` decides what "Join" does.
 */
export function RunList({
    runs,
    loggedIn,
}: {
    runs: ListedRun[];
    loggedIn: boolean;
}) {
    const now = useNow();
    const bands = bandRuns(runs, now);
    if (bands.length === 0) {
        return (
            <EmptyState
                icon={Compass}
                title="No runs are open right now"
                description="Check back soon."
            />
        );
    }
    return (
        <div className="flex flex-col gap-12">
            {bands.map(({ band, runs: bandedRuns }) => (
                <BandPanel
                    key={band}
                    band={band}
                    runs={bandedRuns}
                    loggedIn={loggedIn}
                    now={now}
                />
            ))}
        </div>
    );
}

function BandPanel({
    band,
    runs,
    loggedIn,
    now,
}: {
    band: RunBand;
    runs: ListedRun[];
    loggedIn: boolean;
    now: Date;
}) {
    const [expanded, setExpanded] = useState(false);
    const collapsible = band === "past" && runs.length > PAST_PREVIEW;
    const shown = collapsible && !expanded ? runs.slice(0, PAST_PREVIEW) : runs;
    return (
        <section className="flex flex-col gap-4">
            <TypographyH2 className="text-primary">
                {RUN_BAND_TITLES[band]}
            </TypographyH2>
            <div
                className={cn(
                    "bg-card text-card-foreground border border-border rounded-3xl overflow-hidden divide-y divide-border-subtle",
                    band !== "past" && "shadow-md",
                )}
            >
                {shown.map((run) => (
                    <RunRow
                        key={run.slug}
                        run={run}
                        band={band}
                        loggedIn={loggedIn}
                        now={now}
                    />
                ))}
                {collapsible && (
                    <button
                        type="button"
                        onClick={() => setExpanded((x) => !x)}
                        aria-expanded={expanded}
                        className="w-full flex flex-row items-center justify-center gap-1.5 py-3 text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                        {expanded
                            ? "Show fewer"
                            : `Show all past runs (${runs.length})`}
                        <ChevronDown
                            className={cn(
                                "size-4 transition-transform",
                                expanded && "rotate-180",
                            )}
                        />
                    </button>
                )}
            </div>
        </section>
    );
}

/**
 * The words after the badge, joined with " · ".
 *
 * - "Workshop" for a workshop. Freeplay gets nothing: "freeplay" is internal
 *   wording with no good player-facing term.
 * - The relation only in Past, where every row says "View recap", so it is what
 *   tells your runs from public recaps. Elsewhere the action button (Play,
 *   Manage, Join) already says it.
 * - No join or grant date: workshops last half a day and players are usually
 *   invited, so "Joined October 2026" would misread.
 */
function runSubtitle(run: ListedRun, band: RunBand): string[] {
    const parts: string[] = [];
    if (run.mode === "workshop") parts.push("Workshop");
    if (band === "past" && run.relation === "player") parts.push("You played");
    if (band === "past" && run.relation === "facilitator")
        parts.push("You facilitated");
    return parts;
}

function RunRow({
    run,
    band,
    loggedIn,
    now,
}: {
    run: ListedRun;
    band: RunBand;
    loggedIn: boolean;
    now: Date;
}) {
    const [confirmingJoin, setConfirmingJoin] = useState(false);
    const entry = runEntry(run, run.relation, now);
    const badge = runBadge(run, now);
    const subtitle = runSubtitle(run, band);
    const ModeIcon = run.mode === "workshop" ? Presentation : Zap;

    return (
        <div>
            <div className="flex flex-row flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                <ModeIcon
                    className="size-5 shrink-0 text-primary"
                    aria-label={run.mode === "workshop" ? "Workshop" : "Run"}
                />
                <div className="flex flex-col min-w-0 flex-1">
                    <p className="font-semibold truncate">{run.name}</p>
                    {(badge || subtitle.length > 0) && (
                        <p className="text-sm text-muted-foreground">
                            {badge && <BadgeLabel badge={badge} />}
                            {badge && subtitle.length > 0 && " · "}
                            {subtitle.join(" · ")}
                        </p>
                    )}
                </div>
                {!confirmingJoin && (
                    <div className="flex flex-row items-center gap-2 ml-auto">
                        {entry.readOnlyAction && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1"
                                title="Open the run, read-only"
                                asChild
                            >
                                <a href={openRunHref(run.slug, entry)}>
                                    <Eye />
                                    Open run
                                </a>
                            </Button>
                        )}
                        <MainAction
                            run={run}
                            entry={entry}
                            loggedIn={loggedIn}
                            onJoin={() => setConfirmingJoin(true)}
                        />
                    </div>
                )}
            </div>
            {confirmingJoin && (
                <JoinConfirmation
                    slug={run.slug}
                    onCancel={() => setConfirmingJoin(false)}
                />
            )}
        </div>
    );
}

/** The badge: a coloured icon and short text, with no pill. */
function BadgeLabel({ badge }: { badge: RunBadge }) {
    const Icon = BADGE_ICONS[badge.status];
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1 align-middle font-semibold",
                BADGE_COLOURS[badge.colour],
            )}
        >
            <Icon className="size-3.5" />
            {badge.text}
        </span>
    );
}

/** Where "Open run" goes for a frozen run: its app, or its facilitator page. */
function openRunHref(slug: string, entry: RunEntry): string {
    return entry.readOnlyAction === "manage"
        ? runFacilitatorHref(slug)
        : runAppHref(slug);
}

/** The row's main action: the same solid button in every band. */
function MainAction({
    run,
    entry,
    loggedIn,
    onJoin,
}: {
    run: ListedRun;
    entry: RunEntry;
    loggedIn: boolean;
    onJoin: () => void;
}) {
    const className = "min-w-24";
    switch (entry.action) {
        case "recap":
            return (
                <Button size="sm" className={className} asChild>
                    <Link to="/runs/$slug/recap" params={{ slug: run.slug }}>
                        {entry.actionLabel}
                    </Link>
                </Button>
            );
        case "enter":
        case "manage":
            return (
                <Button size="sm" className={className} asChild>
                    <a
                        href={
                            entry.action === "manage"
                                ? runFacilitatorHref(run.slug)
                                : runAppHref(run.slug)
                        }
                    >
                        {entry.actionLabel}
                    </a>
                </Button>
            );
        case "join":
            // Logged out there is no account to join with yet, so log in first.
            return loggedIn ? (
                <Button size="sm" className={className} onClick={onJoin}>
                    {entry.actionLabel}
                </Button>
            ) : (
                <Button size="sm" className={className} asChild>
                    <Link to="/login" search={{ return: run.slug }}>
                        {entry.actionLabel}
                    </Link>
                </Button>
            );
    }
}

/**
 * The second click of the two-click join (#1030). Once the join succeeds,
 * {@link useJoinRun} sends the player into the run (#1034); the buttons stay
 * disabled while that page loads.
 */
function JoinConfirmation({
    slug,
    onCancel,
}: {
    slug: string;
    onCancel: () => void;
}) {
    const joinRun = useJoinRun();
    // After success the browser is already loading the run, so keep the
    // buttons disabled and the spinner up rather than offering a second join.
    const busy = joinRun.isPending || joinRun.isSuccess;
    return (
        <div className="px-5 pb-4 flex flex-col gap-3">
            {joinRun.isError && (
                <InfoBanner variant="error">
                    {getUserFriendlyError(joinRun.error)}
                </InfoBanner>
            )}
            <div className="flex flex-row justify-end gap-2">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onCancel}
                    disabled={busy}
                >
                    Cancel
                </Button>
                <Button
                    size="sm"
                    onClick={() => joinRun.mutate(slug)}
                    disabled={busy}
                    className="gap-2"
                >
                    {busy && <Spinner />}
                    Join run
                </Button>
            </div>
        </div>
    );
}
