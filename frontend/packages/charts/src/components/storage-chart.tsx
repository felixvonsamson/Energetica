/**
 * Storage chart: each storage type's state of charge, or the energy it holds,
 * over time.
 *
 * It takes its data, labels and time axis as props, so each app supplies its
 * own.
 */

import { formatEnergy } from "@energetica/core/format-utils";
import { useAssetColorGetter } from "@energetica/ui/hooks/use-asset-color-getter";
import { type ReactNode, useMemo } from "react";

import {
    type ChartSyncProps,
    type EChartsTimeSeriesConfig,
    TimeSeriesChart,
} from "#charts/components/time-series-chart";
import { useChartFilters } from "#charts/hooks/use-chart-filters";
import { STORAGE_KEYS } from "#charts/lib/key-order";

/**
 * What the storage chart shows: each storage type's state of charge (SOC), the
 * energy it holds as a share of its capacity, or the energy itself.
 */
export type StorageView = "soc" | "energy";

export const STORAGE_VIEW_OPTIONS = [
    { value: "soc", label: "SOC" },
    { value: "energy", label: "Energy" },
] as const satisfies readonly { value: StorageView; label: string }[];

interface StorageChartProps extends ChartSyncProps {
    /** The stored energy in Wh, or for `soc`, the SOC from 0 to 1. */
    chartData: Array<Record<string, unknown>>;
    isLoading: boolean;
    isError: boolean;
    hiddenFacilities: Set<string>;
    /**
     * Keep a storage type that held nothing throughout, rather than leaving it
     * out, so an empty store still shows at 0%.
     */
    showEmpty?: boolean;
    view: StorageView;
    /** Each series' tooltip label. */
    formatLabel: (key: string) => ReactNode;
    height?: number;
}

export function StorageChart({
    chartData,
    isLoading,
    isError,
    hiddenFacilities,
    showEmpty = false,
    view,
    formatLabel,
    height,
    ...chart
}: StorageChartProps) {
    const getColor = useAssetColorGetter();
    const filterDataKeys = useChartFilters(hiddenFacilities, !showEmpty);

    // The SOC comes from 0 to 1. Scale it to 0-100 for display.
    const displayData: Array<Record<string, unknown>> = useMemo(() => {
        if (view === "energy" || chartData.length === 0) {
            return chartData;
        }
        return chartData.map((dataPoint) => {
            const result: Record<string, unknown> = { tick: dataPoint.tick };
            Object.keys(dataPoint).forEach((key) => {
                if (key === "tick") return;
                const val = dataPoint[key];
                result[key] = typeof val === "number" ? val * 100 : 0;
            });
            return result;
        });
    }, [chartData, view]);

    const chartConfig: EChartsTimeSeriesConfig = useMemo(
        () => ({
            kind: view,
            keyOrder: STORAGE_KEYS,
            chartVariant: view === "energy" ? "area" : "smoothLine",
            stacked: view === "energy",
            getColor,
            filterDataKeys,
            formatValue:
                view === "energy"
                    ? formatEnergy
                    : (value: number) => `${value.toFixed(1)}%`,
            formatYAxis: (value: number) =>
                view === "energy" ? formatEnergy(value) : `${value}%`,
            formatLabel,
            height,
        }),
        [view, getColor, filterDataKeys, formatLabel, height],
    );

    return (
        <TimeSeriesChart
            data={displayData}
            config={chartConfig}
            isLoading={isLoading}
            isError={isError}
            {...chart}
        />
    );
}
