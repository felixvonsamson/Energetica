import { useMemo } from "react";

import {
    EChartsTimeSeries,
    EChartsTimeSeriesConfig,
} from "@/components/charts/echarts-time-series";
import { useAssetColorGetter } from "@/hooks/use-asset-color-getter";
import { filterNonZeroSeries } from "@/lib/charts/filter-utils";
import { formatMass } from "@/lib/format-utils";

interface ResourcesChartProps {
    chartData: Array<Record<string, unknown>>;
    isLoading: boolean;
    isError: boolean;
}

export function ResourcesChart({
    chartData,
    isLoading,
    isError,
}: ResourcesChartProps) {
    const getColor = useAssetColorGetter();

    const chartConfig: EChartsTimeSeriesConfig = useMemo(
        () => ({
            chartType: "resources",
            chartVariant: "area",
            stacked: false,
            getColor,
            filterDataKeys: [filterNonZeroSeries],
            formatValue: formatMass,
            formatYAxis: (value: number) => formatMass(value),
        }),
        [getColor],
    );

    return (
        <EChartsTimeSeries
            data={chartData as Array<Record<string, unknown>>}
            config={chartConfig}
            isLoading={isLoading}
            isError={isError}
        />
    );
}
