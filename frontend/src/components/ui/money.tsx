/**
 * Money component for displaying currency values with appropriate formatting.
 * Uses thousands separator and scales to larger units (k, M, Md) as needed.
 *
 * Built on top of DataValue for consistent monospaced display.
 */

import { DollarSign } from "lucide-react";

import { formatMoney } from "@/lib/format-utils";
import { cn } from "@/lib/utils";

import { DataValue } from "./typography";

interface MoneyProps {
    /** The monetary value to display */
    amount: number | null;
    /** Whether to always show the full value without scaling (default: false) */
    long?: boolean;
    /** Additional CSS classes */
    className?: string;
    /** Size of the coin icon */
    iconSize?: "sm" | "md" | "lg";
}

/**
 * Money display component with currency icon and formatted value. Composable
 * with typography modifiers.
 *
 * @example
 *     <Money amount={1500} /> // "1'500$"
 *     <Money amount={15000} /> // "15k$"
 *     <Money amount={1500000} /> // "1'500k$"
 *     <Money amount={1500} long /> // "1'500$" (no scaling)
 *
 * @example
 *     // Composable with typography:
 *     <TypographyH1><Money amount={50000} /></TypographyH1>
 *     <TypographyMuted><Money amount={100} /></TypographyMuted>
 */
export function Money({
    amount,
    long = false,
    className,
    iconSize = "sm",
}: MoneyProps) {
    const sizeClasses = {
        sm: "w-3 h-3",
        md: "w-4 h-4",
        lg: "w-5 h-5",
    };

    if (amount === null) return "-";

    return (
        <DataValue
            className={cn("inline-flex items-center gap-0.5", className)}
        >
            {formatMoney(amount, long)}
            <DollarSign
                className={cn(sizeClasses[iconSize])}
                strokeWidth={2.5}
            />
        </DataValue>
    );
}
