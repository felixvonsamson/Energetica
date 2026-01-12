/** Shared utilities and constants for map resource visualization and heatmaps. */

import { Theme } from "@/contexts/ThemeContext";
import { formatMass } from "@/lib/format-utils";

export type ResourceId = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// Resource types available for filtering
export const RESOURCES = [
    { id: 0, name: "Solar", color: 59 },
    { id: 1, name: "Wind", color: 186 },
    { id: 2, name: "Hydro", color: 239 },
    { id: 3, name: "Coal", color: 0 },
    { id: 4, name: "Gas", color: 275 },
    { id: 5, name: "Uranium", color: 109 },
    { id: 6, name: "Climate risk", color: 320 },
] as const;

// Max values for each resource (for normalization in colouring)
export const MAX_VALUES = [1, 1, 1, 2_000_000_000, 600_000_000, 8_000_000, 10];

// Color interpolation helpers
export function hexToRgb(hex: string): [number, number, number] {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? [
              parseInt(result[1], 16),
              parseInt(result[2], 16),
              parseInt(result[3], 16),
          ]
        : [0, 0, 0];
}

export function hslToRgb(
    h: number,
    s: number,
    l: number,
): [number, number, number] {
    s /= 100;
    l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0,
        g = 0,
        b = 0;

    if (h < 60) {
        r = c;
        g = x;
        b = 0;
    } else if (h < 120) {
        r = x;
        g = c;
        b = 0;
    } else if (h < 180) {
        r = 0;
        g = c;
        b = x;
    } else if (h < 240) {
        r = 0;
        g = x;
        b = c;
    } else if (h < 300) {
        r = x;
        g = 0;
        b = c;
    } else {
        r = c;
        g = 0;
        b = x;
    }

    return [
        Math.round((r + m) * 255),
        Math.round((g + m) * 255),
        Math.round((b + m) * 255),
    ];
}

export function interpolateRgb(
    from: [number, number, number],
    to: [number, number, number],
    factor: number,
): [number, number, number] {
    return [
        Math.round(from[0] + (to[0] - from[0]) * factor),
        Math.round(from[1] + (to[1] - from[1]) * factor),
        Math.round(from[2] + (to[2] - from[2]) * factor),
    ];
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
export function calculateTileFillWithResource(
    tile: TileWithResources,
    activeResourceId: ResourceId | undefined,
    theme: Theme,
    defaultFill: string,
): string {
    // When a resource is selected, show heatmap
    if (activeResourceId !== undefined) {
        const resourceValue = getResourceValue(tile, activeResourceId);
        const maxValue = MAX_VALUES[activeResourceId];
        const interpolationFactor = resourceValue / maxValue;
        const hue = RESOURCES[activeResourceId].color;

        // Get the vacant tile color based on theme
        const vacantColor =
            theme === "dark"
                ? ([121, 121, 121] as [number, number, number])
                : hexToRgb("#e5d9b6");

        // Get the resource color (full saturation and appropriate lightness)
        const resourceLightness = theme === "dark" ? 50 : 35;
        const resourceColor = hslToRgb(hue, 100, resourceLightness);

        // Interpolate between vacant and resource color
        const [r, g, b] = interpolateRgb(
            vacantColor,
            resourceColor,
            interpolationFactor,
        );
        return `rgb(${r}, ${g}, ${b})`;
    }

    // Default behavior: use provided fill
    return defaultFill;
}
