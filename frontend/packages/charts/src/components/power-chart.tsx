/**
 * Power chart: stacked bar chart of facility production per tick.
 *
 * This is a thin wrapper around TimeSeriesChart that handles the
 * power-chart-specific concerns:
 *
 * - Deriving visible keys from the given key order (hidden + zero filtering)
 * - Percent-mode normalization of the data
 *
 * It takes its data, series order, labels and time axis as props, so each app
 * supplies its own.
 */

import { formatPower } from "@energetica/core/format-utils";
import { useAssetColorGetter } from "@energetica/ui/hooks/use-asset-color-getter";
import { type ReactNode, useMemo } from "react";

import {
    type ChartSyncProps,
    type EChartsTimeSeriesConfig,
    TimeSeriesChart,
} from "#charts/components/time-series-chart";

export type PowerChartViewMode = "absolute" | "percent";

interface PowerChartProps extends ChartSyncProps {
    /**
     * Names what the chart shows, such as "power-sources". Changing it resets
     * the zoom.
     */
    kind?: string;
    chartData: Array<Record<string, unknown>>;
    isLoading: boolean;
    isError: boolean;
    hiddenFacilities: Set<string>;
    viewMode: PowerChartViewMode;
    /**
     * The series keys in stack order, bottom first. Only these series are
     * shown.
     */
    keyOrder: readonly string[];
    /** Each series' color. Defaults to the asset colors. */
    getColor?: (key: string) => string;
    /** Each series' tooltip label. */
    formatLabel: (key: string) => ReactNode;
    height?: number;
    /** The share of each tick's slot left between bars. */
    barGap?: number;
}

export function PowerChart({
    kind,
    chartData,
    isLoading,
    isError,
    hiddenFacilities,
    viewMode,
    keyOrder,
    getColor: getColorProp,
    formatLabel,
    height,
    barGap,
    ...chart
}: PowerChartProps) {
    const getAssetColor = useAssetColorGetter();
    const getColor = getColorProp ?? getAssetColor;

    // Derive visible keys in canonical stack order, excluding hidden facilities
    // and series that are all-zero across the entire data set.
    const visibleKeys = useMemo(() => {
        if (!chartData.length) return [];
        return keyOrder.filter(
            (key) =>
                !hiddenFacilities.has(key) &&
                chartData.some((d) => Number(d[key] ?? 0) > 0),
        );
    }, [chartData, keyOrder, hiddenFacilities]);

    // Build display data containing only visible keys, optionally normalized
    // to percentages. Pre-filtering here means TimeSeriesChart sees exactly
    // the series it should render — no filterDataKeys needed.
    const displayData = useMemo(() => {
        return chartData.map((dataPoint) => {
            const total =
                viewMode === "percent"
                    ? visibleKeys.reduce(
                          (s, k) => s + Number(dataPoint[k] ?? 0),
                          0,
                      )
                    : 0;
            const row: Record<string, unknown> = { tick: dataPoint.tick };
            for (const k of visibleKeys) {
                const v = Number(dataPoint[k] ?? 0);
                row[k] =
                    viewMode === "percent" && total > 0 ? (v / total) * 100 : v;
            }
            return row;
        });
    }, [chartData, visibleKeys, viewMode]);

    const config = useMemo(
        (): EChartsTimeSeriesConfig => ({
            kind,
            chartVariant: "area",
            stacked: true,
            getColor,
            formatLabel,
            formatValue: (v) =>
                viewMode === "percent" ? `${v.toFixed(1)}%` : formatPower(v),
            formatYAxis:
                viewMode === "percent"
                    ? (v: number) => `${v.toFixed(0)}%`
                    : (v: number) => formatPower(v),
            yAxisMin: 0,
            yAxisMax: viewMode === "percent" ? 100 : undefined,
            hideZeroValues: true,
            height,
            barGap,
        }),
        [kind, getColor, formatLabel, viewMode, height, barGap],
    );

    return (
        <TimeSeriesChart
            data={displayData}
            config={config}
            isLoading={isLoading}
            isError={isError}
            {...chart}
        />
    );
}
