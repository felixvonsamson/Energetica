/**
 * PROTOTYPE (#1289) — throwaway. The control room's charts, drawn with the full
 * ECharts bundle for speed of writing. The real page should register only what
 * it uses, as `components/charts/` does.
 */

import * as echarts from "echarts";
import { useEffect, useRef } from "react";

import {
    DURATION_CURVE,
    EMISSIONS,
    FUEL_LABELS,
    MARKET_PRICES,
    MIX,
    MIX_HOURS,
    MIX_SOURCES,
    PERIODS,
    PLAYER_PRICES,
    PRICE_TYPES,
} from "./mock-data";

export const INK = "#d6e6ff";
export const DIM = "#7d93b3";
export const GRID_LINE = "#1d2b40";

/** One ECharts instance that fills its box and follows its size. */
export function EChart({
    option,
    className,
}: {
    option: echarts.EChartsOption;
    className?: string;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const chart = useRef<echarts.ECharts | null>(null);

    useEffect(() => {
        if (!ref.current) return;
        const instance = echarts.init(ref.current, null, {
            renderer: "canvas",
        });
        chart.current = instance;
        // ResizeObserver reports the size before any CSS transform, which is the size ECharts should draw at.
        const observer = new ResizeObserver(() => instance.resize());
        observer.observe(ref.current);
        return () => {
            observer.disconnect();
            instance.dispose();
        };
    }, []);

    useEffect(() => {
        chart.current?.setOption(option, { notMerge: true });
    }, [option]);

    return <div ref={ref} className={className ?? "h-full w-full"} />;
}

const axisLabel = (fontSize: number) => ({
    color: DIM,
    fontSize,
    fontFamily: "ui-monospace, monospace",
});

const tooltip: echarts.TooltipComponentOption = {
    trigger: "axis",
    backgroundColor: "#0b1424",
    borderColor: "#2a3d5c",
    textStyle: { color: INK, fontSize: 16 },
};

function categoryAxis(data: string[], fontSize: number, show = true) {
    return {
        type: "category" as const,
        data,
        axisLabel: { ...axisLabel(fontSize), show },
        axisLine: { lineStyle: { color: GRID_LINE } },
        axisTick: { show: false },
    };
}

function valueAxis(fontSize: number, name?: string) {
    return {
        type: "value" as const,
        name,
        nameTextStyle: { color: DIM, fontSize },
        axisLabel: axisLabel(fontSize),
        splitLine: { lineStyle: { color: GRID_LINE } },
    };
}

/**
 * A fuel's price over the seasons, with no axes: the value is printed beside
 * it.
 */
export function fuelSparkline(
    prices: number[],
    color: string,
): echarts.EChartsOption {
    return {
        grid: { left: 4, right: 4, top: 6, bottom: 4 },
        tooltip,
        xAxis: {
            type: "category",
            data: FUEL_LABELS,
            show: false,
            boundaryGap: false,
        },
        yAxis: { type: "value", show: false, scale: true },
        series: [
            {
                type: "line",
                data: prices,
                smooth: false,
                symbol: "none",
                lineStyle: { color, width: 3 },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        {
                            offset: 0,
                            color: color
                                .replace("rgb", "rgba")
                                .replace(")", ", 0.35)"),
                        },
                        { offset: 1, color: "rgba(0,0,0,0)" },
                    ]),
                },
                markPoint: {
                    symbol: "circle",
                    symbolSize: 10,
                    itemStyle: { color },
                    label: { show: false },
                    data: [
                        {
                            name: "now",
                            coord: [
                                FUEL_LABELS.length - 1,
                                prices[prices.length - 1]!,
                            ],
                        },
                    ],
                },
            },
        ],
    };
}

/**
 * Each settled season's average price, with a band from the 10th to the 90th
 * percentile.
 */
export function marketPricesOption(fontSize = 15): echarts.EChartsOption {
    const low = MARKET_PRICES.map((p) => p.p10);
    const band = MARKET_PRICES.map((p) => p.p90 - p.p10);
    return {
        grid: { left: 52, right: 12, top: 28, bottom: 30 },
        tooltip,
        xAxis: categoryAxis(PERIODS, fontSize),
        yAxis: valueAxis(fontSize, "per MWh"),
        series: [
            {
                type: "bar",
                stack: "band",
                data: low,
                itemStyle: { color: "transparent" },
                silent: true,
            },
            {
                type: "bar",
                stack: "band",
                name: "10–90% range",
                data: band,
                barWidth: "55%",
                itemStyle: {
                    color: "rgba(79, 195, 255, 0.22)",
                    borderColor: "rgba(79,195,255,0.5)",
                },
            },
            {
                type: "line",
                name: "Average",
                data: MARKET_PRICES.map((p) => p.mean),
                symbolSize: 10,
                lineStyle: { color: "#4fc3ff", width: 3 },
                itemStyle: { color: "#4fc3ff" },
                label: {
                    show: true,
                    position: "top",
                    color: INK,
                    fontSize,
                    formatter: ({ value }) => String(Math.round(Number(value))),
                },
            },
        ],
    };
}

/** The room's prices for one facility type, as a box per Trading period. */
export function playerPriceBoxes(
    index: number,
    fontSize = 13,
    showLabels = true,
): echarts.EChartsOption {
    const type = PRICE_TYPES[index]!;
    const labels = [...PERIODS, "R3 Spr"];
    return {
        grid: { left: 40, right: 6, top: 8, bottom: showLabels ? 22 : 6 },
        xAxis: categoryAxis(labels, fontSize - 2, showLabels),
        yAxis: { ...valueAxis(fontSize - 2), splitNumber: 2 },
        series: [
            {
                type: "boxplot",
                data: PLAYER_PRICES[index],
                itemStyle: {
                    color: "rgba(0,0,0,0)",
                    borderColor: type.color,
                    borderWidth: 2,
                },
                boxWidth: ["30%", "70%"],
            },
        ],
    };
}

/** The room's generation over the last settled period's week, stacked by source. */
export function generationMixOption(fontSize = 15): echarts.EChartsOption {
    const hours = Array.from({ length: MIX_HOURS }, (_, h) => h);
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return {
        grid: { left: 64, right: 12, top: 36, bottom: 28 },
        tooltip,
        legend: {
            top: 0,
            textStyle: { color: INK, fontSize },
            itemWidth: 14,
            itemHeight: 14,
            icon: "rect",
        },
        xAxis: {
            ...categoryAxis(hours.map(String), fontSize),
            boundaryGap: false,
            axisLabel: {
                ...axisLabel(fontSize),
                interval: (i: number) => i % 24 === 12,
                formatter: (v: string | number) =>
                    days[Math.floor(Number(v) / 24)]!,
            },
        },
        yAxis: { ...valueAxis(fontSize, "MW") },
        series: MIX_SOURCES.map((source, i) => ({
            type: "line",
            name: source.name,
            stack: "mix",
            data: MIX[i],
            symbol: "none",
            lineStyle: { width: 0 },
            areaStyle: { color: source.color, opacity: 0.9 },
            itemStyle: { color: source.color },
        })),
    };
}

/** The last settled period's prices, highest first. */
export function durationCurveOption(fontSize = 15): echarts.EChartsOption {
    return {
        grid: { left: 52, right: 12, top: 20, bottom: 30 },
        xAxis: {
            type: "category",
            data: DURATION_CURVE.map(
                (_, i) => `${Math.round((i / DURATION_CURVE.length) * 100)}%`,
            ),
            axisLabel: {
                ...axisLabel(fontSize),
                interval: Math.floor(DURATION_CURVE.length / 4),
            },
            axisLine: { lineStyle: { color: GRID_LINE } },
        },
        yAxis: { ...valueAxis(fontSize, "per MWh"), max: 300 },
        series: [
            {
                type: "line",
                data: DURATION_CURVE,
                symbol: "none",
                lineStyle: { color: "#ff8a1f", width: 3 },
                areaStyle: { color: "rgba(255,138,31,0.15)" },
            },
        ],
    };
}

/** The room's emissions in each settled period. */
export function emissionsOption(
    fontSize = 14,
    showAxis = true,
): echarts.EChartsOption {
    return {
        grid: {
            left: showAxis ? 48 : 4,
            right: 4,
            top: 8,
            bottom: showAxis ? 24 : 4,
        },
        xAxis: categoryAxis(PERIODS, fontSize, showAxis),
        yAxis: {
            ...valueAxis(fontSize),
            show: showAxis,
            axisLabel: {
                ...axisLabel(fontSize),
                formatter: (v: number) => `${v / 1000}k`,
            },
        },
        series: [
            {
                type: "bar",
                data: EMISSIONS,
                barWidth: "60%",
                itemStyle: { color: "#9aa7b8" },
            },
        ],
    };
}
