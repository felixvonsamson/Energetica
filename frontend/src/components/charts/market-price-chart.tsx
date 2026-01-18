import { useMemo } from "react";

import {
    TimeSeriesChart,
    TimeSeriesChartConfig,
} from "@/components/charts/time-series-chart";
import { useCurrentChartData } from "@/hooks/useCharts";
import { useGameTick } from "@/hooks/useGameTick";
import { ResolutionOption } from "@/types/charts";

interface MarketPriceChartProps {
    selectedResolution: ResolutionOption;
    marketId: number;
}

export function MarketPriceChart({
    selectedResolution,
    marketId,
}: MarketPriceChartProps) {
    const { currentTick } = useGameTick();

    // Fetch chart data for network-data
    const { chartData, isLoading, isError } = useCurrentChartData({
        chartType: "network-data",
        currentTick,
        resolution: selectedResolution.resolution,
        maxDatapoints: selectedResolution.datapoints,
        marketId,
    });

    // Extract only price data
    const priceData = useMemo(() => {
        return chartData.map((dataPoint) => ({
            tick: dataPoint.tick as number,
            price: dataPoint.price as number,
        }));
    }, [chartData]);

    const chartConfig: TimeSeriesChartConfig = useMemo(
        () => ({
            chartType: "network-data",
            chartVariant: "line",
            stacked: false,
            showBrush: true,
            getColor: () => "var(--chart-2)",
            filterDataKeys: [],
            formatValue: (value: number) => `$${value.toFixed(6)}`,
            formatYAxis: (value: number) => `$${value.toFixed(6)}`,
        }),
        [],
    );

    return (
        <TimeSeriesChart
            data={priceData}
            config={chartConfig}
            isLoading={isLoading}
            isError={isError}
        />
    );
}
