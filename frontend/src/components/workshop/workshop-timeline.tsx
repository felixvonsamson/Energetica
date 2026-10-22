/**
 * The Workshop timeline (#995), across the top of every Workshop page: the
 * intro (#1254), each Round with its four Trading periods beneath it, a Recap
 * node between one Round and the next, and the scoreboard at the end (#1017).
 *
 * The session's current node is highlighted. Nodes it has already passed link
 * to their pages, as does the current one. Future nodes are grayed out and do
 * not link, because nothing has happened in them yet. The page being viewed is
 * underlined. Among the seasons, the one being viewed is filled in pine and the
 * current one, when it is not being viewed, in a darker sand (#1250).
 *
 * The intro and the scoreboard are open all game (#1250), so their nodes always
 * link.
 *
 * Each season the grid went down in is labeled "Blackout" (#1005).
 *
 * The timeline adapts to the width it has (#1271). When it does not fit, it
 * first drops the season names, keeping them in each icon's tooltip, then the
 * arrows between phases. Only if even that does not fit does it scroll, and
 * `justify-center-safe` keeps the first Round reachable.
 *
 * To choose, it lays out every layout in a hidden ruler as wide as its content
 * box, and measures them. The ruler holds no links, so it costs the router
 * nothing. The widths do not depend on the layout shown, so switching cannot
 * make the timeline flicker between two layouts, as long as the timeline fills
 * its container's width. A container sized by its content, such as the picture
 * in the welcome guide, fixes the layout instead.
 */

import { Link } from "@tanstack/react-router";
import {
    BookOpen,
    ChevronRight,
    ScrollText,
    Trophy,
    ZapOff,
} from "lucide-react";
import {
    createContext,
    Fragment,
    type ReactNode,
    use,
    useLayoutEffect,
    useRef,
    useState,
} from "react";

import { SEASON_ICONS } from "@/components/workshop/season-icons";
import {
    type Checkpoint,
    introPage,
    introStatus,
    type Blackout,
    recapPage,
    type NodeStatus,
    roundPage,
    scoreboardPage,
    scoreboardStatus,
    SEASON_LABELS,
    TIMELINE_LAYOUTS,
    type TimelineLayout,
    timelineLayout,
    type TimelineRound,
    tradingPeriodPage,
    type WorkshopPage,
    workshopTimeline,
} from "@/lib/workshop-timeline";
import { cn } from "@energetica/ui/lib/utils";

export function WorkshopTimeline({
    checkpoint,
    roundCount,
    blackouts,
    layout: fixedLayout,
}: {
    checkpoint: Checkpoint;
    roundCount: number;
    blackouts: Blackout[];
    /** Fixes the layout instead of fitting it to the width. */
    layout?: TimelineLayout;
}) {
    const rounds = workshopTimeline(checkpoint, roundCount, blackouts);
    const rulerRef = useRef<HTMLDivElement>(null);
    const [fittedLayout, setFittedLayout] = useState<TimelineLayout>("full");

    // Measured before the first paint, and again whenever the space or a
    // layout's width changes: on resize, zoom, or when the content changes.
    // Both sides come from getBoundingClientRect, so CSS zoom scales them
    // alike.
    useLayoutEffect(() => {
        const ruler = rulerRef.current;
        if (!ruler) return;
        const rows = [...ruler.children];
        const measure = () => {
            const widths = Object.fromEntries(
                TIMELINE_LAYOUTS.map((layout, i) => [
                    layout,
                    rows[i]?.getBoundingClientRect().width ?? Infinity,
                ]),
            ) as Record<TimelineLayout, number>;
            setFittedLayout(
                timelineLayout(ruler.getBoundingClientRect().width, widths),
            );
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(ruler);
        for (const row of rows) observer.observe(row);
        return () => observer.disconnect();
    }, [fixedLayout]);

    return (
        <nav
            aria-label="Session timeline"
            className="relative flex shrink-0 items-center justify-center-safe overflow-x-auto border-b border-border-brand bg-surface-card px-4 py-3"
        >
            <TimelineRow
                checkpoint={checkpoint}
                rounds={rounds}
                layout={fixedLayout ?? fittedLayout}
            />
            {/* The ruler: every layout at its natural width, inside a box
                spanning the nav's content box (inset by its `px-4`), clipped
                to no height, invisible, and out of reach. */}
            {!fixedLayout && (
                <InRuler value={true}>
                    <div
                        ref={rulerRef}
                        aria-hidden="true"
                        inert
                        className="invisible absolute inset-x-4 top-0 h-0 overflow-hidden"
                    >
                        {TIMELINE_LAYOUTS.map((layout) => (
                            <TimelineRow
                                key={layout}
                                checkpoint={checkpoint}
                                rounds={rounds}
                                layout={layout}
                                className="w-max"
                            />
                        ))}
                    </div>
                </InRuler>
            )}
        </nav>
    );
}

/** Whether nodes render inside the ruler, where they need not link. */
const InRuler = createContext(false);

function TimelineRow({
    checkpoint,
    rounds,
    layout,
    className,
}: {
    checkpoint: Checkpoint;
    rounds: TimelineRound[];
    layout: TimelineLayout;
    className?: string;
}) {
    const arrow = layout !== "compact" && (
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    );
    return (
        <div className={cn("flex shrink-0 items-center gap-2", className)}>
            <TimelineNode
                status={introStatus(checkpoint)}
                page={introPage()}
                title="Intro"
                className="flex-col gap-1 px-2"
            >
                <BookOpen className="size-4" />
                <span className="text-xs">Intro</span>
            </TimelineNode>
            {arrow}
            {rounds.map((round) => (
                <Fragment key={round.round}>
                    <RoundBlock round={round} showNames={layout === "full"} />
                    {arrow}
                    <TimelineNode
                        status={round.recap}
                        page={recapPage(round.round)}
                        title={`Round ${round.round} recap`}
                        className="flex-col gap-1 px-2"
                    >
                        <ScrollText className="size-4" />
                        <span className="text-xs">Recap</span>
                    </TimelineNode>
                    {arrow}
                </Fragment>
            ))}
            <TimelineNode
                status={scoreboardStatus(checkpoint)}
                page={scoreboardPage()}
                title="Scores"
                className="flex-col gap-1 px-2"
            >
                <Trophy className="size-4" />
                <span className="text-xs">Scores</span>
            </TimelineNode>
        </div>
    );
}

function RoundBlock({
    round,
    showNames,
}: {
    round: TimelineRound;
    showNames: boolean;
}) {
    return (
        <div
            className={cn(
                "flex shrink-0 flex-col items-center gap-2 rounded-xl border border-transparent px-4 py-2",
                round.status === "current" && "border-brand/40 bg-brand/10",
            )}
        >
            <TimelineNode
                status={round.status}
                page={roundPage(round.round)}
                className="text-sm font-semibold"
            >
                Round {round.round}
            </TimelineNode>
            <div className="flex items-center gap-2">
                {round.seasons.map(({ season, status, blackout }) => {
                    const Icon = blackout ? ZapOff : SEASON_ICONS[season];
                    const name = `Round ${round.round}, ${SEASON_LABELS[season]}`;
                    return (
                        <TimelineNode
                            key={season}
                            status={status}
                            page={tradingPeriodPage(round.round, season)}
                            title={blackout ? `${name}: blackout` : name}
                            className={cn(
                                "rounded-full border border-border py-1 text-xs",
                                showNames ? "px-2.5" : "px-1.5",
                                blackout &&
                                    "border-destructive text-destructive",
                                status === "current" &&
                                    "not-data-[status=active]:border-border-highlight not-data-[status=active]:bg-surface-highlight not-data-[status=active]:text-fg-base",
                                "data-[status=active]:border-brand data-[status=active]:bg-brand data-[status=active]:text-brand-fg",
                            )}
                        >
                            <Icon className="size-3.5" />
                            {showNames && <span>{SEASON_LABELS[season]}</span>}
                            {blackout && (
                                <span className="font-semibold">Blackout</span>
                            )}
                        </TimelineNode>
                    );
                })}
            </div>
        </div>
    );
}

/**
 * One node: a link to its page, unless the session has not reached it yet, or
 * it is in the ruler.
 */
function TimelineNode({
    status,
    page,
    title,
    className,
    children,
}: {
    status: NodeStatus;
    page: WorkshopPage;
    title?: string;
    className?: string;
    children: ReactNode;
}) {
    const base = "flex shrink-0 items-center gap-1.5 font-medium";
    if (use(InRuler))
        return <span className={cn(base, className)}>{children}</span>;
    if (status === "future") {
        return (
            <span
                aria-disabled="true"
                title={title}
                className={cn(
                    base,
                    "text-muted-foreground opacity-40",
                    className,
                )}
            >
                {children}
            </span>
        );
    }
    return (
        <Link
            {...page}
            title={title}
            aria-current={status === "current" ? "step" : undefined}
            activeOptions={{ exact: true }}
            className={cn(
                base,
                status === "current" ? "text-brand" : "text-foreground",
                "hover:underline data-[status=active]:underline",
                className,
            )}
        >
            {children}
        </Link>
    );
}
