import type { EChartsTimeSeriesConfig } from "@energetica/charts/components/time-series-chart";
import { formatMoney } from "@energetica/core/format-utils";
import { CoinIcon } from "@energetica/ui/components/coin-icon";
import { ReactNode, useMemo } from "react";

import {
    chartTypeConfig,
    EChartsTimeSeries,
} from "@/components/charts/echarts-time-series";
import { useChartData } from "@/hooks/use-charts";
import { useElectricityMarket } from "@/hooks/use-electricity-markets";
import { ResolutionOption } from "@/types/charts";

function formatMarketPriceValue(value: number): ReactNode {
    return (
        <span className="inline-flex items-center gap-1">
            {formatMoney(value)}
            <CoinIcon className="w-3 h-3" />
            /MWh
        </span>
    );
}

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

    const chartConfig: EChartsTimeSeriesConfig = useMemo(
        () => ({
            ...chartTypeConfig("market-clearing"),
            chartVariant: "steppedLine",
            stacked: false,
            getColor: () => "var(--chart-2)",
            filterDataKeys: [],
            formatValue: formatMarketPriceValue,
            formatYAxis: (value: number) => formatMoney(value),
            yAxisLabel: "Price (coins/MWh)",
            hideZeroValues: false,
        }),
        [],
    );

    return (
        <EChartsTimeSeries
            data={priceData}
            config={chartConfig}
            isLoading={isLoading}
            isError={isError}
        />
    );
}
