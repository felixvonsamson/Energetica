/**
 * PROTOTYPE — throwaway UI-design harness for the T6 recap page (#864). Not for
 * production. Delete this file, the sibling `variant-*` files, and the
 * `?variant=` branch in `routes-lobby/runs.$slug.recap.tsx` once a variant is
 * chosen — see `.agents/skills/prototype/UI.md`.
 *
 * A floating bottom bar that cycles between UI variants via the `variant`
 * search param (shareable, reload-stable) and the ←/→ arrow keys.
 */

import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, FlaskConical } from "lucide-react";
import { useEffect } from "react";

export type VariantKey = "A" | "B" | "C";

const VARIANT_NAMES: Record<VariantKey, string> = {
    A: "Cards & table",
    B: "Podium spotlight",
    C: "Dense data table",
};

const ORDER: VariantKey[] = ["A", "B", "C"];

export function PrototypeSwitcher({ current }: { current: VariantKey }) {
    const navigate = useNavigate();

    const go = (delta: 1 | -1) => {
        const index = ORDER.indexOf(current);
        const next = ORDER[(index + delta + ORDER.length) % ORDER.length];
        void navigate({
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-row items-center gap-3 bg-black text-white rounded-full px-2 py-2 shadow-2xl ring-2 ring-yellow-400">
            <button
                onClick={() => go(-1)}
                className="p-2 rounded-full hover:bg-white/20 transition-colors"
                aria-label="Previous variant"
            >
                <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 text-sm font-mono px-1 min-w-40 justify-center">
                <FlaskConical className="w-3.5 h-3.5 text-yellow-400" />
                {current} — {VARIANT_NAMES[current]}
            </div>
            <button
                onClick={() => go(1)}
                className="p-2 rounded-full hover:bg-white/20 transition-colors"
                aria-label="Next variant"
            >
                <ChevronRight className="w-4 h-4" />
            </button>
        </div>
    );
}
