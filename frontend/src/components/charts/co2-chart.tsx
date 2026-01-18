import { useCallback, useMemo } from "react";

import {
    TimeSeriesChart,
    TimeSeriesChartConfig,
} from "@/components/charts/time-series-chart";

// CO2 Chart Component
interface CO2ChartProps {
    chartData: Array<Record<string, unknown>>;
    isLoading: boolean;
    isError: boolean;
    viewMode: "absolute" | "relative";
    unitMode: "concentration" | "quantity";
}

export function CO2Chart({
    chartData,
    isLoading,
    isError,
    viewMode,
    unitMode,
}: CO2ChartProps) {
    // Transform data based on view mode and unit mode
    const transformedData = useMemo(() => {
        if (!chartData || chartData.length === 0) return [];

        const REFERENCE_CO2 = 4e10; // kg - reference CO2 level
        const KG_TO_PPM = 3 / 4e5; // Conversion factor

        return chartData.map((dataPoint) => {
            const dp = dataPoint as Record<string, unknown>;
            const co2Value = typeof dp.CO2 === "number" ? dp.CO2 : 0;

            let value = co2Value;

            // Apply relative mode (subtract reference)
            if (viewMode === "relative") {
                value = value - REFERENCE_CO2;
            }

            // Apply concentration mode (convert to ppm)
            if (unitMode === "concentration") {
                value = value * KG_TO_PPM;
            }

            return {
                tick: typeof dp.tick === "number" ? dp.tick : 0,
                CO2: value,
                reference:
                    viewMode === "relative"
                        ? 0
                        : unitMode === "concentration"
                          ? REFERENCE_CO2 * KG_TO_PPM
                          : REFERENCE_CO2,
            };
        });
    }, [chartData, viewMode, unitMode]);

    // TODO: ensure these are from format utilities
    const formatValue = useCallback(
        (value: number): string => {
            if (unitMode === "concentration") {
                // Format as ppm
                const abs = Math.abs(value);
                if (abs >= 1000) {
                    return `${(value / 1000).toFixed(2)}‰`;
                } else if (abs >= 1) {
                    return `${value.toFixed(2)} ppm`;
                } else {
                    return `${(value * 1000).toFixed(2)} ppb`;
                }
            } else {
                // Format as mass
                const abs = Math.abs(value);
                if (abs >= 1e12) {
                    return `${(value / 1e12).toFixed(2)} Tt`;
                } else if (abs >= 1e9) {
                    return `${(value / 1e9).toFixed(2)} Gt`;
                } else if (abs >= 1e6) {
                    return `${(value / 1e6).toFixed(2)} Mt`;
                } else {
                    return `${(value / 1e3).toFixed(2)} t`;
                }
            }
        },
        [unitMode],
    );

    const chartConfig: TimeSeriesChartConfig = useMemo(
        () => ({
            chartVariant: "line",
            stacked: false,
            showBrush: true,
            getColor: (key: string) => (key === "CO2" ? "#ef4444" : "#9ca3af"),
            filterDataKeys: [],
            formatValue,
        }),
        [formatValue],
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
