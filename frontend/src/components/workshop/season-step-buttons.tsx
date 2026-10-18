/**
 * The previous and next season buttons in a season page's margins (#1273).
 * Winter leads on to the next Round's spring, and spring back to the previous
 * Round's winter. A button shows only when the session has reached that
 * season.
 *
 * They are styled like the timeline's season buttons, with an arrow. The
 * buttons sit outside the page's content column, so they show only when the
 * Workshop's main area is wide enough to leave room for them. The page wraps
 * its content in a `relative` element for them to sit beside.
 */

import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, ZapOff } from "lucide-react";
import type { ReactNode } from "react";

import { SEASON_ICONS } from "@/components/workshop/season-icons";
import { useWorkshopSession } from "@/hooks/use-workshop";
import { cn } from "@/lib/utils";
import {
    adjacentSeasons,
    type Season,
    SEASON_LABELS,
    type SeasonLink,
    tradingPeriodPage,
    workshopTimeline,
} from "@/lib/workshop-timeline";

export function SeasonStepButtons({
    round,
    season,
}: {
    round: number;
    season: Season;
}) {
    const { data: session } = useWorkshopSession();
    if (!session) return null;
    const { previous, next } = adjacentSeasons(
        workshopTimeline(
            session.checkpoint,
            session.round_count,
            session.blackouts,
        ),
        round,
        season,
    );

    return (
        <>
            {previous && (
                <Margin className="right-full mr-6">
                    <StepButton link={previous} direction="previous" />
                </Margin>
            )}
            {next && (
                <Margin className="left-full ml-6">
                    <StepButton link={next} direction="next" />
                </Margin>
            )}
        </>
    );
}

/**
 * A column beside the page's content, as tall as it, in which the button stays
 * in the middle of the screen while the page scrolls.
 */
function Margin({
    className,
    children,
}: {
    className: string;
    children: ReactNode;
}) {
    return (
        // The page's column is at most 1400px wide. From 1536px, the main area
        // leaves enough room beside it for a button and its gap.
        <div
            className={cn(
                "absolute inset-y-0 hidden @min-[1536px]:block",
                className,
            )}
        >
            <div className="sticky top-1/2 -translate-y-1/2">{children}</div>
        </div>
    );
}

function StepButton({
    link,
    direction,
}: {
    link: SeasonLink;
    direction: "previous" | "next";
}) {
    const Icon = link.blackout ? ZapOff : SEASON_ICONS[link.season];
    const Arrow = direction === "previous" ? ArrowLeft : ArrowRight;
    const label = SEASON_LABELS[link.season];
    const title = `${direction === "previous" ? "Previous" : "Next"}: Round ${link.round}, ${label}`;
    return (
        <Link
            {...tradingPeriodPage(link.round, link.season)}
            title={title}
            aria-label={title}
            className={cn(
                "flex w-16 flex-col items-center gap-1.5 rounded-full border border-border bg-surface-card px-2 py-3 text-xs font-medium text-foreground hover:underline",
                link.blackout && "border-destructive text-destructive",
            )}
        >
            <Arrow className="size-4" />
            <Icon className="size-3.5" />
            <span>{label}</span>
        </Link>
    );
}
