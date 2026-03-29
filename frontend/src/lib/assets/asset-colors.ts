/**
 * Asset color system - Maps asset names to colors defined in global.css
 *
 * All asset colors are defined as CSS variables in
 * frontend/src/styles/global.css with automatic support for light and dark
 * modes.
 *
 * This module extracts color values at runtime with caching for performance.
 */

const colorCache = new Map<string, string>();

export function assetCSSColourVariable(assetName: string): string {
    return `var(${normalizeToCssVariable(assetName)})`;
}

/**
 * Convert asset name to CSS variable format Examples: "pv_solar" →
 * "--asset-color-pv-solar" "PV_solar" → "--asset-color-pv-solar" "PvSolar" →
 * "--asset-color-pv-solar"
 */
function normalizeToCssVariable(assetName: string): string {
    return `--asset-color-${assetName
        .toLowerCase()
        .replace(/([a-z])([A-Z])/g, "$1-$2") // camelCase → kebab-case
        .replace(/_/g, "-") // underscores → hyphens
        .toLowerCase()}`;
}

/**
 * Get the color for an asset, extracting from CSS variables
 *
 * Colors are cached after first extraction to avoid repeated getComputedStyle
 * calls. Cache is cleared on theme changes and HMR to ensure fresh values.
 *
 * @param assetName - The asset name (e.g., "pv_solar", "windmill",
 *   "nuclear_reactor")
 * @returns RGB color string (e.g., "rgb(255, 234, 0)") or fallback if not found
 */
export function getAssetColor(assetName: string): string {
    const cssVar = normalizeToCssVariable(assetName);

    // Return cached color if available
    if (colorCache.has(cssVar)) {
        return colorCache.get(cssVar)!;
    }

    // Extract color from CSS variable (reads from current DOM state)
    const color = getComputedStyle(document.documentElement)
        .getPropertyValue(cssVar)
        .trim();

    // Use fallback if CSS variable not found
    const finalColor = color || "rgb(128, 128, 128)"; // Gray fallback

    // Cache the color
    colorCache.set(cssVar, finalColor);

    return finalColor;
}

/**
 * Clear the color cache (used for theme switching and HMR)
 *
 * Dispatches a custom event to notify components that they should re-fetch
 * colors
 */
export function clearAssetColorCache(): void {
    colorCache.clear();

    // Notify components that colors need to be re-fetched
    if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("asset-colors-invalidated"));
    }
}
