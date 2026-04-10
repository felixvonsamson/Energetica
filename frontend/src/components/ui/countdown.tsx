import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { useGameEngine } from "@/hooks/use-game";
import { useGameTick } from "@/hooks/use-game-tick";
import { formatDurationDual } from "@/lib/format-utils";
import { interpolateEffectiveTick } from "@/lib/progress-utils";

export function Countdown({
    endTick,
    speed = 1,
}: {
    endTick: number | null;
    speed?: number;
}) {
    const { currentTick, lastTickTimestamp } = useGameTick();
    const { data: engine } = useGameEngine();
    const [, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (!endTick) return;
        const id = setInterval(() => setNow(Date.now()), 500);
        return () => clearInterval(id);
    }, [endTick]);

    if (!endTick || !engine || currentTick === undefined) return null;

    // Interpolate sub-tick progress
    const effectiveTick =
        lastTickTimestamp !== undefined
            ? interpolateEffectiveTick(
                  currentTick,
                  lastTickTimestamp,
                  engine.wall_clock_seconds_per_tick * 1000,
                  speed,
              )
            : currentTick;

    const ticksLeft = Math.max(0, endTick - effectiveTick);
    const { gameTime, wallClock } = formatDurationDual(
        ticksLeft,
        engine,
        true,
    );

    return (
        <span className="inline-flex items-center gap-1">
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
