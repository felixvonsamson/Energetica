/**
 * PROTOTYPE — throwaway (issue #1440, round 2). Question: can the landing hero
 * keep what works about the AI banner (colour, recognisable facilities, flat
 * cartoon look) while gaining depth (scroll parallax) and ambient motion, and
 * can the same approach produce the facility assets?
 *
 * Five variants on the existing `/` route, switchable with `?variant=` or the
 * floating bar (← / → keys too). `?amp=` sets the parallax strength in banner
 * pixels (bar has − / +). `?s=0…1` pins the scroll progress.
 *
 * Each variant lives in its own file under ./variants/ and owns its own assets.
 * Variants receive the scroll progress two ways: the wrapper div carries the
 * CSS variables `--s` (0 at the top of the page, 1 once the hero has scrolled
 * away) and `--amp`, and `progress.current` holds the same number for canvas
 * code.
 */
import { lazy, Suspense, useEffect, useRef, useState } from "react";

import "./hero-scene.prototype.css";

// Lazy, so one variant failing to load (e.g. mid-edit) doesn't take the page down.
const FacilitiesVariant = lazy(() =>
    import("./variants/facilities").then((m) => ({
        default: m.FacilitiesVariant,
    })),
);
const ProjectedVariant = lazy(() =>
    import("./variants/projected").then((m) => ({
        default: m.ProjectedVariant,
    })),
);
const RasterDepthVariant = lazy(() =>
    import("./variants/raster-depth").then((m) => ({
        default: m.RasterDepthVariant,
    })),
);
const TracedVariant = lazy(() =>
    import("./variants/traced").then((m) => ({ default: m.TracedVariant })),
);

export type VariantProps = {
    originalSrc: string;
    amp: number;
    progress: React.RefObject<number>;
};

const VARIANTS = [
    { key: "projected", label: "3D scene projected to SVG" },
    { key: "facilities", label: "Facility assets, same 3D models" },
    { key: "traced", label: "Auto-traced vector, depth layers" },
    { key: "raster-depth", label: "Original image + depth parallax" },
    { key: "original", label: "Original AI image" },
] as const;
type VariantKey = (typeof VARIANTS)[number]["key"];

function readParams(): { variant: VariantKey; amp: number } {
    const params = new URLSearchParams(window.location.search);
    const v = params.get("variant");
    const variant = VARIANTS.find((x) => x.key === v)?.key ?? "projected";
    const amp = Number(params.get("amp") ?? 40);
    return { variant, amp: Number.isFinite(amp) ? amp : 40 };
}

function writeParam(key: string, value: string) {
    const url = new URL(window.location.href);
    url.searchParams.set(key, value);
    window.history.replaceState(window.history.state, "", url);
}

export function HeroScenePrototype({ originalSrc }: { originalSrc: string }) {
    const [{ variant, amp }, setState] = useState(readParams);
    const ref = useRef<HTMLDivElement>(null);
    const progress = useRef(0);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        let frame = 0;
        const update = () => {
            frame = 0;
            const rect = el.getBoundingClientRect();
            const top = rect.top + window.scrollY;
            const pinned = new URLSearchParams(window.location.search).get("s");
            const s = pinned
                ? Number(pinned)
                : Math.min(
                      1,
                      Math.max(0, window.scrollY / (top + rect.height)),
                  );
            progress.current = s;
            // Custom properties inherit, so changing --s here restyles every node below. The
            // projected variant moves its layers itself from `progress` instead.
            if (variant !== "projected")
                el.style.setProperty("--s", s.toFixed(4));
        };
        const onScroll = () => {
            if (!frame) frame = requestAnimationFrame(update);
        };
        update();
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);
        return () => {
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onScroll);
            cancelAnimationFrame(frame);
        };
    }, [variant]);

    // `?bench`: scroll down and back up over 4 s, then sit idle for 2 s, recording frame
    // intervals. The result lands on window.__heroBench (read by a headless Chrome script).
    useEffect(() => {
        if (!new URLSearchParams(window.location.search).has("bench")) return;
        const frames = (ms: number, onFrame?: (t: number) => void) =>
            new Promise<number[]>((resolve) => {
                const deltas: number[] = [];
                const t0 = performance.now();
                let last = t0;
                const step = (now: number) => {
                    deltas.push(now - last);
                    last = now;
                    onFrame?.((now - t0) / ms);
                    if (now - t0 < ms) requestAnimationFrame(step);
                    else resolve(deltas.slice(1));
                };
                requestAnimationFrame(step);
            });
        const stats = (d: number[]) => {
            const s = [...d].sort((a, b) => a - b);
            const mean = d.reduce((a, b) => a + b, 0) / d.length;
            return {
                fps: Math.round(1000 / mean),
                p95ms: Math.round(s[Math.floor(s.length * 0.95)] ?? 0),
                over33ms: d.filter((x) => x > 33.4).length,
                frames: d.length,
            };
        };
        const max = Math.min(
            document.documentElement.scrollHeight - window.innerHeight,
            1000,
        );
        (window as unknown as { __heroBench: Promise<unknown> }).__heroBench =
            (async () => {
                await new Promise((r) => setTimeout(r, 2000));
                const scroll = await frames(4000, (t) =>
                    window.scrollTo(
                        0,
                        max *
                            (0.5 -
                                0.5 * Math.cos(Math.min(t, 1) * 2 * Math.PI)),
                    ),
                );
                const idle = await frames(2000);
                return { scroll: stats(scroll), idle: stats(idle) };
            })();
    }, []);

    const props: VariantProps = { originalSrc, amp, progress };
    return (
        <>
            <div
                ref={ref}
                className="hs"
                style={{ "--amp": amp } as React.CSSProperties}
            >
                <Suspense
                    fallback={<div className="aspect-[2167/725] bg-sky-200" />}
                >
                    {variant === "projected" && <ProjectedVariant {...props} />}
                    {variant === "facilities" && (
                        <FacilitiesVariant {...props} />
                    )}
                    {variant === "traced" && <TracedVariant {...props} />}
                    {variant === "raster-depth" && (
                        <RasterDepthVariant {...props} />
                    )}
                </Suspense>
                {variant === "original" && (
                    <img
                        src={originalSrc}
                        alt="Energetica game interface showing power grid management"
                        className="w-full h-auto"
                    />
                )}
            </div>
            <PrototypeSwitcher
                variant={variant}
                onVariant={(v) => {
                    writeParam("variant", v);
                    setState((s) => ({ ...s, variant: v }));
                }}
                amp={amp}
                onAmp={(a) => {
                    writeParam("amp", String(a));
                    setState((s) => ({ ...s, amp: a }));
                }}
            />
        </>
    );
}

function PrototypeSwitcher({
    variant,
    onVariant,
    amp,
    onAmp,
}: {
    variant: VariantKey;
    onVariant: (v: VariantKey) => void;
    amp: number;
    onAmp: (a: number) => void;
}) {
    const index = VARIANTS.findIndex((v) => v.key === variant);
    const cycle = (step: number) =>
        onVariant(
            VARIANTS[(index + step + VARIANTS.length) % VARIANTS.length]!.key,
        );

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const t = e.target as HTMLElement | null;
            if (t?.closest("input, textarea, [contenteditable]")) return;
            if (e.key === "ArrowLeft") cycle(-1);
            if (e.key === "ArrowRight") cycle(1);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    });

    if (import.meta.env.PROD) return null;
    const button = "px-2 py-1 rounded-full hover:bg-white/15";
    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-black/85 px-3 py-1.5 text-sm text-white shadow-xl font-mono">
            <span className="text-xs opacity-60">PROTOTYPE</span>
            <button type="button" className={button} onClick={() => cycle(-1)}>
                ←
            </button>
            <span className="min-w-72 text-center">
                {variant} — {VARIANTS[index]?.label}
            </span>
            <button type="button" className={button} onClick={() => cycle(1)}>
                →
            </button>
            <span className="mx-1 h-4 w-px bg-white/30" />
            <span className="text-xs opacity-60">parallax</span>
            <button
                type="button"
                className={button}
                onClick={() => onAmp(Math.max(0, amp - 10))}
            >
                −
            </button>
            <span className="w-8 text-center">{amp}</span>
            <button
                type="button"
                className={button}
                onClick={() => onAmp(amp + 10)}
            >
                +
            </button>
        </div>
    );
}
