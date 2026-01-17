/**
 * PriceInput component - Input field for editing electricity prices. Displays a
 * number input with $ prefix and -5%/+5% adjustment buttons.
 */

import { Minus, Plus } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PriceInputProps {
    /** Current price value */
    value: number;
    /** Callback when price changes */
    onChange: (newPrice: number) => void;
    /** Whether the input is disabled */
    disabled?: boolean;
}

/**
 * Price input field with increment/decrement buttons. Allows direct editing of
 * prices with +5% and -5% quick adjustment buttons. Minimum price is -5.
 */
export function PriceInput({
    value,
    onChange,
    disabled = false,
}: PriceInputProps) {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = parseFloat(e.target.value);
        if (!isNaN(newValue) && newValue > -5) {
            onChange(newValue);
        }
    };

    const adjustPrice = (percentage: number) => {
        const newValue = value * (1 + percentage / 100);
        // Ensure minimum price constraint
        if (newValue > -5) {
            onChange(Math.round(newValue * 100) / 100); // Round to 2 decimals
        }
    };

    return (
        <div className="flex items-center gap-2">
            {/* -5% button */}
            <button
                onClick={() => adjustPrice(-5)}
                disabled={disabled}
                className={cn(
                    "px-1 py-2 text-xs font-medium rounded-md",
                    "border border-gray-300 dark:border-gray-600",
                    "bg-card",
                    "text-gray-700 dark:text-gray-300",
                    "hover:bg-gray-50 dark:hover:bg-gray-700",
                    "focus:outline-none focus:ring-2 focus:ring-brand-green",
                    "transition-colors",
                    disabled && "opacity-50 cursor-not-allowed",
                )}
                title="Decrease price by 5%"
            >
                <Minus className="w-3 h-3 inline-block mr-0.5" />
                5%
            </button>

            {/* Price input with $ prefix */}
            <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-gray-400">
                    $
                </span>
                <Input
                    type="number"
                    value={value.toFixed(2)}
                    onChange={handleChange}
                    disabled={disabled}
                    step="0.01"
                    min="-4.99"
                />
            </div>

            {/* +5% button */}
            <button
                onClick={() => adjustPrice(5)}
                disabled={disabled}
                className={cn(
                    "px-1 py-2 text-xs font-medium rounded-md",
                    "border border-gray-300 dark:border-gray-600",
                    "bg-card",
                    "text-gray-700 dark:text-gray-300",
                    "hover:bg-gray-50 dark:hover:bg-gray-700",
                    "focus:outline-none focus:ring-2 focus:ring-brand-green",
                    "transition-colors",
                    disabled && "opacity-50 cursor-not-allowed",
                )}
                title="Increase price by 5%"
            >
                <Plus className="w-3 h-3 inline-block mr-0.5" />
                5%
            </button>
        </div>
    );
}
