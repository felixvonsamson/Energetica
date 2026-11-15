/** PROTOTYPE (#1462), throwaway: the floating bar that cycles the variants. */

import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect } from "react";

import { VARIANTS, type VariantKey } from "./variants";

const KEYS = Object.keys(VARIANTS) as VariantKey[];

export function PrototypeSwitcher({ current }: { current: VariantKey }) {
    const navigate = useNavigate();
    const go = (step: number) => {
        const next =
            KEYS[(KEYS.indexOf(current) + step + KEYS.length) % KEYS.length]!;
        void navigate({
            to: ".",
            search: { variant: next },
            replace: true,
            resetScroll: false,
        });
    };

    useEffect(() => {
        function onKey(event: KeyboardEvent) {
            const target = event.target as HTMLElement | null;
            if (target?.closest("input, textarea, [contenteditable='true']"))
                return;
            if (event.key === "ArrowLeft") go(-1);
            if (event.key === "ArrowRight") go(1);
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    });

    if (import.meta.env.PROD) return null;
    return (
        <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-neutral-950 px-3 py-2 text-sm font-semibold text-white shadow-2xl ring-2 ring-fuchsia-500">
            <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Previous variant"
            >
                <ChevronLeft className="size-5" />
            </button>
            <span>
                {current} — {VARIANTS[current].name}
            </span>
            <button
                type="button"
                onClick={() => go(1)}
                aria-label="Next variant"
            >
                <ChevronRight className="size-5" />
            </button>
        </div>
    );
}
