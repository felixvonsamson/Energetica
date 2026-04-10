/**
 * CashFlow component for displaying cash flow rates in game-time.
 *
 * Accepts cash flow in money per tick and converts to the appropriate rate
 * representation. Uses the game engine configuration to compute the actual rates.
 */

import { Money } from "@/components/ui/money";
import { useGameEngine } from "@/hooks/use-game";
import { amountPerTickToCashFlowRate, getUnitSuffix } from "@/lib/format-utils";
import { cn } from "@/lib/utils";

interface CashFlowProps {
    /** Cash flow in money per tick (source of truth) */
    amountPerTick: number;
    /** Time unit to display the rate in (default: "h") */
    unit?: "h" | "day" | "year";
    /** Additional CSS classes */
    className?: string;
}

/**
 * Displays a cash flow rate, converting from money per tick to money per time
 * unit. Uses the game engine configuration to perform accurate conversions.
 *
 * @example
 *     <CashFlow amountPerTick={100} /> // Shows "X$/h"
 *     <CashFlow amountPerTick={100} unit="day" /> // Shows "X$/day"
 */
export function CashFlow({
    amountPerTick,
    unit = "h",
    className,
}: CashFlowProps) {
    const { data: gameEngine, isLoading } = useGameEngine();

    if (isLoading || !gameEngine) {
        return (
            <span className={cn("text-muted-foreground", className)}>--</span>
        );
    }

    const rate = amountPerTickToCashFlowRate(amountPerTick, unit, gameEngine);
    const suffix = getUnitSuffix(unit);

    return (
        <span className={cn("inline-flex items-center gap-0.5", className)}>
            <Money amount={rate} />
            <span>{suffix}</span>
        </span>
    );
}
