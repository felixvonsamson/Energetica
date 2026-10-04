/**
 * The Workshop timeline (#995), across the top of every Workshop page: each
 * Round with its four Trading periods beneath it, and a Recap node between one
 * Round and the next.
 *
 * The session's current node is highlighted. Nodes it has already passed link
 * to their pages, as does the current one. Future nodes are grayed out and do
 * not link, because nothing has happened in them yet. The page being viewed is
 * underlined.
 *
 * Below the `xl` breakpoint the seasons show only their icons, so three Rounds
 * fit a laptop screen. If the timeline is still wider than the screen it
 * scrolls, and `justify-center-safe` keeps the first Round reachable.
 */

import { Link } from "@tanstack/react-router";
import { ChevronRight, ScrollText } from "lucide-react";
import { Fragment, type ReactNode } from "react";

import { SEASON_ICONS } from "@/components/workshop/season-icons";
import { cn } from "@/lib/utils";
import {
    type Checkpoint,
    type NodeStatus,
    recapPage,
    roundPage,
    SEASON_LABELS,
    type TimelineRound,
    tradingPeriodPage,
    type WorkshopPage,
    workshopTimeline,
} from "@/lib/workshop-timeline";

export function WorkshopTimeline({
    checkpoint,
    roundCount,
}: {
    checkpoint: Checkpoint;
    roundCount: number;
}) {
    const rounds = workshopTimeline(checkpoint, roundCount);

    return (
        <nav
            aria-label="Session timeline"
            className="flex shrink-0 items-center justify-center-safe gap-2 overflow-x-auto border-b border-border-brand bg-surface-card px-4 py-3"
        >
            {rounds.map((round) => (
                <Fragment key={round.round}>
                    <RoundBlock round={round} />
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    <TimelineNode
                        status={round.recap}
                        page={recapPage(round.round)}
                        title={`Round ${round.round} recap`}
                        className="flex-col gap-1 px-2"
                    >
                        <ScrollText className="size-4" />
                        <span className="text-xs">Recap</span>
                    </TimelineNode>
                    {round.round < roundCount && (
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    )}
                </Fragment>
            ))}
        </nav>
    );
}

function RoundBlock({ round }: { round: TimelineRound }) {
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
                {round.seasons.map(({ season, status }) => {
                    const Icon = SEASON_ICONS[season];
                    return (
                        <TimelineNode
                            key={season}
                            status={status}
                            page={tradingPeriodPage(round.round, season)}
                            title={`Round ${round.round}, ${SEASON_LABELS[season]}`}
                            className={cn(
                                "rounded-full border px-1.5 py-1 text-xs xl:px-2.5",
                                status === "current"
                                    ? "border-brand bg-brand text-brand-fg"
                                    : "border-border",
                            )}
                        >
                            <Icon className="size-3.5" />
                            <span className="hidden xl:inline">
                                {SEASON_LABELS[season]}
                            </span>
                        </TimelineNode>
                    );
                })}
            </div>
        </div>
    );
}

/** One node: a link to its page, unless the session has not reached it yet. */
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
