/**
 * Duration components for displaying time durations.
 *
 * - Duration: always shows game-time
 * - DualDuration: shows game-time with wall-clock in brackets, for
 *   countdown/progression items where knowing real-world wait time is useful.
 *   Both parts have explanatory tooltips linking to the wiki.
 */

import { Link } from "@tanstack/react-router";

import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { useGameEngine } from "@/hooks/use-game";
import { formatDuration, formatDurationDual } from "@/lib/format-utils";
import { cn } from "@/lib/utils";

interface DurationProps {
    /** Duration in ticks (source of truth) */
    ticks: number;
    /** Show compact format (e.g., "69d 8h" instead of "69d 8h 56m") */
    compact?: boolean;
}

export function Duration({ ticks, compact = false }: DurationProps) {
    const { data: gameEngine, isLoading } = useGameEngine();

    if (isLoading || !gameEngine) {
        return <span className={"text-muted-foreground"}>--</span>;
    }

    return <>{formatDuration(ticks, gameEngine, compact)}</>;
}

interface DualDurationProps {
    /** Duration in ticks (source of truth) */
    ticks: number;
    /** Show compact format (e.g., "69d 8h" instead of "69d 8h 56m") */
    compact?: boolean;
    /** Additional CSS classes */
    className?: string;
}

/**
 * Displays a duration in game-time with wall-clock time in brackets.
 * Used for progression items (construction, research, shipping) where
 * players want to know the real-world wait time.
 *
 * @example
 *     <DualDuration ticks={1000} /> // "3d 12h (45m)"
 *     <DualDuration ticks={1000} compact /> // "3d 12h (45m)"
 */
export function DualDuration({
    ticks,
    compact = false,
    className,
}: DualDurationProps) {
    const { data: gameEngine, isLoading } = useGameEngine();

    if (isLoading || !gameEngine) {
        return <span className={"text-muted-foreground"}>--</span>;
    }

    const { gameTime, wallClock } = formatDurationDual(
        ticks,
        gameEngine,
        compact,
    );

    return (
        <span className={cn("inline-flex items-center gap-1", className)}>
            <TimeTooltip label="In-game time">
                <span className="text-foreground cursor-help">{gameTime}</span>
            </TimeTooltip>
            <TimeTooltip label="Real time">
                <span className="text-muted-foreground cursor-help">
                    ({wallClock})
                </span>
            </TimeTooltip>
        </span>
    );
}

function TimeTooltip({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>{children}</TooltipTrigger>
            <TooltipContent className="max-w-48 text-center leading-snug">
                {label}.{" "}
                <Link
                    to="/app/wiki/$slug"
                    params={{ slug: "time-and-weather" }}
                    hash="game-time"
                    className="underline hover:opacity-80"
                >
                    Learn more
                </Link>
            </TooltipContent>
        </Tooltip>
    );
}
