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

/** Create a cache key that includes both CSS variable and theme */
function getCacheKey(cssVar: string, theme: string): string {
    return `${cssVar}__${theme}`;
}

/**
 * Get the color for an asset, extracting from CSS variables
 *
 * Colors are cached after first extraction to avoid repeated getComputedStyle
 * calls. Cache is theme-aware, storing separate entries for light and dark
 * modes.
 *
 * @param assetName - The asset name (e.g., "pv_solar", "windmill",
 *   "nuclear_reactor")
 * @param theme - The current theme ("light" or "dark")
 * @returns RGB color string (e.g., "rgb(255, 234, 0)") or fallback if not found
 */
export function getAssetColor(assetName: string, theme: string): string {
    const cssVar = normalizeToCssVariable(assetName);
    const cacheKey = getCacheKey(cssVar, theme);

    // Return cached color if available
    if (colorCache.has(cacheKey)) {
        const cached = colorCache.get(cacheKey)!;
        return cached;
    }

    // Extract color from CSS variable
    const color = getComputedStyle(document.documentElement)
        .getPropertyValue(cssVar)
        .trim();

    // Use fallback if CSS variable not found
    const finalColor = color || "rgb(128, 128, 128)"; // Gray fallback

    // Cache with theme-specific key
    colorCache.set(cacheKey, finalColor);

    return finalColor;
}

/**
 * Clear the color cache (useful for testing and HMR) Note: With theme-aware
 * caching, this is no longer needed for theme switching
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
