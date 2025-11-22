/**
 * Money component for displaying currency values with appropriate formatting.
 * Uses thousands separator and scales to larger units (k, M, Md) as needed.
 */

import { DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

interface MoneyProps {
    /** The monetary value to display */
    amount: number;
    /** Whether to always show the full value without scaling (default: false) */
    long?: boolean;
    /** Additional CSS classes */
    className?: string;
    /** Size of the coin icon */
    iconSize?: "sm" | "md" | "lg";
}

/**
 * Formats money with thousands separator and appropriate unit scaling.
 * Scales: $ → k$ → M$ → Md$ (millions → billions)
 */
function formatMoneyValue(amount: number, long: boolean = false): string {
    if (long) {
        // Long format: just add thousands separator, no scaling
        return amount.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
    }

    // Short format: scale to appropriate unit
    const units = ["", "k", "M", "Md"]; // billions (Md = milliard in French)
    let value = amount;
    let unitIndex = 0;

    while (Math.abs(value) >= 10_000 && unitIndex < units.length - 1) {
        value /= 1_000;
        unitIndex += 1;
    }

    const formatted = value.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
    return unitIndex > 0 ? `${formatted}${units[unitIndex]}` : formatted;
}

/**
 * Money display component with currency icon and formatted value.
 *
 * @example
 * <Money amount={1500} /> // "1'500$"
 * <Money amount={15000} /> // "15k$"
 * <Money amount={1500000} /> // "1'500k$"
 * <Money amount={1500} long /> // "1'500$" (no scaling)
 */
export function Money({ amount, long = false, className, iconSize = "sm" }: MoneyProps) {
    const sizeClasses = {
        sm: "w-3 h-3",
        md: "w-4 h-4",
        lg: "w-5 h-5",
    };

    return (
        <span className={cn("inline-flex items-center gap-0.5", className)}>
            {formatMoneyValue(amount, long)}
            <DollarSign
                className={cn(
                    sizeClasses[iconSize],
                    "text-amber-500 dark:text-amber-400"
                )}
                strokeWidth={2.5}
            />
        </span>
    );
}
