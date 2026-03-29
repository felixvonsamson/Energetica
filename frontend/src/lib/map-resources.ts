/** Shared utilities and constants for map resource visualization and heatmaps. */

import { Theme } from "@/contexts/theme-context";
import { formatMass } from "@/lib/format-utils";

export type ResourceId = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// oklch color: [L (0–1), C (0–0.4), H (0–360)]
// Exported so resource buttons can reference the same colors.
export type OklchColor = [number, number, number];

// Resource types available for filtering.
// `color` is the light-theme oklch value; dark theme uses a darkened variant.
export const RESOURCES: {
    id: ResourceId;
    name: string;
    color: OklchColor;
}[] = [
    { id: 0, name: "Solar", color: [0.9592, 0.2074, 108.5] },
    { id: 1, name: "Wind", color: [0.8453, 0.1457, 208.99] },
    { id: 2, name: "Hydro", color: [0.4534, 0.312276, 264.0746] },
    { id: 3, name: "Coal", color: [0.628, 0.2577, 29.23] },
    { id: 4, name: "Gas", color: [0.5545, 0.295, 300.59] },
    { id: 5, name: "Uranium", color: [0.8697, 0.2903, 141.66] },
    { id: 6, name: "Climate risk", color: [0.6597, 0.2755, 349.7] },
];

// Max values for each resource (for normalization in colouring)
export const MAX_VALUES = [
    1, 1, 1, 2_000_000_000, 600_000_000, 8_000_000, 10,
] as const;

// At zero concentration: chroma fades to near-zero, lightness shifts away from the resource color
const C_MIN = 0.03; // almost no chroma at zero concentration
const L_ZERO_LIGHT = 0.96; // very light at zero concentration (light theme)
const L_ZERO_DARK = 0.3; // very dark at zero concentration (dark theme)

export function oklchToString([l, c, h]: OklchColor): string {
    return `oklch(${(l * 100).toFixed(3)}% ${c.toFixed(5)} ${h.toFixed(3)})`;
}

// Interface for tiles with resource data
export interface TileWithResources {
    solar: number;
    wind: number;
    hydro: number;
    coal: number;
    gas: number;
    uranium: number;
    climate_risk: number;
    player_id?: number | null;
}

export function getResourceValue(
    tile: TileWithResources,
    resourceId: number,
): number {
    switch (resourceId) {
        case 0:
            return tile.solar;
        case 1:
            return tile.wind;
        case 2:
            return tile.hydro;
        case 3:
            return tile.coal;
        case 4:
            return tile.gas;
        case 5:
            return tile.uranium;
        case 6:
            return tile.climate_risk;
        default:
            return 0;
    }
}

export function formatResourceValue(
    tile: TileWithResources,
    resourceId: ResourceId,
): string {
    const value = getResourceValue(tile, resourceId);
    if ([0, 1, 2].includes(resourceId)) {
        return `${Math.round(value * 100)}%`;
    } else if ([3, 4, 5].includes(resourceId)) {
        return formatMass(value);
    } else {
        return value.toString();
    }
}

/**
 * Calculate tile fill color based on resource heatmap or default player
 * territory colors.
 *
 * @param tile - The tile with resource data
 * @param activeResourceId - The currently selected resource filter (undefined =
 *   no filter)
 * @param theme - Current theme (light/dark)
 * @param defaultFill - Default fill color when no resource is selected (e.g.,
 *   player territory color)
 */
export interface TileFill {
    fill: string;
    /** Contrast-safe label color for text rendered on top of fill. */
    labelColor: string;
}

export function calculateTileFillWithResource(
    tile: TileWithResources,
    activeResourceId: ResourceId | undefined,
    theme: Theme,
    defaultFill: string,
    defaultLabelColor: string,
): TileFill {
    // When a resource is selected, show heatmap
    if (activeResourceId !== undefined) {
        const resourceValue = getResourceValue(tile, activeResourceId);
        const maxValue = MAX_VALUES[activeResourceId];
        const interpolationFactor = resourceValue / maxValue;

        const [l, c, h] = RESOURCES[activeResourceId]!.color;
        const baseL = theme === "dark" ? L_ZERO_DARK : L_ZERO_LIGHT;

        const interpolatedL = baseL + (l - baseL) * interpolationFactor;
        const interpolatedC = C_MIN + (c - C_MIN) * interpolationFactor;

        // oklch L is perceptually uniform: above ~0.55 use dark text, else white
        const labelColor = interpolatedL > 0.55 ? "oklch(0.2 0 0)" : "white";

        return {
            fill: oklchToString([interpolatedL, interpolatedC, h]),
            labelColor,
        };
    }

    return { fill: defaultFill, labelColor: defaultLabelColor };
}

const MAX_LABEL_SIZE = 14; // 20 * 0.7 — 30% reduction applied here

/**
 * Calculate the label text and font size for a map tile. Font size scales with
 * hex size `s` and label length.
 */
export function calculateTileLabel(
    tile: TileWithResources,
    activeResourceId: ResourceId | undefined,
    s: number,
    playerMap: Record<number, string>,
): { label: string | null; size: number } {
    if (tile.player_id) {
        const username = playerMap[tile.player_id];
        return {
            label: username ? username.slice(0, 3) : null,
            size: MAX_LABEL_SIZE,
        };
    }
    if (activeResourceId !== undefined) {
        const formattedLabel = formatResourceValue(tile, activeResourceId);
        return {
            label: formattedLabel,
            size: Math.min(MAX_LABEL_SIZE, (3 * s) / formattedLabel.length),
        };
    }
    return { label: null, size: MAX_LABEL_SIZE };
}
