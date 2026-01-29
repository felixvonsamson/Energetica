import { useMemo } from "react";

import {
    TimeSeriesChart,
    TimeSeriesChartConfig,
} from "@/components/charts/time-series-chart";
import { useAssetColorGetter } from "@/hooks/useAssetColorGetter";
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

    const chartConfig: TimeSeriesChartConfig = useMemo(
        () => ({
            chartType: "resources",
            chartVariant: "area",
            stacked: false,
            showBrush: true,
            getColor,
            filterDataKeys: [filterNonZeroSeries],
            formatValue: formatMass,
            formatYAxis: (value: number) => formatMass(value),
        }),
        [getColor],
    );

    return (
        <TimeSeriesChart
            data={chartData as Array<Record<string, unknown>>}
            config={chartConfig}
            isLoading={isLoading}
            isError={isError}
        />
    );
}
