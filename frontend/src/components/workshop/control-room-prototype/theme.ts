/**
 * PROTOTYPE (#1289) — throwaway. Light and dark colours for variant D, picked
 * with `?theme=light|dark`.
 *
 * Facility colours are not here: they come from the app's own `--asset-color-*`
 * variables, so the dashboard shows the colours players see on their own screen
 * in the same theme.
 */

import { resolveCSSVar } from "@/lib/charts/color-utils";

export interface CrTheme {
    name: "light" | "dark";
    bg: string;
    panel: string;
    border: string;
    ink: string;
    dim: string;
    grid: string;
    row: string;
    track: string;
    accent: string;
    accentBand: string;
    accentBorder: string;
    weather: [string, string];
    whisker: string;
    liveFill: string;
    up: string;
    down: string;
    good: string;
    warn: string;
    orange: string;
    bar: string;
    barPartial: string;
    alarm: Record<"critical" | "warning" | "info", string>;
}

export const THEMES: Record<"light" | "dark", CrTheme> = {
    dark: {
        name: "dark",
        bg: "#05080d",
        panel: "#0a1220",
        border: "#1d2b40",
        ink: "#d6e6ff",
        dim: "#7d93b3",
        grid: "#1d2b40",
        row: "#0e1828",
        track: "#111b2c",
        accent: "#4fc3ff",
        accentBand: "rgba(79, 195, 255, 0.22)",
        accentBorder: "rgba(79, 195, 255, 0.5)",
        weather: ["#2b6e8f", "#1f5470"],
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
    },
    light: {
        name: "light",
        bg: "#e9eef3",
        panel: "#ffffff",
        border: "#cfd8e3",
        ink: "#0f1b2d",
        dim: "#5b6b80",
        grid: "#e1e7ee",
        row: "#f2f5f9",
        track: "#e3e9f0",
        accent: "#0b72c4",
        accentBand: "rgba(11, 114, 196, 0.14)",
        accentBorder: "rgba(11, 114, 196, 0.45)",
        weather: ["#7fb6d9", "#a9cfe8"],
        whisker: "#6b7a90",
        liveFill: "#ffffff",
        up: "#d9480f",
        down: "#138a4a",
        good: "#138a4a",
        warn: "#b7791f",
        orange: "#d9480f",
        bar: "#7a8799",
        barPartial: "#c3ccd8",
        alarm: { critical: "#d61f1f", warning: "#c46a00", info: "#0b72c4" },
    },
};

/**
 * A facility's colour in the theme the page is in, from the app's
 * `--asset-color-*` variable.
 */
export function assetColor(asset: string): string {
    return resolveCSSVar(`--asset-color-${asset}`);
}
