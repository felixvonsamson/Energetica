/** Hook for creating standard chart data filters */

import { useMemo } from "react";

import {
    filterNonZeroSeries,
    createExcludeKeysFilter,
} from "@/components/charts";

/**
 * Creates a standard set of chart filters combining non-zero filtering with
 * visibility filtering based on hidden items.
 *
 * @example
 *     ```tsx
 *     const [hiddenSeries, toggleSeries] = useToggleSet<string>();
 *     const filters = useChartFilters(hiddenSeries);
 *
 *     const chartConfig = {
 *       filterDataKeys: filters,
 *       // ... other config
 *     };
 *     ```;
 *
 * @param hiddenItems - Set of keys to exclude from the chart
 * @param includeNonZeroFilter - Whether to include the non-zero filter
 *   (default: true)
 * @returns Array of filter functions to pass to TimeSeriesChart config
 */
export function useChartFilters(
    hiddenItems: Set<string>,
    includeNonZeroFilter = true,
) {
    return useMemo(() => {
        const filters = [createExcludeKeysFilter(Array.from(hiddenItems))];
        if (includeNonZeroFilter) {
            filters.unshift(filterNonZeroSeries);
        }
        return filters;
    }, [hiddenItems, includeNonZeroFilter]);
}
