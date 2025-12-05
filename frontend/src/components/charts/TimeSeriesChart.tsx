/** Generic time series chart component supporting multiple chart types. */

import { useMemo } from "react";
import {
    XAxis,
    YAxis,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    AreaChart,
    LineChart,
    BarChart,
    Area,
    Line,
    Bar,
    Brush,
} from "recharts";
import { TimeSeriesChartConfig } from "./types";
import { ChartLoadingState } from "./ChartLoadingState";

interface TimeSeriesChartProps {
    /** Chart data with tick and series values */
    data: Array<Record<string, unknown>>;
    /** Chart configuration */
    config: TimeSeriesChartConfig;
    /** Loading state */
    isLoading?: boolean;
    /** Error state */
    isError?: boolean;
    /** Error message to display */
    errorMessage?: string;
}

/**
 * Generic time series chart component that can render area, line, or bar
 * charts. Handles data filtering, colouring, and common chart configuration.
 */
export function TimeSeriesChart({
    data,
    config,
    isLoading = false,
    isError = false,
    errorMessage = "Failed to load data",
}: TimeSeriesChartProps) {
    const {
        chartVariant = "area",
        stacked = false,
        height = 400,
        showBrush = true,
        getColor,
        filterDataKeys,
        formatYAxis,
        formatTooltip,
    } = config;

    // Extract and filter data keys
    const seriesComponents = useMemo(() => {
        if (!data || data.length === 0) return [];

        // Extract all keys except 'tick'
        const dataKeys = Object.keys(data[0]).filter((key) => key !== "tick");

        // Apply filtering if provided
        const filteredKeys = filterDataKeys
            ? dataKeys.filter((key) => filterDataKeys(key, data))
            : dataKeys;

        // Create components based on chart variant
        return filteredKeys.map((key) => {
            const color = getColor ? getColor(key) : undefined;
            const commonProps = {
                dataKey: key,
                isAnimationActive: false,
            };

            switch (chartVariant) {
                case "area":
                    return (
                        <Area
                            key={key}
                            {...commonProps}
                            stackId={stacked ? "stack" : undefined}
                            fill={color}
                            fillOpacity={1}
                        />
                    );
                case "line":
                    return (
                        <Line
                            key={key}
                            {...commonProps}
                            stroke={color}
                            strokeWidth={2}
                            dot={false}
                        />
                    );
                case "bar":
                    return (
                        <Bar
                            key={key}
                            {...commonProps}
                            stackId={stacked ? "stack" : undefined}
                            fill={color}
                        />
                    );
                default:
                    return null;
            }
        });
    }, [data, chartVariant, stacked, getColor, filterDataKeys]);

    if (isLoading) {
        return <ChartLoadingState />;
    }

    if (isError) {
        return (
            <div className="text-center py-12 text-alert-red">
                {errorMessage}
            </div>
        );
    }

    // Select the appropriate chart component
    const ChartComponent =
        chartVariant === "area"
            ? AreaChart
            : chartVariant === "line"
              ? LineChart
              : BarChart;

    return (
        <ResponsiveContainer width="100%" height={height}>
            <ChartComponent data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tick" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={formatYAxis} />
                {showBrush && (
                    <Brush dataKey="tick" height={30} stroke="#8884d8" />
                )}
                {seriesComponents}
                <Tooltip formatter={formatTooltip} />
            </ChartComponent>
        </ResponsiveContainer>
    );
}
