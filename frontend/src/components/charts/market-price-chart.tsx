import { useMemo } from "react";
import { ReferenceLine } from "recharts";

import {
    TimeSeriesChart,
    TimeSeriesChartConfig,
} from "@/components/charts/time-series-chart";
import { useChartData } from "@/hooks/use-charts";
import { useElectricityMarket } from "@/hooks/use-electricity-markets";
import { ResolutionOption } from "@/types/charts";

interface MarketPriceChartProps {
    selectedResolution: ResolutionOption;
    marketId: number;
    minTick?: number;
}

export function MarketPriceChart({
    selectedResolution,
    marketId,
}: MarketPriceChartProps) {
    const market = useElectricityMarket(marketId);

    // Fetch chart data for network-data
    const { chartData, isLoading, isError } = useChartData({
        config: {
            chartType: "market-clearing",
            resolution: selectedResolution.resolution,
            marketId,
        },
        maxDatapoints: selectedResolution.datapoints,
    });

    // Extract only price data
    const priceData = useMemo(() => {
        if (!market) return [];
        return chartData.map((dataPoint) =>
            dataPoint.tick <= market.created_tick
                ? { tick: dataPoint.tick, price: null }
                : {
                      tick: dataPoint.tick,
                      price: dataPoint.price,
                  },
        );
    }, [chartData, market]);

    const chartConfig: TimeSeriesChartConfig = useMemo(
        () => ({
            chartType: "market-clearing",
            chartVariant: "steppedLine",
            stacked: false,
            showBrush: true,
            getColor: () => "var(--chart-2)",
            filterDataKeys: [],
            formatValue: (value: number) => `$${value.toFixed(6)}`,
            formatYAxis: (value: number) => `$${value.toFixed(6)}`,
            hideZeroValues: false,
        }),
        [],
    );

    return (
        <TimeSeriesChart
            data={priceData}
            config={chartConfig}
            isLoading={isLoading}
            isError={isError}
        >
            {market && (
                <ReferenceLine
                    x={market.created_tick}
                    stroke="var(--primary)"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    label={{
                        value: "Market Creation",
                        position: "insideTopLeft",
                        fill: "var(--muted-foreground)",
                        fontSize: 12,
                    }}
                />
            )}
        </TimeSeriesChart>
    );
}
