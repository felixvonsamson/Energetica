import { useMemo, useEffect, useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { getAssetColor } from "@/lib/asset-colors";

/**
 * Hook that returns a color getter function that's theme-aware.
 *
 * Uses theme-aware caching and deferred theme application to ensure chart
 * colors update correctly on theme toggle. The appliedTheme state is updated in
 * useEffect, which runs AFTER useLayoutEffect updates the DOM, ensuring we read
 * CSS variables after the theme class has been applied.
 *
 * @example
 *     const getColor = useAssetColorGetter();
 *     const chartConfig = useMemo(
 *         () => ({
 *             getColor,
 *             // ... other config
 *         }),
 *         [getColor],
 *     );
 *
 * @returns A function that takes an asset name and returns its theme-aware
 *   color
 */
export function useAssetColorGetter() {
    const { theme } = useTheme();
    // Use separate state to track when theme has been applied to DOM
    const [appliedTheme, setAppliedTheme] = useState(theme);
    // Track cache version to force re-render when cache is invalidated (e.g., during HMR)
    const [cacheVersion, setCacheVersion] = useState(0);

    // Update appliedTheme in useEffect, which runs AFTER all useLayoutEffects
    // This ensures the DOM has been updated with the new theme class before we read colors
    useEffect(() => {
        setAppliedTheme(theme);
    }, [theme]);

    // Listen for cache invalidation events (e.g., from HMR when CSS changes)
    useEffect(() => {
        const handleInvalidation = () => {
            setCacheVersion((v) => v + 1);
        };

        window.addEventListener("asset-colors-invalidated", handleInvalidation);
        return () => {
            window.removeEventListener(
                "asset-colors-invalidated",
                handleInvalidation,
            );
        };
    }, []);

    return useMemo(() => {
        // Return a new function wrapper that captures the applied theme
        // This ensures components depending on this getter will re-render when theme changes
        // or when cache is invalidated (cacheVersion dependency)
        return (assetName: string) => {
            const color = getAssetColor(assetName, appliedTheme);
            return color;
        };
    }, [appliedTheme, cacheVersion]);
}
