/**
 * PROTOTYPE — throwaway. A floating bar for flipping between the variants of a
 * UI prototype. ← and → cycle through them too. Extra prototype-only controls
 * (sample-data pickers and such) go in `children`. Never rendered in a
 * production build.
 */

import { ChevronLeft, ChevronRight } from "lucide-react";
import { type ReactNode, useEffect } from "react";

export interface PrototypeVariant<K extends string> {
    key: K;
    name: string;
}

export function PrototypeSwitcher<K extends string>({
    variants,
    current,
    onChange,
    children,
}: {
    variants: PrototypeVariant<K>[];
    current: K;
    onChange: (key: K) => void;
    children?: ReactNode;
}) {
    const index = Math.max(
        0,
        variants.findIndex((v) => v.key === current),
    );
    const step = (by: number) =>
        onChange(
            variants[(index + by + variants.length) % variants.length]!.key,
        );

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            if (
                target?.closest("input, textarea, [contenteditable]") ||
                event.metaKey ||
                event.ctrlKey ||
                event.altKey
            )
                return;
            if (event.key === "ArrowLeft") step(-1);
            if (event.key === "ArrowRight") step(1);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    });

    if (import.meta.env.PROD) return null;

    return (
        <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-zinc-900 px-3 py-1.5 text-sm text-white shadow-xl ring-2 ring-fuchsia-500">
            <span className="text-xs font-bold text-fuchsia-400">
                PROTOTYPE
            </span>
            <button
                type="button"
                onClick={() => step(-1)}
                className="rounded-full p-1 hover:bg-white/15"
                aria-label="Previous variant"
            >
                <ChevronLeft className="size-4" />
            </button>
            <span className="min-w-48 text-center">
                {variants[index]!.key} — {variants[index]!.name}
            </span>
            <button
                type="button"
                onClick={() => step(1)}
                className="rounded-full p-1 hover:bg-white/15"
                aria-label="Next variant"
            >
                <ChevronRight className="size-4" />
            </button>
            {children && (
                <div className="flex items-center gap-3 border-l border-white/20 pl-3">
                    {children}
                </div>
            )}
        </div>
    );
}
