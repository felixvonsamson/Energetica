/**
 * PROTOTYPE — throwaway, for "What should the lobby's run list look like?"
 * (#1039).
 *
 * Variants of the lobby's run list on the existing `/` route, switchable via
 * `?variant=A|B`, with fixture data via `?data=typical|all|logged-out|empty`.
 * Each variant also previews the in-run "Switch run" menu with its own badge.
 *
 * Round 2, after review: C (phase-first tiles) dropped. No "Live" badge (the
 * Now band already says it) and no animation; no ring on a run starting soon;
 * no counts on band headings; a lighter, cooler hover; "Workshop" in the
 * subtitle (nothing for freeplay); "Facilitating since <month>" instead of
 * "Facilitator".
 *
 * A — Cards + pill badges: today's card, with a phase pill under the name. B —
 * Band panels: one panel per band, dense rows, real buttons for actions.
 */

import { Button } from "@energetica/ui/components/button";
import {
    TypographyH2,
    TypographyMuted,
} from "@energetica/ui/components/typography";
import { cn } from "@energetica/ui/lib/utils";
import {
    Archive,
    CalendarDays,
    ChevronDown,
    ChevronRight,
    Compass,
    Eye,
    type LucideIcon,
    Presentation,
    Snowflake,
    Timer,
    Zap,
} from "lucide-react";
import { useState } from "react";

import {
    actionsFor,
    BAND_TITLES,
    type Band,
    type BadgePhase,
    type ListedRun,
    subtitleParts,
    switchRunRows,
} from "@/prototype/run-list-model";

export type Banded = { band: Band; runs: ListedRun[] }[];

// ---------------------------------------------------------------------------
// Shared palette: one colour + icon per badge phase. A live run has no badge:
// the Now band already says it. Frozen has no theme token yet (sky from
// Tailwind's palette); the rest use the theme's feedback tokens.
// ---------------------------------------------------------------------------

type ShownPhase = Exclude<BadgePhase, "live">;

const PHASE_ICON: Record<ShownPhase, LucideIcon> = {
    soon: Timer,
    upcoming: CalendarDays,
    frozen: Snowflake,
    ended: Archive,
};

/** Soft fill + coloured text, for pills. */
const PHASE_PILL: Record<ShownPhase, string> = {
    soon: "bg-warning/15 text-warning border-warning/40",
    upcoming: "bg-info/10 text-info border-info/30",
    frozen: "bg-sky-500/15 text-sky-700 border-sky-500/30 dark:text-sky-300",
    ended: "bg-muted text-muted-foreground border-border-subtle",
};

/** Coloured text only, for inline badges. */
const PHASE_TEXT: Record<ShownPhase, string> = {
    soon: "text-warning",
    upcoming: "text-info",
    frozen: "text-sky-700 dark:text-sky-300",
    ended: "text-muted-foreground",
};

/** The card's hover: lighter and cooler than `bg-muted`. */
const ROW_HOVER = "hover:bg-surface-raised";

function shownPhase(run: ListedRun): ShownPhase | null {
    return run.badgePhase === "live" ? null : run.badgePhase;
}

function ModeIcon({ run, className }: { run: ListedRun; className?: string }) {
    const Icon = run.mode === "workshop" ? Presentation : Zap;
    return <Icon className={className} />;
}

function Subtitle({ run }: { run: ListedRun }) {
    const parts = subtitleParts(run);
    if (parts.length === 0) return null;
    return <TypographyMuted>{parts.join(" · ")}</TypographyMuted>;
}

function PillBadge({
    run,
    size = "md",
    className,
}: {
    run: ListedRun;
    size?: "sm" | "md";
    className?: string;
}) {
    const phase = shownPhase(run);
    if (!phase) return null;
    const Icon = PHASE_ICON[phase];
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap",
                size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-2.5 py-0.5",
                PHASE_PILL[phase],
                className,
            )}
        >
            <Icon className={size === "sm" ? "size-3" : "size-3.5"} />
            {run.badgeText}
        </span>
    );
}

function InlineBadge({
    run,
    className,
}: {
    run: ListedRun;
    className?: string;
}) {
    const phase = shownPhase(run);
    if (!phase) return null;
    const Icon = PHASE_ICON[phase];
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1 text-sm font-semibold",
                PHASE_TEXT[phase],
                className,
            )}
        >
            <Icon className="size-3.5" />
            {run.badgeText}
        </span>
    );
}

function usePastCollapse(runs: ListedRun[]) {
    const [expanded, setExpanded] = useState(false);
    const shown = expanded ? runs : runs.slice(0, 3);
    const hidden = runs.length - shown.length;
    return { shown, hidden, expanded, toggle: () => setExpanded((e) => !e) };
}

/**
 * The page's one empty state. The shared `EmptyState` paints its icon
 * `gray-400`, too faint on the pine background; this uses the theme's muted
 * foreground instead.
 */
function AllEmpty() {
    return (
        <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
            <Compass className="w-12 h-12 text-muted-foreground mb-2" />
            <p className="text-lg font-semibold">No runs are open right now</p>
            <TypographyMuted>Check back soon.</TypographyMuted>
        </div>
    );
}

function BandHeading({ band }: { band: Band }) {
    return (
        <TypographyH2 className="text-primary">
            {BAND_TITLES[band]}
        </TypographyH2>
    );
}

// ---------------------------------------------------------------------------
// The in-run "Switch run" menu preview, drawn as a static dropdown panel. The
// highlighted row turns green with white text, so the badge and secondary text
// switch to white too (in the real menu: `group-data-[highlighted]:`).
// ---------------------------------------------------------------------------

function SwitchRunPreview({
    bands,
    renderBadge,
}: {
    bands: Banded;
    renderBadge: (run: ListedRun, highlightClass: string) => React.ReactNode;
}) {
    const rows = switchRunRows(bands);
    if (rows.length === 0) return null;
    const onHighlight = "group-hover:text-accent-foreground";
    return (
        <section className="mt-16 border-2 border-dashed border-border-subtle rounded-2xl p-5 flex flex-col gap-3">
            <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                Prototype preview · in-run account menu → Switch run
            </p>
            <div className="w-80 self-center rounded-md border border-border bg-popover text-popover-foreground shadow-md p-1">
                <p className="px-2 py-1.5 text-sm font-semibold">Switch run</p>
                <div className="h-px bg-border-subtle -mx-1 my-1" />
                {rows.map((run) => {
                    const { primary } = actionsFor(run);
                    return (
                        <div
                            key={run.slug}
                            className="group flex flex-row items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground cursor-default"
                        >
                            <ModeIcon run={run} className="size-4 shrink-0" />
                            <div className="flex flex-col min-w-0 flex-1">
                                <span className="truncate">{run.name}</span>
                                {renderBadge(run, onHighlight)}
                            </div>
                            <span
                                className={cn(
                                    "text-xs text-muted-foreground shrink-0",
                                    onHighlight,
                                )}
                            >
                                {primary}
                            </span>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

// ---------------------------------------------------------------------------
// Variant A — Cards + pill badges
// ---------------------------------------------------------------------------

function CardA({ run }: { run: ListedRun }) {
    const { primary, secondary } = actionsFor(run);
    const dim = run.band === "past";
    return (
        <div
            className={cn(
                "bg-card text-foreground border border-border rounded-4xl overflow-hidden",
                dim ? "shadow-none" : "shadow-md",
            )}
        >
            <a
                href={`#${run.slug}`}
                className={cn(
                    "p-5 flex flex-row justify-between items-center gap-4 transition-colors",
                    ROW_HOVER,
                )}
            >
                <div className="flex flex-row items-center gap-4 min-w-0">
                    <div
                        className={cn(
                            "rounded-2xl p-3 shrink-0",
                            dim
                                ? "bg-muted text-muted-foreground"
                                : "bg-primary/10 text-primary",
                        )}
                    >
                        <ModeIcon run={run} className="w-6 h-6" />
                    </div>
                    <div className="flex flex-col min-w-0 gap-1">
                        <p className="text-lg font-semibold truncate leading-tight">
                            {run.name}
                        </p>
                        <div className="flex flex-row flex-wrap items-center gap-x-2 gap-y-1">
                            <PillBadge run={run} />
                            <Subtitle run={run} />
                        </div>
                    </div>
                </div>
                <div className="flex flex-row items-center gap-1 text-primary shrink-0">
                    <p className="font-semibold">{primary}</p>
                    <ChevronRight />
                </div>
            </a>
            {secondary && (
                <a
                    href={`#${run.slug}`}
                    className={cn(
                        "flex flex-row items-center gap-1.5 px-5 py-2.5 text-sm text-muted-foreground hover:text-primary transition-colors border-t border-border",
                        ROW_HOVER,
                    )}
                >
                    <Eye className="w-4 h-4" />
                    {secondary}
                </a>
            )}
        </div>
    );
}

function PastBandA({ runs }: { runs: ListedRun[] }) {
    const { shown, hidden, expanded, toggle } = usePastCollapse(runs);
    return (
        <>
            {shown.map((run) => (
                <CardA key={run.slug} run={run} />
            ))}
            {(hidden > 0 || expanded) && (
                <Button
                    variant="outline"
                    className="self-center gap-1.5"
                    onClick={toggle}
                >
                    {expanded
                        ? "Show fewer"
                        : `Show all past runs (${runs.length})`}
                    <ChevronDown className={cn(expanded && "rotate-180")} />
                </Button>
            )}
        </>
    );
}

export function VariantA({ bands }: { bands: Banded }) {
    if (bands.length === 0) return <AllEmpty />;
    return (
        <div className="flex flex-col gap-12 pt-8">
            {bands.map(({ band, runs }) => (
                <section key={band} className="flex flex-col gap-4">
                    <BandHeading band={band} />
                    {band === "past" ? (
                        <PastBandA runs={runs} />
                    ) : (
                        runs.map((run) => <CardA key={run.slug} run={run} />)
                    )}
                </section>
            ))}
            <SwitchRunPreview
                bands={bands}
                renderBadge={(r, highlight) => (
                    <span>
                        <PillBadge
                            run={r}
                            size="sm"
                            className={cn(
                                highlight,
                                "group-hover:bg-transparent group-hover:border-accent-foreground/50",
                            )}
                        />
                    </span>
                )}
            />
        </div>
    );
}

// ---------------------------------------------------------------------------
// Variant B — Band panels with dense rows
// ---------------------------------------------------------------------------

function RowB({ run }: { run: ListedRun }) {
    const { primary, secondary } = actionsFor(run);
    const parts = subtitleParts(run);
    const hasBadge = shownPhase(run) !== null;
    return (
        <div className="flex flex-row items-center gap-4 px-5 py-3.5">
            <ModeIcon run={run} className="size-5 shrink-0 text-primary" />
            <div className="flex flex-col min-w-0 flex-1">
                <p className="font-semibold truncate">{run.name}</p>
                {(hasBadge || parts.length > 0) && (
                    <div className="flex flex-row flex-wrap items-center gap-x-2 text-sm">
                        <InlineBadge run={run} />
                        {hasBadge && parts.length > 0 && (
                            <span className="text-muted-foreground">·</span>
                        )}
                        {parts.length > 0 && (
                            <span className="text-muted-foreground">
                                {parts.join(" · ")}
                            </span>
                        )}
                    </div>
                )}
            </div>
            <div className="flex flex-row items-center gap-2 shrink-0">
                {secondary && (
                    <Button variant="ghost" size="sm" className="gap-1">
                        <Eye />
                        Open run
                    </Button>
                )}
                {/* The row's main action: the same solid button in every band. */}
                <Button size="sm" className="min-w-24">
                    {primary}
                </Button>
            </div>
        </div>
    );
}

function BandPanelB({ band, runs }: { band: Band; runs: ListedRun[] }) {
    const { shown, hidden, expanded, toggle } = usePastCollapse(runs);
    const rows = band === "past" ? shown : runs;
    return (
        <section className="flex flex-col gap-4">
            <BandHeading band={band} />
            <div
                className={cn(
                    "bg-card border border-border rounded-3xl overflow-hidden divide-y divide-border-subtle",
                    band === "past" ? "shadow-none" : "shadow-md",
                )}
            >
                {rows.map((run) => (
                    <RowB key={run.slug} run={run} />
                ))}
                {band === "past" && (hidden > 0 || expanded) && (
                    <button
                        type="button"
                        onClick={toggle}
                        className={cn(
                            "w-full flex flex-row items-center justify-center gap-1.5 py-3 text-sm text-muted-foreground hover:text-primary",
                            ROW_HOVER,
                        )}
                    >
                        {expanded
                            ? "Show fewer"
                            : `Show all past runs (${runs.length})`}
                        <ChevronDown
                            className={cn("size-4", expanded && "rotate-180")}
                        />
                    </button>
                )}
            </div>
        </section>
    );
}

export function VariantB({ bands }: { bands: Banded }) {
    if (bands.length === 0) return <AllEmpty />;
    return (
        <div className="flex flex-col gap-12 pt-8">
            {bands.map(({ band, runs }) => (
                <BandPanelB key={band} band={band} runs={runs} />
            ))}
            <SwitchRunPreview
                bands={bands}
                renderBadge={(r, highlight) => (
                    <InlineBadge run={r} className={highlight} />
                )}
            />
        </div>
    );
}
