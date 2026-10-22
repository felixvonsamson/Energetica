/**
 * PROTOTYPE — throwaway. A floating bar for flipping between the variants of a
 * UI prototype. The ← and → keys also cycle. Never shown in a production
 * build.
 *
 * It fades out after a few seconds without mouse movement, so it stays off a
 * projector screenshot.
 */

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

export function PrototypeSwitcher({
    variants,
    current,
    onChange,
}: {
    variants: { key: string; name: string }[];
    current: string;
    onChange: (key: string) => void;
}) {
    const [visible, setVisible] = useState(true);
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
            if (target?.closest("input, textarea, [contenteditable]")) return;
            if (event.key === "ArrowLeft") step(-1);
            if (event.key === "ArrowRight") step(1);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    });

    useEffect(() => {
        let timer = setTimeout(() => setVisible(false), 3000);
        const onMove = () => {
            setVisible(true);
            clearTimeout(timer);
            timer = setTimeout(() => setVisible(false), 3000);
        };
        window.addEventListener("mousemove", onMove);
        return () => {
            clearTimeout(timer);
            window.removeEventListener("mousemove", onMove);
        };
    }, []);

    if (import.meta.env.PROD) return null;
    const variant = variants[index]!;
    return (
        <div
            className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-fuchsia-400 bg-fuchsia-950/90 px-2 py-1 text-sm text-fuchsia-50 shadow-lg transition-opacity duration-500"
            style={{ opacity: visible ? 1 : 0 }}
        >
            <button
                type="button"
                onClick={() => step(-1)}
                className="rounded-full p-1 hover:bg-fuchsia-800"
            >
                <ChevronLeft className="size-4" />
            </button>
            <span className="min-w-48 text-center font-medium">
                {variant.key} — {variant.name}
            </span>
            <button
                type="button"
                onClick={() => step(1)}
                className="rounded-full p-1 hover:bg-fuchsia-800"
            >
                <ChevronRight className="size-4" />
            </button>
        </div>
    );
}
