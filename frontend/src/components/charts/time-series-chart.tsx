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

import { ChartLoadingState } from "@/components/charts/chart-loading-state";
import { AssetName, Duration, FacilityIcon } from "@/components/ui";
import { useTimeMode } from "@/contexts/time-mode-context";
import { useGameEngine } from "@/hooks/useGame";
import { useGameTick } from "@/hooks/useGameTick";
import { assetCSSColourVariable } from "@/lib/assets/asset-colors";
import {
    KEY_ORDER_BY_CHART_TYPE,
    reorderObjectKeys,
} from "@/lib/charts/chart-key-order";
import { formatDuration } from "@/lib/format-utils";
import { ChartType } from "@/types/charts";

/** Configuration for how to render a time series chart. */
export interface TimeSeriesChartConfig {
    /** Chart type - used to maintain deliberate key ordering when filtering */
    chartType?: ChartType;
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
    filterDataKeys?: Array<(key: string, data: unknown[]) => boolean>;
    /** Custom formatter for the Y axis */
    formatYAxis?: (value: number) => string;
    /** Custom formatter for tooltips */
    formatValue: (value: number) => ReactNode;
    /** Custom formatter for data key labels in tooltip */
    formatLabel?: (key: string) => ReactNode;
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
        chartType,
        chartVariant = "area",
        stacked = false,
        height = 500,
        showBrush = true,
        getColor,
        filterDataKeys,
        formatYAxis,
        formatValue,
        formatLabel,
        gradientKeys = [],
    } = config;

    // Reorder data keys if chartType is provided to preserve deliberate ordering
    const orderedData = useMemo(() => {
        if (!chartType) return data;
        const keyOrder = KEY_ORDER_BY_CHART_TYPE[chartType];
        return data.map((dataPoint) => reorderObjectKeys(dataPoint, keyOrder));
    }, [data, chartType]);

    // Calculate gradient offsets for keys that need value-based gradients
    const gradientOffsets = useMemo(() => {
        const offsets: Record<string, number> = {};

        if (
            !orderedData ||
            orderedData.length === 0 ||
            gradientKeys.length === 0
        ) {
            return offsets;
        }

        gradientKeys.forEach((key) => {
            const values = orderedData
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
    }, [orderedData, gradientKeys]);

    // Extract and filter data keys
    const seriesComponents = useMemo(() => {
        if (!orderedData || orderedData.length === 0) return [];

        const firstDataPoint = orderedData[0];
        if (!firstDataPoint) return [];

        // Extract all keys except 'tick'
        const dataKeys = Object.keys(firstDataPoint).filter(
            (key) => key !== "tick",
        );

        // Apply filtering if provided
        const filteredKeys = filterDataKeys
            ? dataKeys.filter((key) =>
                  filterDataKeys.every((cond) => cond(key, orderedData)),
              )
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
    }, [
        orderedData,
        chartVariant,
        stacked,
        getColor,
        filterDataKeys,
        gradientKeys,
    ]);

    // Create a stable key from the series order to force re-render when order changes
    const chartKey = useMemo(() => {
        if (!orderedData || orderedData.length === 0) return "empty";
        const keys = seriesComponents.map((c) => c?.key).filter(Boolean);
        return keys.join("-");
    }, [seriesComponents, orderedData]);

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

    const tooltipContent = useCallback(
        (props: {
            active?: boolean;
            payload?: ReadonlyArray<{
                value: number;
                name: string;
                [key: string]: unknown;
            }>;
            label?: string | number;
        }) => (
            <CustomTooltipContent
                active={props.active}
                payload={props.payload}
                label={props.label}
                formatValue={formatValue}
                formatLabel={formatLabel}
            />
        ),
        [formatValue, formatLabel],
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
            <ChartComponent key={chartKey} data={orderedData}>
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
                                        stopColor="var(--success)"
                                        stopOpacity={1}
                                    />
                                    <stop
                                        offset={offset}
                                        stopColor="var(--success)"
                                        stopOpacity={1}
                                    />
                                    <stop
                                        offset={offset}
                                        stopColor="var(--destructive)"
                                        stopOpacity={1}
                                    />
                                    <stop
                                        offset="1"
                                        stopColor="var(--destructive)"
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
                <Tooltip content={tooltipContent} isAnimationActive={false} />
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
    formatLabel?: (key: string) => ReactNode;
}

function CustomTooltipContent({
    active,
    payload,
    label,
    formatValue,
    formatLabel,
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
                        <th />
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
                            <tr key={p.name}>
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
                                    {formatLabel ? (
                                        formatLabel(p.name)
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <FacilityIcon
                                                facility={p.name}
                                                size={18}
                                            />
                                            <AssetName assetId={p.name} />
                                        </div>
                                    )}
                                </td>
                                <td className="px-2">{formatValue(p.value)}</td>
                            </tr>
                        ))}
                </tbody>
            </table>
        </div>
    );
}
