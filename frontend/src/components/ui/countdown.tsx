import { Clock, CalendarClock } from "lucide-react";
import { useEffect, useState } from "react";

import { useTimeMode } from "@/contexts/time-mode-context";
import { useGameEngine } from "@/hooks/use-game";
import { useGameTick } from "@/hooks/use-game-tick";
import { formatDuration } from "@/lib/format-utils";
import { cn } from "@/lib/utils";

export function Countdown({
    endTick,
    speed = 1,
}: {
    endTick: number | null;
    speed?: number;
}) {
    const { currentTick, lastTickTimestamp } = useGameTick();
    const { data: engine } = useGameEngine();
    const { mode, toggleMode } = useTimeMode();
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (!endTick) return;
        const id = setInterval(() => setNow(Date.now()), 500);
        return () => clearInterval(id);
    }, [endTick]);

    if (!endTick || !engine || currentTick === undefined) return null;

    // Interpolate sub-tick progress
    let effectiveTick = currentTick;
    if (lastTickTimestamp !== undefined) {
        const tickDurationMs = engine.wall_clock_seconds_per_tick * 1000;
        const fraction = Math.min(1, (now - lastTickTimestamp) / tickDurationMs);
        effectiveTick = currentTick + fraction * speed;
    }

    const ticksLeft = Math.max(0, endTick - effectiveTick);
    const otherMode = mode === "game-time" ? "wall-clock" : "game-time";
    const Icon = mode === "game-time" ? Clock : CalendarClock;

    return (
        <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
                e.stopPropagation();
                toggleMode();
            }}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleMode();
                }
            }}
            className={cn(
                "inline-flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer transition-colors",
                "hover:bg-pine/10 dark:hover:bg-white/10",
            )}
            title={`Click to switch to ${otherMode}`}
        >
            {formatDuration(ticksLeft, mode, engine, true)}
            <Icon className="w-4 h-4" strokeWidth={2} aria-label={mode} />
        </span>
    );
}
