/**
 * PriceInput component - Inline number input for editing electricity prices.
 * Uses local state while typing, commits on blur or Enter.
 */

import { useEffect, useState } from "react";

import { CoinIcon } from "@/components/ui/coin-icon";
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
        <div className="relative w-36 mx-auto">
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
                className="pr-14 border-border-brand font-mono"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none inline-flex items-center gap-0.5">
                <CoinIcon className="size-3" />/MWh
            </span>
        </div>
    );
}
