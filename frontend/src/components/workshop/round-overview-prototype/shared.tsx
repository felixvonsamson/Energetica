/**
 * PROTOTYPE (#1008) — throwaway. Small pieces the Round overview variants
 * share: number formatting, the "–" and blackout cells, and the props every
 * variant takes. Layout is deliberately not shared.
 */

import { Zap } from "lucide-react";

import { Money } from "@/components/ui/money";
import { DataValue } from "@/components/ui/typography";
import { formatEnergy, formatMass } from "@/lib/format-utils";
import { cn } from "@/lib/utils";

import type { RoundData } from "./data";

export interface VariantProps {
    round: RoundData;
    /**
     * Show the rows for features that don't exist yet (revenue tax, fuel,
     * carbon tax).
     */
    futureRows: boolean;
}

/** A money figure; costs are passed positive and shown with a minus sign. */
export function Amount({
    value,
    cost = false,
    className,
}: {
    value: number;
    cost?: boolean;
    className?: string;
}) {
    const shown = cost ? -value : value;
    return (
        <Money
            amount={Math.round(shown)}
            className={cn(
                shown < 0 && "text-red-600 dark:text-red-400",
                className,
            )}
        />
    );
}

export const mwh = (value: number) => formatEnergy(value * 1_000_000);
export const tonnes = (value: number) => formatMass(value * 1_000);
export const pct = (value: number) => `${Math.round(value * 100)} %`;

export function PerMwh({ price }: { price: number }) {
    return <DataValue>{price.toFixed(1)} $/MWh</DataValue>;
}

export function Dash() {
    return <span className="text-muted-foreground">–</span>;
}

export function BlackoutMark({ label = false }: { label?: boolean }) {
    return (
        <span
            className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400"
            title="A blackout ended the Round in this season"
        >
            <Zap className="size-3" />
            {label && "Blackout"}
        </span>
    );
}

export function SkippedCell() {
    return (
        <span
            className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400"
            title="Not played: a blackout ended the Round"
        >
            <Zap className="size-3" />
            Blackout
        </span>
    );
}
