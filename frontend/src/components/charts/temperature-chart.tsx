import { useMemo } from "react";

import {
    TimeSeriesChart,
    TimeSeriesChartConfig,
} from "@/components/charts/time-series-chart";

// Temperature Chart Component
interface TemperatureChartProps {
    chartData: Array<Record<string, unknown>>;
    isLoading: boolean;
    isError: boolean;
    viewMode: "absolute" | "relative";
}

export function TemperatureChart({
    chartData,
    isLoading,
    isError,
    viewMode,
}: TemperatureChartProps) {
    // Transform data based on view mode
    const transformedData = useMemo(() => {
        if (chartData.length === 0) return [];

        return chartData.map((dataPoint) => {
            const dp = dataPoint as Record<string, unknown>;
            const deviation =
                typeof dp.deviation === "number" ? dp.deviation : 0;
            const reference =
                typeof dp.reference === "number" ? dp.reference : 0;

            if (viewMode === "relative") {
                return {
                    tick: typeof dp.tick === "number" ? dp.tick : 0,
                    temperature: deviation,
                    reference: 0,
                };
            } else {
                return {
                    tick: typeof dp.tick === "number" ? dp.tick : 0,
                    temperature: deviation + reference,
                    reference: reference,
                };
            }
        });
    }, [chartData, viewMode]);

    const formatValue = (value: number): string => {
        return `${value.toFixed(2)}°C`;
    };

    const chartConfig: TimeSeriesChartConfig = useMemo(
        () => ({
            chartVariant: "smoothLine",
            stacked: false,
            height: 400,
            showBrush: true,
            getColor: (key: string) =>
                key === "temperature" ? "#f59e0b" : "#9ca3af",
            filterDataKeys: [],
            formatValue,
        }),
        [],
    );

    return (
        <TimeSeriesChart
            data={transformedData}
            config={chartConfig}
            isLoading={isLoading}
            isError={isError}
        />
    );
}
