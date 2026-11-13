/**
 * PROTOTYPE — throwaway. Floating bar that cycles `?variant=` on the current
 * route. Hidden in production builds.
 */

import { useNavigate, useSearch } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect } from "react";

export function usePrototypeParam(key: string, fallback: string): string {
    const search = useSearch({ strict: false }) as Record<string, unknown>;
    const value = search[key];
    return typeof value === "string" ? value : fallback;
}

export function PrototypeSwitcher({
    param = "variant",
    variants,
    current,
    extra,
}: {
    param?: string;
    variants: { key: string; name: string }[];
    current: string;
    extra?: React.ReactNode;
}) {
    const navigate = useNavigate();
    const index = Math.max(
        0,
        variants.findIndex((v) => v.key === current),
    );
    const go = (delta: number) => {
        const next =
            variants[(index + delta + variants.length) % variants.length]!;
        navigate({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            search: ((prev: any) => ({ ...prev, [param]: next.key })) as any,
            replace: true,
        });
    };

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
            if (e.key === "ArrowLeft") go(-1);
            if (e.key === "ArrowRight") go(1);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    });

    if (import.meta.env.PROD) return null;
    const v = variants[index]!;
    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 rounded-full bg-black text-white px-2 py-1 shadow-2xl text-sm">
            <button
                onClick={() => go(-1)}
                className="p-1 hover:bg-white/20 rounded-full"
            >
                <ChevronLeft size={18} />
            </button>
            <span className="font-mono whitespace-nowrap">
                {v.key} — {v.name}
            </span>
            <button
                onClick={() => go(1)}
                className="p-1 hover:bg-white/20 rounded-full"
            >
                <ChevronRight size={18} />
            </button>
            {extra}
        </div>
    );
}
