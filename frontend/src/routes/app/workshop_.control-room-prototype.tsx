/**
 * PROTOTYPE (#1289) — throwaway route. Three layouts for the workshop's
 * control-room dashboard, with made-up data, at
 * `/app/workshop/control-room-prototype?variant=A|B|C|D`. For D, `?periods=0`
 * to `8` sets how many Trading periods have settled.
 *
 * It renders outside the Workshop shell (the `_` in the file name), since the
 * projector page has no top bar, and opens in either Run mode without
 * entering.
 *
 * The page is a fixed 1920×1080 canvas, scaled down as a whole to fit the
 * window so the layout never changes. `?scale=` picks how: `transform` (CSS
 * `transform: scale()`, the default), `zoom` (CSS `zoom`), or `none` (1:1).
 */

import { createFileRoute } from "@tanstack/react-router";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

import { PrototypeSwitcher } from "@/components/prototype-switcher";
import {
    MAX_PERIODS,
    scene,
} from "@/components/workshop/control-room-prototype/history";
import { VariantD } from "@/components/workshop/control-room-prototype/variant-d";
import {
    VARIANTS,
    VariantA,
    VariantB,
    VariantC,
} from "@/components/workshop/control-room-prototype/variants";

type Scale = "transform" | "zoom" | "none";

export const Route = createFileRoute("/app/workshop_/control-room-prototype")({
    component: ControlRoomPrototype,
    validateSearch: (search: Record<string, unknown>) => ({
        variant: typeof search.variant === "string" ? search.variant : "D",
        periods: Math.min(
            MAX_PERIODS,
            Math.max(0, Math.round(Number(search.periods ?? MAX_PERIODS)) || 0),
        ),
        scale: (["transform", "zoom", "none"].includes(String(search.scale))
            ? search.scale
            : "transform") as Scale,
    }),
    staticData: { title: "Control room (prototype)", runMode: "any" },
});

const WIDTH = 1920;
const HEIGHT = 1080;

function ControlRoomPrototype() {
    const { variant, scale, periods } = Route.useSearch();
    const navigate = Route.useNavigate();
    return (
        <>
            <FixedCanvas mode={scale}>
                {variant === "A" && <VariantA />}
                {variant === "B" && <VariantB />}
                {variant === "C" && <VariantC />}
                {variant === "D" && (
                    <VariantD key={periods} scene={scene(periods)} />
                )}
            </FixedCanvas>
            <PrototypeSwitcher
                variants={VARIANTS}
                current={variant}
                onChange={(key) =>
                    void navigate({
                        search: (prev) => ({ ...prev, variant: key }),
                        replace: true,
                    })
                }
            />
        </>
    );
}

/** The size of the element, kept up to date. */
function useBoxSize() {
    const ref = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ width: WIDTH, height: HEIGHT });
    useLayoutEffect(() => {
        if (!ref.current) return;
        const observer = new ResizeObserver(([entry]) => {
            if (entry)
                setSize({
                    width: entry.contentRect.width,
                    height: entry.contentRect.height,
                });
        });
        observer.observe(ref.current);
        return () => observer.disconnect();
    }, []);
    return [ref, size] as const;
}

function FixedCanvas({ mode, children }: { mode: Scale; children: ReactNode }) {
    const [ref, box] = useBoxSize();
    const s =
        mode === "none" ? 1 : Math.min(box.width / WIDTH, box.height / HEIGHT);
    const canvasStyle: React.CSSProperties = {
        width: WIDTH,
        height: HEIGHT,
        background: "#05080d",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    };
    return (
        <div
            ref={ref}
            className="fixed top-0 left-0 z-40 h-[100vh] w-[100vw] overflow-hidden bg-black"
        >
            {mode === "zoom" ? (
                <div
                    style={{
                        ...canvasStyle,
                        zoom: s,
                        marginLeft: (box.width / s - WIDTH) / 2,
                        marginTop: (box.height / s - HEIGHT) / 2,
                    }}
                >
                    {children}
                </div>
            ) : (
                <div
                    style={{
                        ...canvasStyle,
                        position: "absolute",
                        left: (box.width - WIDTH * s) / 2,
                        top: (box.height - HEIGHT * s) / 2,
                        transform: `scale(${s})`,
                        transformOrigin: "top left",
                    }}
                >
                    {children}
                </div>
            )}
        </div>
    );
}
