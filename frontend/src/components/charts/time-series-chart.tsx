/** Generic time series chart component supporting multiple chart types. */

import { RefreshCw } from "lucide-react";
import {
    ForwardRefExoticComponent,
    RefAttributes,
    useCallback,
    useMemo,
    type ReactNode,
} from "react";
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
    ReferenceLine,
} from "recharts";
import { CartesianChartProps } from "recharts/types/util/types";

import { CustomTooltipContent } from "@/components/charts/tooltip-content";
import { useTimeMode } from "@/contexts/time-mode-context";
import { useGameEngine } from "@/hooks/use-game";
import { useGameTick } from "@/hooks/use-game-tick";
import {
    KEY_ORDER_BY_CHART_TYPE,
    reorderObjectKeys,
} from "@/lib/charts/key-order";
import { formatDuration } from "@/lib/format-utils";
import { ChartType } from "@/types/charts";

type ChartVariant = "area" | "steppedLine" | "smoothLine" | "bar";

const CHART_VARIANT_MAPPING: Record<
    ChartVariant,
    ForwardRefExoticComponent<
        CartesianChartProps & RefAttributes<SVGSVGElement>
    >
> = {
    area: AreaChart,
    smoothLine: LineChart,
    steppedLine: LineChart,
    bar: BarChart,
};

/** Configuration for how to render a time series chart. */
export interface TimeSeriesChartConfig {
    /** Chart type - used to maintain deliberate key ordering when filtering */
    chartType?: ChartType;
    /** Type of chart to render */
    chartVariant: ChartVariant;
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
    /** Whether to hide zero values in tooltips (default: true) */
    hideZeroValues?: boolean;
}

interface TimeSeriesChartProps {
    /** Chart data with tick and series values */
    data: Array<Record<string, unknown>>;
    /** Chart configuration */
    config: TimeSeriesChartConfig;
    /** Additional chart components */
    children?: React.ReactNode;
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
    config: {
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
        hideZeroValues = true,
    },
    isLoading = false,
    isError = false,
    errorMessage = "Failed to load data",
    children = <></>,
}: TimeSeriesChartProps) {
    // Reorder data keys if chartType is provided to preserve deliberate ordering
    const orderedData = useMemo(() => {
        if (!chartType) return data;
        const keyOrder = KEY_ORDER_BY_CHART_TYPE[chartType];
        return data.map((dataPoint) => reorderObjectKeys(dataPoint, keyOrder));
    }, [data, chartType]);

    // Calculate gradient offsets for keys that need value-based gradients
    const gradientOffsets = useMemo(() => {
        const offsets: Record<string, number> = {};

        if (orderedData.length === 0 || gradientKeys.length === 0) {
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
        if (orderedData.length === 0) return [];

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
                case "steppedLine":
                    return (
                        <Line
                            key={key}
                            {...commonProps}
                            stroke={color}
                            strokeWidth={2}
                            dot={false}
                            type={"step"}
                        />
                    );
                case "smoothLine":
                    return (
                        <Line
                            key={key}
                            {...commonProps}
                            stroke={color}
                            strokeWidth={2}
                            dot={false}
                            type={"monotone"}
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
                    throw chartVariant satisfies never;
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
        if (orderedData.length === 0) return "empty";
        const keys = seriesComponents.map((c) => c.key).filter(Boolean);
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
                getColor={getColor}
                hideZeroValues={hideZeroValues}
            />
        ),
        [formatValue, formatLabel, getColor, hideZeroValues],
    );

    if (isLoading) {
        // TODO: use shadcn, make take same space as real charts to avoid page scrolling
        return (
            <div
                className="w-full flex items-center justify-center py-12"
                style={{ height: `${height}px` }}
            >
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                Loading data...
            </div>
        );
    }

    if (isError) {
        return (
            <div className="text-center py-12 text-alert-red">
                {errorMessage}
            </div>
        );
    }

    const ChartComponent = CHART_VARIANT_MAPPING[chartVariant];

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
                {/* Clearing price line */}
                <ReferenceLine
                    x={0}
                    stroke="var(--primary)"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    label={{
                        value: "Game Start",
                        position: "insideTopLeft",
                        fill: "var(--muted-foreground)",
                        fontSize: 12,
                    }}
                />
                {children}
            </ChartComponent>
        </ResponsiveContainer>
    );
}
