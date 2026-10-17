import CoinSvg from "#ui/assets/coin.svg?react";
import { cn } from "#ui/lib/utils";

interface CoinIconProps {
    className?: string;
}

/**
 * Coin icon for displaying the in-game currency. Behaves like a Lucide icon —
 * size via Tailwind w-/h- classes.
 */
export function CoinIcon({ className }: CoinIconProps) {
    return (
        <CoinSvg
            aria-hidden="true"
            className={cn("inline-block shrink-0", className)}
        />
    );
}
