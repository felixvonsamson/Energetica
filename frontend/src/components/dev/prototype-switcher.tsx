/**
 * PROTOTYPE-ONLY infrastructure. Not for production use — see the `/prototype`
 * skill (`.claude/skills/prototype/UI.md`). Shared by any throwaway `?variant=`
 * route; delete along with the last prototype that uses it.
 *
 * Floating bottom-centre bar for cycling between UI prototype variants. Hidden
 * in production builds so a stray merge can't ship it to players.
 */
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect } from "react";

interface PrototypeSwitcherProps {
    /** Variant keys in cycle order, e.g. `["A", "B", "C"]`. */
    variants: string[];
    /** Currently active variant key. */
    current: string;
    /** Called with the newly selected variant key. The route owns the URL. */
    onChange: (variant: string) => void;
    /** Optional display name per variant key, e.g. `{ A: "Single scroll" }`. */
    names?: Record<string, string>;
}

export function PrototypeSwitcher({
    variants,
    current,
    onChange,
    names,
}: PrototypeSwitcherProps) {
    const currentIndex = Math.max(0, variants.indexOf(current));

    function go(delta: number) {
        const next =
            variants[
                (currentIndex + delta + variants.length) % variants.length
            ];
        if (next) onChange(next);
    }

    useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            const target = event.target as HTMLElement | null;
            const isEditable =
                target &&
                (target.tagName === "INPUT" ||
                    target.tagName === "TEXTAREA" ||
                    target.isContentEditable);
            if (isEditable) return;
            if (event.key === "ArrowLeft") go(-1);
            if (event.key === "ArrowRight") go(1);
        }
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentIndex, variants]);

    if (import.meta.env.PROD) return null;

    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-full border border-border-brand bg-foreground text-background px-3 py-2 shadow-lg">
            <button
                type="button"
                onClick={() => go(-1)}
                className="rounded-full p-1 hover:bg-background/20"
                aria-label="Previous variant"
            >
                <ChevronLeft className="size-4" />
            </button>
            <span className="text-xs font-medium whitespace-nowrap">
                PROTOTYPE — {current}
                {names?.[current] ? ` — ${names[current]}` : ""}
            </span>
            <button
                type="button"
                onClick={() => go(1)}
                className="rounded-full p-1 hover:bg-background/20"
                aria-label="Next variant"
            >
                <ChevronRight className="size-4" />
            </button>
        </div>
    );
}
