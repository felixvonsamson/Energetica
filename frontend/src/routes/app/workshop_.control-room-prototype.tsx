/**
 * PROTOTYPE (#1289) — throwaway route. Three layouts for the workshop's
 * control-room dashboard, with made-up data, at
 * `/app/workshop/control-room-prototype?variant=A|B|C|D1|D2|D3`. D1 to D3 show
 * the same layout at three points of a session; `?periods=0` to `24` overrides
 * how many Trading periods have settled. `?theme=light|dark` (or the T key)
 * picks the theme for D.
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
import {
    type ReactNode,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from "react";

import { PrototypeSwitcher } from "@/components/prototype-switcher";
import {
    MAX_PERIODS,
    SCENES,
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
        variant: typeof search.variant === "string" ? search.variant : "D2",
        periods:
            search.periods === undefined
                ? undefined
                : Math.min(
                      MAX_PERIODS,
                      Math.max(0, Math.round(Number(search.periods)) || 0),
                  ),
        scale: (["transform", "zoom", "none"].includes(String(search.scale))
            ? search.scale
            : "transform") as Scale,
        theme: (search.theme === "light" ? "light" : "dark") as
            | "light"
            | "dark",
    }),
    staticData: { title: "Control room (prototype)", runMode: "any" },
});

const WIDTH = 1920;
const HEIGHT = 1080;

function ControlRoomPrototype() {
    const { variant, scale, periods, theme } = Route.useSearch();
    const navigate = Route.useNavigate();
    const applied = useDocumentTheme(theme);
    // The T key switches between the light and dark theme.
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key !== "t") return;
            void navigate({
                search: (prev) => ({
                    ...prev,
                    theme: prev.theme === "light" ? "dark" : "light",
                }),
                replace: true,
            });
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [navigate]);
    return (
        <>
            <FixedCanvas mode={scale}>
                {variant === "A" && <VariantA />}
                {variant === "B" && <VariantB />}
                {variant === "C" && <VariantC />}
                {variant in SCENES && applied === theme && (
                    <VariantD
                        key={`${variant}-${periods}-${theme}`}
                        theme={theme}
                        scene={scene(
                            periods ?? SCENES[variant]!.settled,
                            SCENES[variant]!.roundCount,
                        )}
                    />
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

/**
 * Puts the app in `theme` while the page is open, so the `--asset-color-*`
 * variables give that theme's facility colours, and puts it back after. Returns
 * the theme applied so far.
 */
function useDocumentTheme(theme: "light" | "dark") {
    const [applied, setApplied] = useState<"light" | "dark" | null>(null);
    useLayoutEffect(() => {
        const root = document.documentElement;
        const before = root.classList.contains("dark") ? "dark" : "light";
        root.classList.remove("light", "dark");
        root.classList.add(theme);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- render only once the class is on
        setApplied(theme);
        return () => {
            root.classList.remove("light", "dark");
            root.classList.add(before);
        };
    }, [theme]);
    return applied;
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
