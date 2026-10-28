/**
 * PROTOTYPE, throwaway: a floating bar to flip between a prototype's variants,
 * with the arrow buttons or the ← and → keys. Hidden in production builds.
 *
 * It floats at the top of the screen, since the review prototypes put their
 * navigator in a sticky bar at the bottom.
 */

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect } from "react";

export function PrototypeSwitcher<K extends string>({
    variants,
    current,
    onChange,
}: {
    variants: readonly { key: K; name: string }[];
    current: K;
    onChange: (key: K) => void;
}) {
    const index = Math.max(
        0,
        variants.findIndex((variant) => variant.key === current),
    );
    const cycle = (by: number) => {
        const next = variants[(index + by + variants.length) % variants.length];
        if (next) onChange(next.key);
    };

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            if (
                target?.closest("input, textarea, select, [contenteditable]")
            )
                return;
            if (e.key === "ArrowLeft") cycle(-1);
            if (e.key === "ArrowRight") cycle(1);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    });

    if (import.meta.env.PROD) return null;
    const variant = variants[index];

    return (
        <div className="fixed left-1/2 top-3 z-[100] flex -translate-x-1/2 items-center gap-1 rounded-full bg-black px-2 py-1 text-sm text-white shadow-2xl ring-2 ring-fuchsia-500">
            <button
                type="button"
                aria-label="Previous variant"
                className="rounded-full p-1 hover:bg-white/20"
                onClick={() => cycle(-1)}
            >
                <ChevronLeft className="size-4" />
            </button>
            <span className="px-2 font-mono">
                {variant?.key} — {variant?.name}
            </span>
            <button
                type="button"
                aria-label="Next variant"
                className="rounded-full p-1 hover:bg-white/20"
                onClick={() => cycle(1)}
            >
                <ChevronRight className="size-4" />
            </button>
        </div>
    );
}
