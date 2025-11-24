/**
 * Duration component for formatting tick-based durations.
 *
 * Similar to Money.tsx, this is a component rather than a pure function because:
 * - It needs to fetch game constants from the API (ticks per second, clock time)
 * - Uses React Query to cache the game constants
 * - May need to render both in-game time and real-world time
 *
 * TODO: Implement actual game constants API hook when available
 */

interface DurationProps {
    /** Duration in ticks */
    ticks: number;
    /** Whether to show both in-game and real-world time */
    showRealTime?: boolean;
}

export function Duration({ ticks, showRealTime = false }: DurationProps) {
    // TODO: Replace with actual game constants hook when API is ready
    // const { data: gameConstants } = useGameConstants();
    // const inGameSecondsPerTick = gameConstants?.in_game_seconds_per_tick ?? 100;
    // const clockTime = gameConstants?.clock_time ?? 1;

    // Placeholder values until API is available
    const inGameSecondsPerTick = 100;
    const clockTime = 1;

    const formatMinutes = (totalMinutes: number): string => {
        if (totalMinutes < 1) {
            return `${Math.floor(totalMinutes * 60)}s`;
        }
        const days = Math.floor(totalMinutes / 1440);
        totalMinutes -= days * 1440;
        const hours = Math.floor(totalMinutes / 60);
        totalMinutes -= hours * 60;
        const minutes = Math.floor(totalMinutes);

        let duration = "";
        if (days > 0) {
            duration += `${days}d `;
        }
        if (hours > 0) {
            duration += `${hours}h `;
        }
        if (minutes > 0) {
            duration += `${minutes}m `;
        }
        return duration.trim() || "0s";
    };

    const inGameMinutes = (ticks * inGameSecondsPerTick) / 60;
    const realMinutes = (ticks * clockTime) / 60;

    const inGameTime = formatMinutes(inGameMinutes);
    const realTime = formatMinutes(realMinutes);

    if (showRealTime) {
        return (
            <span>
                {inGameTime}{" "}
                <span className="text-gray-500 dark:text-gray-400 text-xs">
                    ({realTime})
                </span>
            </span>
        );
    }

    return <span>{inGameTime}</span>;
}
