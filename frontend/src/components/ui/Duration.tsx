/**
 * Duration component for displaying time durations with wall-clock and
 * game-time toggle.
 *
 * Accepts duration in ticks and converts to the appropriate time representation
 * based on the current TimeMode. Uses the game engine configuration to compute
 * the actual durations in seconds.
 *
 * This component is necessary (rather than a pure function) because:
 *
 * - It fetches game engine configuration from the API via useGameEngine hook
 * - Uses React Query to cache the game configuration
 * - Accesses TimeMode context to determine which format to display
 * - Handles loading and error states
 */

import { Clock, CalendarClock } from "lucide-react";

import { useTimeMode } from "@/contexts/TimeModeContext";
import { useGameEngine } from "@/hooks/useGame";
import { cn } from "@/lib/cn";
import {
    formatGameTimeDuration,
    formatWallClockDuration,
    ticksToGameSeconds,
    ticksToWallClockSeconds,
} from "@/lib/format-utils";

/**
 * Format a duration string to be more compact by showing fewer units. For
 * example: "69d 8h 56m 23s" becomes "69d 8h"
 *
 * @param formatted - The formatted duration string (e.g., "69d 8h 56m 23s")
 * @returns Compact version (e.g., "69d 8h")
 */
export function makeCompact(formatted: string): string {
    const parts = formatted.split(" ");
    return parts.slice(0, 2).join(" ");
}

interface DurationProps {
    /** Duration in ticks (source of truth) */
    ticks: number;
    /** Show compact format (e.g., "69d 8h" instead of "69d 8h 56m") */
    compact?: boolean;
}

export function Duration({ ticks, compact = false }: DurationProps) {
    const { mode } = useTimeMode();
    const { data: gameEngine, isLoading } = useGameEngine();

    // Show placeholder while loading
    if (isLoading || !gameEngine) {
        return <span className={"text-muted-foreground"}>--</span>;
    }

    // Determine which duration to display based on mode
    const durationSeconds =
        mode === "game-time"
            ? ticksToGameSeconds(ticks, gameEngine)
            : ticksToWallClockSeconds(ticks, gameEngine);

    let formatted =
        mode === "game-time"
            ? formatGameTimeDuration(durationSeconds)
            : formatWallClockDuration(durationSeconds);

    if (compact) {
        formatted = makeCompact(formatted);
    }

    return <>{formatted}</>;
}

interface TogglingDurationProps {
    /** Duration in ticks (source of truth) */
    ticks: number;
    /** Show compact format (e.g., "69d 8h" instead of "69d 8h 56m") */
    compact?: boolean;
    /** Show icon indicating current time mode */
    showIcon?: boolean;
    /** Additional CSS classes */
    className?: string;
}

/**
 * Displays a duration with the ability to toggle between game-time and
 * wall-clock formats. Accepts ticks as input and handles all conversions using
 * the game engine configuration. Click the duration to toggle between display
 * modes.
 *
 * @example
 *     <Duration ticks={1000} /> // Shows togglable duration based on ticks
 *     <Duration ticks={1000} compact showIcon /> // With compact format and icon on the right
 */
export function TogglingDuration({
    ticks,
    compact = false,
    showIcon = true,
    className,
}: TogglingDurationProps) {
    const { mode, toggleMode } = useTimeMode();

    const otherMode = mode === "game-time" ? "wall-clock" : "game-time";
    const tooltipText = `Click to switch to ${otherMode}`;

    return (
        <span
            onClick={(e) => {
                e.stopPropagation();
                toggleMode();
            }}
            className={cn(
                "inline-flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer transition-colors",
                "hover:bg-pine/10 dark:hover:bg-white/10",
                className,
            )}
            title={tooltipText}
        >
            <Duration ticks={ticks} compact={compact} />
            {showIcon && <TimeModeIcon />}
        </span>
    );
}

interface TimeModeToggleProps {
    /** Additional CSS classes */
    className?: string;
}

export function TimeModeToggle({ className }: TimeModeToggleProps) {
    const { mode, toggleMode } = useTimeMode();

    const otherMode = mode === "game-time" ? "wall-clock" : "game-time";
    const tooltipText = `Click to switch to ${otherMode}`;

    return (
        <span
            onClick={(e) => {
                e.stopPropagation();
                toggleMode();
            }}
            className={cn(
                "inline-flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer transition-colors",
                "hover:bg-pine/10 dark:hover:bg-white/10",
                className,
            )}
            title={tooltipText}
        >
            {mode}
            <TimeModeIcon />
        </span>
    );
}

function TimeModeIcon() {
    const { mode } = useTimeMode();
    const Icon = mode === "game-time" ? Clock : CalendarClock;
    return <Icon className="w-4 h-4" strokeWidth={2} aria-label={mode} />;
}
