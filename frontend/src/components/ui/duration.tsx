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

import { useTimeMode } from "@/contexts/time-mode-context";
import { useGameEngine } from "@/hooks/useGame";
import { cn } from "@/lib/classname-utils";
import { formatDuration } from "@/lib/format-utils";

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

    return <>{formatDuration(ticks, mode, gameEngine, compact)}</>;
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
 *     <Duration ticks={1000} /> // Shows toggle-able duration based on ticks
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
