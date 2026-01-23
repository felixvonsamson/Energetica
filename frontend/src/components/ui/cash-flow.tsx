/**
 * CashFlow component for displaying cash flow rates with wall-clock and
 * game-time support.
 *
 * Accepts cash flow in money per tick and converts to the appropriate rate
 * representation based on the current TimeMode. Uses the game engine
 * configuration to compute the actual rates.
 *
 * This component is necessary (rather than a pure function) because:
 *
 * - It fetches game engine configuration from the API via useGameEngine hook
 * - Uses React Query to cache the game configuration
 * - Accesses TimeMode context to determine which format to display
 * - Handles loading and error states
 */

import { Money } from "@/components/ui/money";
import { useTimeMode, type TimeMode } from "@/contexts/time-mode-context";
import { useGameEngine } from "@/hooks/useGame";
import { amountPerTickToCashFlowRate, getUnitSuffix } from "@/lib/format-utils";
import { cn } from "@/lib/utils";

interface CashFlowProps {
    /** Cash flow in money per tick (source of truth) */
    amountPerTick: number;
    /** Time unit to display the rate in (default: "h") */
    unit?: "h" | "day" | "year";
    /** Override the time mode (default: uses context) */
    mode?: TimeMode;
    /** Additional CSS classes */
    className?: string;
}

/**
 * Displays a cash flow rate, converting from money per tick to money per time
 * unit. Uses the game engine configuration and time mode to perform accurate
 * conversions between game-time and wall-clock rates.
 *
 * @example
 *     <CashFlow amountPerTick={100} /> // Shows "X$/h" based on current time mode
 *     <CashFlow amountPerTick={100} unit="day" /> // Shows "X$/day"
 *     <CashFlow amountPerTick={100} mode="game-time" /> // Forces game-time mode
 */
export function CashFlow({
    amountPerTick,
    unit = "h",
    mode: modeOverride,
    className,
}: CashFlowProps) {
    const { mode: contextMode } = useTimeMode();
    const { data: gameEngine, isLoading } = useGameEngine();

    // Use override mode if provided, otherwise use context
    const mode = modeOverride ?? contextMode;

    // Show placeholder while loading
    if (isLoading || !gameEngine) {
        return (
            <span className={cn("text-muted-foreground", className)}>--</span>
        );
    }

    // Convert to the appropriate rate using format-utils
    const rate = amountPerTickToCashFlowRate(
        amountPerTick,
        unit,
        gameEngine,
        mode,
    );
    const suffix = getUnitSuffix(unit);

    return (
        <span className={cn("inline-flex items-center gap-0.5", className)}>
            <Money amount={rate} />
            <span>{suffix}</span>
        </span>
    );
}
