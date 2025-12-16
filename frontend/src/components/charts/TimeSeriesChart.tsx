/** Generic time series chart component supporting multiple chart types. */

import { useCallback, useMemo, type ReactNode } from "react";
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

import { ChartLoadingState } from "./ChartLoadingState";

import { AssetName, Duration } from "@/components/ui";
import { useTimeMode } from "@/contexts/TimeModeContext";
import { useGameEngine } from "@/hooks/useGame";
import { useGameTick } from "@/hooks/useGameTick";
import { assetCSSColourVariable } from "@/lib/assets/asset-colors";
import { formatDuration } from "@/lib/format-utils";

/** Configuration for how to render a time series chart. */
export interface TimeSeriesChartConfig {
    /** Type of chart to render */
    chartVariant: "area" | "line" | "bar";
    /** Whether to stack multiple series */
    stacked?: boolean;
    /** Height of the chart in pixels */
    height?: number;
    /** Whether to show the brush (zoom/pan control) */
    showBrush?: boolean;
    /** Function to get color for a data key */
    getColor?: (key: string) => string;
    /** Function to filter which data keys to display */
    filterDataKeys?: (key: string, data: unknown[]) => boolean;
    /** Custom formatter for the Y axis */
    formatYAxis?: (value: number) => string;
    /** Custom formatter for tooltips */
    formatValue: (value: number) => ReactNode;
    /** Keys that should use gradient fill based on positive/negative values */
    gradientKeys?: string[];
}

/** Props for a data series component (Area, Line, Bar). */
export interface SeriesComponentProps {
    key: string;
    dataKey: string;
    stackId?: string;
    fill?: string;
    stroke?: string;
    fillOpacity?: number;
    isAnimationActive?: boolean;
    [key: string]: unknown;
}

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
        formatValue,
        gradientKeys = [],
    } = config;

    // Calculate gradient offsets for keys that need value-based gradients
    const gradientOffsets = useMemo(() => {
        const offsets: Record<string, number> = {};

        if (!data || data.length === 0 || gradientKeys.length === 0) {
            return offsets;
        }

        gradientKeys.forEach((key) => {
            const values = data
                .map((d) => (typeof d[key] === "number" ? d[key] : 0) as number)
                .filter((v) => !isNaN(v));

            if (values.length === 0) return;

            const dataMax = Math.max(...values);
            const dataMin = Math.min(...values);
            const range = dataMax - dataMin;

            // Calculate offset for gradient transition point
            // Use a small tolerance to prefer green in edge cases
            if (dataMax <= 0) {
                offsets[key] = 0;
            } else if (dataMin >= 0 || Math.abs(dataMin) < range * 0.01) {
                // If all positive, or negative portion is negligible (< 0.1% of range)
                offsets[key] = 1;
            } else {
                offsets[key] = dataMax / (dataMax - dataMin);
            }
        });

        return offsets;
    }, [data, gradientKeys]);

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
            const useGradient = gradientKeys.includes(key);
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
                            fill={useGradient ? `url(#gradient-${key})` : color}
                            fillOpacity={1}
                            strokeOpacity={0}
                            type={"step"}
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
    }, [data, chartVariant, stacked, getColor, filterDataKeys, gradientKeys]);

    const { currentTick } = useGameTick();
    const { mode } = useTimeMode();
    const { data: gameEngine } = useGameEngine();

    const xAxisTickFormatter = useCallback(
        (tick: number) =>
            !gameEngine || currentTick === undefined
                ? "--"
                : formatDuration(currentTick - tick - 1, mode, gameEngine),
        [mode, gameEngine, currentTick],
    );

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
                {/* Define gradients for keys that need value-based fills */}
                {gradientKeys.length > 0 && (
                    <defs>
                        {gradientKeys.map((key) => {
                            const offset = gradientOffsets[key] ?? 0.5;
                            return (
                                <linearGradient
                                    key={`gradient-${key}`}
                                    id={`gradient-${key}`}
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                >
                                    <stop
                                        offset="0"
                                        stopColor="green"
                                        stopOpacity={1}
                                    />
                                    <stop
                                        offset={offset}
                                        stopColor="green"
                                        stopOpacity={1}
                                    />
                                    <stop
                                        offset={offset}
                                        stopColor="red"
                                        stopOpacity={1}
                                    />
                                    <stop
                                        offset="1"
                                        stopColor="red"
                                        stopOpacity={1}
                                    />
                                </linearGradient>
                            );
                        })}
                    </defs>
                )}
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                    dataKey="tick"
                    type="number"
                    tick={{ fontSize: 12 }}
                    tickFormatter={xAxisTickFormatter}
                    tickCount={7}
                    domain={["dataMin-1", "dataMax"]}
                />
                <YAxis tickFormatter={formatYAxis} />
                {showBrush && (
                    <Brush dataKey="tick" height={30} stroke="#7a7a7aff" />
                )}
                {seriesComponents}
                <Tooltip
                    content={(props) => (
                        <CustomTooltipContent
                            active={props.active}
                            payload={props.payload}
                            label={props.label}
                            formatValue={formatValue}
                        />
                    )}
                    isAnimationActive={false}
                />
            </ChartComponent>
        </ResponsiveContainer>
    );
}

interface CustomTooltipContentProps {
    active?: boolean;
    payload?: ReadonlyArray<{
        value: number;
        name: string;
        [key: string]: unknown;
    }>;
    label?: string | number;
    formatValue: (value: number) => ReactNode;
}

function CustomTooltipContent({
    active,
    payload,
    label,
    formatValue,
}: CustomTooltipContentProps) {
    const { currentTick } = useGameTick();
    const { mode } = useTimeMode();

    const isVisible = active && payload && payload.length;
    if (!isVisible) return null;
    return (
        <div className="bg-neutral-100 dark:bg-neutral-600 p-2">
            <table>
                {currentTick !== undefined &&
                    label !== undefined &&
                    typeof label === "number" && (
                        <caption className="caption-bottom">
                            <Duration ticks={currentTick - label} compact />
                            <>{" ago "}</>
                            {mode}
                        </caption>
                    )}
                <thead hidden>
                    <tr>
                        <th></th>
                        <th>{"label"}</th>
                        <th>{"value"}</th>
                    </tr>
                </thead>
                <tbody>
                    {payload
                        .filter((p) => p.value !== 0)
                        .sort(
                            (a, b) => (b.value as number) - (a.value as number),
                        )
                        .map((p) => (
                            <tr>
                                <td>
                                    <div
                                        className="h-6 aspect-square"
                                        style={{
                                            backgroundColor:
                                                assetCSSColourVariable(p.name),
                                        }}
                                    />
                                </td>
                                <td className="px-2 min-w-30">
                                    {/* {p.name} */}
                                    <AssetName assetId={p.name} />
                                </td>
                                <td className="px-2">{formatValue(p.value)}</td>
                            </tr>
                        ))}
                </tbody>
            </table>
        </div>
    );
}
