/**
 * THROWAWAY PROTOTYPE — recap page variant switcher, issue #864 (T6).
 *
 * Floating bottom bar that cycles UI variants via the `variant` search param
 * (shareable, reload-stable) and the ←/→ keys. Hidden in production builds.
 * Delete the whole `recap-prototype/` dir + the `/recap-prototype` route once a
 * variant wins — see `.claude/skills/prototype/UI.md`.
 */

import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, FlaskConical } from "lucide-react";
import { useEffect } from "react";

export type VariantKey = "A" | "B" | "C";

const VARIANT_NAMES: Record<VariantKey, string> = {
    A: "Ledger — table-hero",
    B: "Facets — top movers",
    C: "Atlas — map-hero",
};

const ORDER: VariantKey[] = ["A", "B", "C"];

export function PrototypeSwitcher({ current }: { current: VariantKey }) {
    const navigate = useNavigate();

    const go = (delta: 1 | -1) => {
        const index = ORDER.indexOf(current);
        const next = ORDER[(index + delta + ORDER.length) % ORDER.length]!;
        // Throwaway: cast past the router's search-param union (this file is
        // cross-checked by both the app and lobby TS projects).
        void (navigate as (opts: unknown) => unknown)({
            to: ".",
            search: (prev: Record<string, unknown>) => ({
                ...prev,
                variant: next,
            }),
        });
    };

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            if (
                target &&
                (target.tagName === "INPUT" ||
                    target.tagName === "TEXTAREA" ||
                    target.isContentEditable)
            ) {
                return;
            }
            if (event.key === "ArrowLeft") go(-1);
            if (event.key === "ArrowRight") go(1);
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [current]);

    return (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-row items-center gap-3 rounded-full bg-black px-2 py-2 text-white shadow-2xl ring-2 ring-yellow-400">
            <button
                onClick={() => go(-1)}
                className="rounded-full p-2 transition-colors hover:bg-white/20"
                aria-label="Previous variant"
            >
                <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex min-w-48 items-center justify-center gap-1.5 px-1 font-mono text-sm">
                <FlaskConical className="h-3.5 w-3.5 text-yellow-400" />
                {current} — {VARIANT_NAMES[current]}
            </div>
            <button
                onClick={() => go(1)}
                className="rounded-full p-2 transition-colors hover:bg-white/20"
                aria-label="Next variant"
            >
                <ChevronRight className="h-4 w-4" />
            </button>
        </div>
    );
}
