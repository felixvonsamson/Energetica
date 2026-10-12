/**
 * PROTOTYPE — wipe me. The floating bar that flips between a prototype's UI
 * variants. ← and → cycle too, except while typing in a field. Hidden in
 * production builds so a stray merge cannot ship it.
 */

import { ChevronLeft, ChevronRight } from "lucide-react";
import { type ReactNode, useEffect } from "react";

export interface PrototypeVariant {
    key: string;
    name: string;
}

export function PrototypeSwitcher({
    variants,
    current,
    onChange,
    children,
}: {
    variants: PrototypeVariant[];
    current: string;
    onChange: (key: string) => void;
    /** Extra controls, e.g. a data-scenario picker. */
    children?: ReactNode;
}) {
    const index = Math.max(
        0,
        variants.findIndex((variant) => variant.key === current),
    );
    const step = (by: number) =>
        onChange(
            variants[(index + by + variants.length) % variants.length]!.key,
        );

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest("input, textarea, select, [contenteditable]"))
                return;
            if (event.key === "ArrowLeft") step(-1);
            if (event.key === "ArrowRight") step(1);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    });

    if (!import.meta.env.DEV) return null;

    const variant = variants[index]!;
    return (
        <div className="fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-full border-2 border-fuchsia-500 bg-neutral-950 px-2 py-1.5 text-sm text-white shadow-2xl">
            <button
                type="button"
                onClick={() => step(-1)}
                className="rounded-full p-1 hover:bg-white/15"
                aria-label="Previous variant"
            >
                <ChevronLeft className="size-4" />
            </button>
            <span className="min-w-48 text-center font-mono">
                {variant.key} — {variant.name}
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
                <span className="flex items-center gap-1 border-l border-white/25 pl-2">
                    {children}
                </span>
            )}
        </div>
    );
}
