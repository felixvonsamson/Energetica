import { useCallback, useMemo } from "react";

import {
    EChartsTimeSeries,
    EChartsTimeSeriesConfig,
} from "@/components/charts/echarts-time-series";
import { formatConcentration, formatEmissions } from "@/lib/format-utils";

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
        if (chartData.length === 0) return [];

        const REFERENCE_CO2 = 4e10; // kg - reference CO2 level
        const KG_TO_PPB = 3 / 4e5; // Conversion factor: kg → ppb

        return chartData.map((dataPoint) => {
            const dp = dataPoint as Record<string, unknown>;
            const co2Value = typeof dp.CO2 === "number" ? dp.CO2 : 0;

            let value = co2Value;

            // Apply relative mode (subtract reference)
            if (viewMode === "relative") {
                value = value - REFERENCE_CO2;
            }

            // Apply concentration mode (convert to ppb)
            if (unitMode === "concentration") {
                value = value * KG_TO_PPB;
            }

            return {
                tick: typeof dp.tick === "number" ? dp.tick : 0,
                CO2: value,
                reference:
                    viewMode === "relative"
                        ? 0
                        : unitMode === "concentration"
                          ? REFERENCE_CO2 * KG_TO_PPB
                          : REFERENCE_CO2,
            };
        });
    }, [chartData, viewMode, unitMode]);

    const formatCO2Value = useCallback(
        (value: number): string => {
            if (unitMode === "concentration") {
                return formatConcentration(value);
            }
            return formatEmissions(value);
        },
        [unitMode],
    );

    const chartConfig: EChartsTimeSeriesConfig = useMemo(
        () => ({
            chartVariant: "smoothLine",
            stacked: false,
            getColor: (key: string) => (key === "CO2" ? "#ef4444" : "#9ca3af"),
            filterDataKeys: [],
            formatValue: formatCO2Value,
            formatYAxis: formatCO2Value,
        }),
        [formatCO2Value],
    );

    return (
        <EChartsTimeSeries
            data={transformedData}
            config={chartConfig}
            isLoading={isLoading}
            isError={isError}
        />
    );
}
