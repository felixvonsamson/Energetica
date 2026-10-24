/**
 * One ECharts chart for the control room (#1289), filling its box. Only the
 * chart types and components the control room uses are registered.
 */

import { BarChart, CustomChart, LineChart } from "echarts/charts";
import type {
    BarSeriesOption,
    CustomSeriesOption,
    LineSeriesOption,
} from "echarts/charts";
import { GridComponent, LegendComponent } from "echarts/components";
import type {
    GridComponentOption,
    LegendComponentOption,
} from "echarts/components";
import type { ComposeOption } from "echarts/core";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { useEffect, useRef } from "react";

echarts.use([
    BarChart,
    CustomChart,
    LineChart,
    GridComponent,
    LegendComponent,
    CanvasRenderer,
]);

export type ControlRoomChartOption = ComposeOption<
    | BarSeriesOption
    | CustomSeriesOption
    | LineSeriesOption
    | GridComponentOption
    | LegendComponentOption
>;

export function EChart({ option }: { option: ControlRoomChartOption }) {
    const ref = useRef<HTMLDivElement>(null);
    const chart = useRef<echarts.ECharts | null>(null);

    useEffect(() => {
        if (!ref.current) return;
        const instance = echarts.init(ref.current, null, {
            renderer: "canvas",
        });
        chart.current = instance;
        // A ResizeObserver reports the size before the canvas's CSS scale, which is the size to draw at.
        const observer = new ResizeObserver(() => instance.resize());
        observer.observe(ref.current);
        return () => {
            observer.disconnect();
            instance.dispose();
            chart.current = null;
        };
    }, []);

    useEffect(() => {
        chart.current?.setOption(option, { notMerge: true });
    }, [option]);

    return <div ref={ref} className="h-full w-full" />;
}
