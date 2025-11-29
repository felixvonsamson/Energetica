/** Type definitions for chart components. */

import { ComponentType } from "react";

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
    filterDataKeys?: (key: string, data: any[]) => boolean;
    /** Custom formatter for the Y axis */
    formatYAxis?: (value: number) => string;
    /** Custom formatter for tooltips */
    formatTooltip?: (value: number, name: string) => [string, string];
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
    [key: string]: any;
}
