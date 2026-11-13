/**
 * PROTOTYPE — throwaway. The floating bottom bar that flips between variants
 * (`?variant=`) and fixture sets (`?data=`). Left/right arrow keys cycle
 * variants. Hidden in production builds.
 */

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect } from "react";

export function PrototypeSwitcher<V extends string, D extends string>({
    variants,
    current,
    onVariant,
    dataSets,
    currentData,
    onData,
}: {
    variants: { key: V; name: string }[];
    current: V;
    onVariant: (v: V) => void;
    dataSets: { key: D; name: string }[];
    currentData: D;
    onData: (d: D) => void;
}) {
    const index = Math.max(
        0,
        variants.findIndex((v) => v.key === current),
    );
    const step = (delta: number) =>
        onVariant(
            variants[(index + delta + variants.length) % variants.length]!.key,
        );

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const t = e.target as HTMLElement | null;
            if (
                t &&
                (t.tagName === "INPUT" ||
                    t.tagName === "TEXTAREA" ||
                    t.isContentEditable)
            )
                return;
            if (e.key === "ArrowLeft") step(-1);
            if (e.key === "ArrowRight") step(1);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    });

    if (import.meta.env.PROD) return null;

    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-row items-center gap-2 rounded-full bg-black text-white px-2 py-1.5 shadow-2xl font-mono text-xs">
            <button
                type="button"
                onClick={() => step(-1)}
                className="p-1.5 rounded-full hover:bg-white/20"
                aria-label="Previous variant"
            >
                <ChevronLeft size={16} />
            </button>
            <span className="min-w-56 text-center">
                {variants[index]!.key} — {variants[index]!.name}
            </span>
            <button
                type="button"
                onClick={() => step(1)}
                className="p-1.5 rounded-full hover:bg-white/20"
                aria-label="Next variant"
            >
                <ChevronRight size={16} />
            </button>
            <span className="w-px h-5 bg-white/30 mx-1" />
            {dataSets.map((d) => (
                <button
                    key={d.key}
                    type="button"
                    onClick={() => onData(d.key)}
                    className={`px-2.5 py-1 rounded-full ${d.key === currentData ? "bg-white text-black" : "hover:bg-white/20"}`}
                >
                    {d.name}
                </button>
            ))}
        </div>
    );
}
