/**
 * The control room's colours (#1289). The page is always dark, like a control
 * room, and the projector shows it best.
 *
 * Facility colours are not here: they are the app's own `--asset-color-*`
 * variables, read while the page holds the document in its dark theme, so the
 * projector shows the colours players see on their own screens.
 */

import { resolveCSSVar } from "@/lib/charts/color-utils";
import type { ApiSchema } from "@/types/api-helpers";

type PowerSource = ApiSchema<"PowerSource">;

export const THEME = {
    bg: "#05080d",
    panel: "#0a1220",
    border: "#1d2b40",
    ink: "#d6e6ff",
    dim: "#7d93b3",
    grid: "#1d2b40",
    row: "#0e1828",
    accent: "#4fc3ff",
    accentBand: "rgba(79, 195, 255, 0.22)",
    accentBorder: "rgba(79, 195, 255, 0.5)",
    whisker: "#8193ad",
    liveFill: "#0a1220",
    up: "#ff8a1f",
    down: "#2fd67b",
    good: "#2fd67b",
    warn: "#ffd21f",
    orange: "#ff8a1f",
    bar: "#9aa7b8",
    barPartial: "#4a5568",
    alarm: { critical: "#ff3b3b", warning: "#ffb020", info: "#4fc3ff" },
    track: "#111b2c",
    weather: ["#2b6e8f", "#1f5470"],
    risk: {
        guaranteed: "#ff3b3b",
        likely: "#ff8a1f",
        unlikely: "#ffd21f",
        very_unlikely: "#2fd67b",
    },
} as const;

export const MONO = "ui-monospace, monospace";

/** The facility whose colour stands for each power source. */
const SOURCE_ASSETS: Record<PowerSource, string> = {
    coal: "coal-burner",
    gas: "gas-burner",
    nuclear: "nuclear-reactor",
    hydro: "small-water-dam",
    wind: "onshore-wind-turbine",
    solar: "pv-solar",
    storage: "lithium-ion-batteries",
};

/** A power source's colour, from the app's facility colours. */
export function sourceColor(source: PowerSource): string {
    return resolveCSSVar(`--asset-color-${SOURCE_ASSETS[source]}`);
}

/**
 * The colour a power source's name is written in. Coal's facility grey is too
 * dark to read on a panel, so its name is lighter.
 */
export function sourceTitleColor(source: PowerSource): string {
    return source === "coal" ? "#b4b8bf" : sourceColor(source);
}
