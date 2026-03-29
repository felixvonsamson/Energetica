/**
 * PriceInput component - Inline number input for editing electricity prices.
 * Uses local state while typing, commits on blur or Enter.
 */

import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";

interface PriceInputProps {
    /** Current price value from server */
    value: number;
    /** Called with the committed price on blur / Enter */
    onCommit: (newPrice: number) => void;
    /** Disable interaction while a mutation is in flight */
    disabled?: boolean;
}

export function PriceInput({ value, onCommit, disabled = false }: PriceInputProps) {
    const [localValue, setLocalValue] = useState(value.toFixed(2));

    // Sync from server when value prop changes (e.g. after mutation settles)
    useEffect(() => {
        setLocalValue(value.toFixed(2));
    }, [value]);

    const commit = () => {
        const parsed = parseFloat(localValue);
        if (!isNaN(parsed)) {
            onCommit(parsed);
        } else {
            setLocalValue(value.toFixed(2)); // reset on invalid input
        }
    };

    return (
        <div className="relative w-28">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-gray-400 pointer-events-none">
                $
            </span>
            <Input
                type="number"
                value={localValue}
                onChange={(e) => setLocalValue(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                }}
                disabled={disabled}
                step="0.01"
                min="-4.99"
                className="pl-6"
            />
        </div>
    );
}
