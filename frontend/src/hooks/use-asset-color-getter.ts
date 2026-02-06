import { useMemo, useEffect, useState } from "react";

import { useTheme } from "@/contexts/theme-context";
import { clearAssetColorCache, getAssetColor } from "@/lib/assets/asset-colors";

/**
 * Hook that returns a color getter function that's theme-aware.
 *
 * Clears the color cache and uses deferred theme application to ensure chart
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
    const { resolvedTheme } = useTheme();
    // Use separate state to track when theme has been applied to DOM
    const [appliedTheme, setAppliedTheme] = useState(resolvedTheme);
    // Track cache version to force re-render when cache is invalidated (e.g., during HMR)
    const [cacheVersion, setCacheVersion] = useState(0);

    // Clear cache and update appliedTheme when theme changes
    // useEffect runs AFTER all useLayoutEffects, ensuring the DOM has been
    // updated with the new theme class before we read colors
    useEffect(() => {
        clearAssetColorCache();
        setAppliedTheme(resolvedTheme);
    }, [resolvedTheme]);

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
        // Return a new function wrapper
        // This ensures components depending on this getter will re-render when theme changes
        // or when cache is invalidated (cacheVersion dependency)
        return (assetName: string) => getAssetColor(assetName);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [appliedTheme, cacheVersion]);
}
