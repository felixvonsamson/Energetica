/**
 * How runs are ordered, grouped and labelled wherever they are listed: the
 * lobby's run list and the run app's "Switch run" menu. Both use these
 * functions, so a run sits in the same place and carries the same badge in
 * both. Decided in "What should the lobby's run list look like?" (#1039).
 *
 * One total ordering puts every run in order, and the lobby cuts that order
 * into three bands: Now, Coming up and Past. The bands are slices of the one
 * order, not separate sorts.
 *
 * This module is plain TypeScript. The badge icons and the CSS classes for the
 * badge colours stay in each frontend.
 */

import { derivePhase, type Lifecycle, type RunRelation } from "#core/instances";

/** The kind of Run: the persistent world (freeplay) or a Workshop. */
export type RunMode = "freeplay" | "workshop";

/**
 * A run as the lists see it: its lifecycle, name and mode, and how the account
 * relates to it.
 */
export type ListedRun = Lifecycle & {
    slug: string;
    name: string;
    /**
     * Absent in a manifest fragment published before the field existed; read as
     * freeplay.
     */
    mode?: RunMode;
    relation: RunRelation;
};

/**
 * Where a run stands, for listing it. Finer than the lifecycle phase: an
 * announced run that starts within {@link STARTING_SOON_MS} is `starting-soon`,
 * so that it is listed with the live runs and counts down.
 */
export type RunStatus =
    | "starting-soon"
    | "upcoming"
    | "live"
    | "frozen"
    | "ended";

/** How close to its start an announced run moves into the Now band. */
export const STARTING_SOON_MS = 60 * 60 * 1000;

export function runStatus(run: Lifecycle, now: Date = new Date()): RunStatus {
    switch (derivePhase(run, now)) {
        case "announced":
            return timestamp(run.starts_at) - now.getTime() <= STARTING_SOON_MS
                ? "starting-soon"
                : "upcoming";
        case "active":
            return "live";
        case "freeze":
            return "frozen";
        case "ended":
            return "ended";
    }
}

/** The bands the lobby cuts the run order into, in page order. */
export type RunBand = "now" | "coming-up" | "past";

export const RUN_BANDS: readonly RunBand[] = ["now", "coming-up", "past"];

export const RUN_BAND_TITLES: Record<RunBand, string> = {
    now: "Now",
    "coming-up": "Coming up",
    past: "Past",
};

const STATUS_BAND: Record<RunStatus, RunBand> = {
    "starting-soon": "now",
    live: "now",
    upcoming: "coming-up",
    frozen: "past",
    ended: "past",
};

/**
 * The band a run is listed in. The phase decides it: live runs and runs
 * starting within the hour are Now, other announced runs are Coming up, and
 * frozen and ended runs are Past.
 */
export function runBand(run: Lifecycle, now: Date = new Date()): RunBand {
    return STATUS_BAND[runStatus(run, now)];
}

/**
 * The one total ordering of runs. Sorting with it and cutting the result into
 * bands gives each band in its own order:
 *
 * - **Now:** runs starting soon at the top, soonest start first. Then workshops
 *   before freeplay, the account's own runs (played or facilitated) before runs
 *   it could join, soonest `freeze_at` first with open-ended runs last, and
 *   name.
 * - **Coming up:** workshops before freeplay, own runs before joinable ones,
 *   soonest `starts_at` first, and name.
 * - **Past:** frozen before ended, own runs before public recaps, most recent
 *   `freeze_at` first, and name. Mode does not matter here.
 *
 * The slug breaks any remaining tie, so the order never depends on input order.
 */
export function compareRuns(
    a: ListedRun,
    b: ListedRun,
    now: Date = new Date(),
): number {
    const statusA = runStatus(a, now);
    const statusB = runStatus(b, now);
    const band =
        RUN_BANDS.indexOf(STATUS_BAND[statusA]) -
        RUN_BANDS.indexOf(STATUS_BAND[statusB]);
    if (band !== 0) return band;
    return (
        (STATUS_BAND[statusA] === "past"
            ? comparePast(a, b, statusA, statusB)
            : compareCurrent(a, b, statusA, statusB)) ||
        a.name.localeCompare(b.name) ||
        compareStrings(a.slug, b.slug)
    );
}

/** Now and Coming up, before the name. */
function compareCurrent(
    a: ListedRun,
    b: ListedRun,
    statusA: RunStatus,
    statusB: RunStatus,
): number {
    const soonA = statusA === "starting-soon";
    const soonB = statusB === "starting-soon";
    if (soonA !== soonB) return soonA ? -1 : 1;
    const byFlags =
        flag(isWorkshop(a), isWorkshop(b)) || flag(isOwn(a), isOwn(b));
    if (byFlags) return byFlags;
    // Runs that have not started are ordered by when they start, live runs by
    // when they freeze.
    const key = statusA === "live" ? "freeze_at" : "starts_at";
    return timestamp(a[key]) - timestamp(b[key]) || 0;
}

/** Past, before the name. */
function comparePast(
    a: ListedRun,
    b: ListedRun,
    statusA: RunStatus,
    statusB: RunStatus,
): number {
    return (
        flag(statusA === "frozen", statusB === "frozen") ||
        flag(isOwn(a), isOwn(b)) ||
        timestamp(b.freeze_at, -Infinity) - timestamp(a.freeze_at, -Infinity) ||
        0
    );
}

/**
 * Sort runs with {@link compareRuns} and cut them into bands, in page order.
 * Empty bands are left out, so an empty result means there is nothing to list.
 */
export function bandRuns<T extends ListedRun>(
    runs: readonly T[],
    now: Date = new Date(),
): { band: RunBand; runs: T[] }[] {
    const sorted = [...runs].sort((a, b) => compareRuns(a, b, now));
    return RUN_BANDS.map((band) => ({
        band,
        runs: sorted.filter((run) => runBand(run, now) === band),
    })).filter((group) => group.runs.length > 0);
}

/**
 * The theme colour a badge is drawn in. Each frontend maps it to a CSS class
 * (`text-warning`, and so on); `frozen` is a theme token of its own.
 */
export type RunBadgeColour = "warning" | "info" | "frozen" | "muted-foreground";

/** The short coloured label under a run's name, e.g. "Starts in 25 min". */
export type RunBadge = {
    /** Which badge it is. Each frontend picks the badge's icon from this. */
    status: Exclude<RunStatus, "live">;
    text: string;
    colour: RunBadgeColour;
};

/** How to write dates in badge text. Both default to the browser's own. */
export type BadgeFormat = { locale?: string; timeZone?: string };

const BADGE_COLOURS: Record<RunBadge["status"], RunBadgeColour> = {
    "starting-soon": "warning",
    upcoming: "info",
    frozen: "frozen",
    ended: "muted-foreground",
};

/**
 * The badge for a run, or `null` for a live run: the Now band already says it
 * is live, and the word repeated on every row was noise.
 *
 * - Starting soon: "Starts in 25 min", rounded up so it never says 0.
 * - Upcoming: "Starts 18 Nov", with the year when it is not this year.
 * - Frozen: "Frozen, viewable until 24 Nov", or "Frozen" for a run that never
 *   ends.
 * - Ended: "Ended Aug 2026".
 */
export function runBadge(
    run: Lifecycle,
    now: Date = new Date(),
    format: BadgeFormat = {},
): RunBadge | null {
    const status = runStatus(run, now);
    if (status === "live") return null;
    return {
        status,
        text: badgeText(run, status, now, format),
        colour: BADGE_COLOURS[status],
    };
}

function badgeText(
    run: Lifecycle,
    status: RunBadge["status"],
    now: Date,
    { locale, timeZone }: BadgeFormat,
): string {
    const dayMonth = (iso: string): string => {
        const date = new Date(iso);
        const sameYear = yearOf(date, timeZone) === yearOf(now, timeZone);
        return new Intl.DateTimeFormat(locale, {
            day: "numeric",
            month: "short",
            year: sameYear ? undefined : "numeric",
            timeZone,
        }).format(date);
    };
    switch (status) {
        case "starting-soon": {
            const minutes = Math.ceil(
                (timestamp(run.starts_at) - now.getTime()) / 60_000,
            );
            return `Starts in ${Math.max(1, minutes)} min`;
        }
        case "upcoming":
            return `Starts ${dayMonth(run.starts_at)}`;
        case "frozen":
            return run.ended_at
                ? `Frozen, viewable until ${dayMonth(run.ended_at)}`
                : "Frozen";
        case "ended": {
            const month = new Intl.DateTimeFormat(locale, {
                month: "short",
                year: "numeric",
                timeZone,
            }).format(new Date(run.ended_at ?? run.freeze_at ?? run.starts_at));
            return `Ended ${month}`;
        }
    }
}

function yearOf(date: Date, timeZone: string | undefined): string {
    return new Intl.DateTimeFormat("en", { year: "numeric", timeZone }).format(
        date,
    );
}

function isWorkshop(run: ListedRun): boolean {
    return run.mode === "workshop";
}

function isOwn(run: ListedRun): boolean {
    return run.relation !== "visitor";
}

/** Orders runs with the flag set before those without it. */
function flag(a: boolean, b: boolean): number {
    return a === b ? 0 : a ? -1 : 1;
}

/** Code-point order, so the tie-break does not depend on the locale. */
function compareStrings(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Milliseconds since the epoch, or `missing` for an absent or unparseable
 * timestamp. Absent defaults to the far future, so an open-ended run sorts
 * after runs with a date.
 */
function timestamp(
    iso: string | null | undefined,
    missing: number = Infinity,
): number {
    if (!iso) return missing;
    const at = new Date(iso).getTime();
    return Number.isNaN(at) ? missing : at;
}
