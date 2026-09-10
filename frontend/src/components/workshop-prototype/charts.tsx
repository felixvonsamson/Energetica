/**
 * PROTOTYPE — Workshop Mode UI mockup (issue #992).
 *
 * Lightweight, self-contained echarts visuals styled after the real app's
 * power-generation and merit-order charts (`components/charts/power-chart.tsx`,
 * `components/charts/supply-demand-chart.tsx`), but built directly against
 * static sample data instead of the real hooks — wiring the real components up
 * to fake data would mean faking half the query layer for a mockup that only
 * needs to look right. When Workshop Mode is actually built, §12 of the spec
 * calls for reusing the real chart components as-is.
 */

import type {
    BarSeriesOption,
    CustomSeriesOption,
    LineSeriesOption,
} from "echarts/charts";
import { BarChart, CustomChart, LineChart } from "echarts/charts";
import {
    GridComponent,
    MarkLineComponent,
    TooltipComponent,
} from "echarts/components";
import type {
    GridComponentOption,
    MarkLineComponentOption,
    TooltipComponentOption,
} from "echarts/components";
import type { ComposeOption } from "echarts/core";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { useEffect, useMemo, useRef } from "react";

import { CATEGORY_META } from "@/lib/workshop-prototype/meta";
import type {
    FacilityCategory,
    MeritOrderOffer,
} from "@/lib/workshop-prototype/sample-data";

echarts.use([
    BarChart,
    CustomChart,
    LineChart,
    GridComponent,
    TooltipComponent,
    MarkLineComponent,
    CanvasRenderer,
]);

type ECOption = ComposeOption<
    | BarSeriesOption
    | CustomSeriesOption
    | LineSeriesOption
    | GridComponentOption
    | TooltipComponentOption
    | MarkLineComponentOption
>;

function resolveVar(name: string): string {
    if (typeof document === "undefined") return "#888";
    return getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        .trim();
}

// Bare custom-property names (no `var(...)` wrapper) — canvas fillStyle can't
// resolve `var()` itself, so every use below goes through `resolveVar`.
const CATEGORY_COLOR_VAR: Record<FacilityCategory | "demand", string> = {
    pv: "--chart-4",
    wind: "--chart-2",
    hydro: "--chart-3",
    nuclear: "--chart-6",
    conventional_gas: "--chart-5",
    conventional_coal: "--chart-1",
    battery: "--chart-2",
    hydrogen_storage: "--chart-3",
    pumped_hydro: "--chart-3",
    csp: "--chart-4",
    demand: "--muted-foreground",
};

function categoryColor(category: FacilityCategory | "demand"): string {
    return resolveVar(CATEGORY_COLOR_VAR[category]);
}

function useEChart(optionFactory: () => ECOption, deps: React.DependencyList) {
    const ref = useRef<HTMLDivElement>(null);
    const instanceRef = useRef<echarts.ECharts | null>(null);

    useEffect(() => {
        if (!ref.current) return;
        const instance = echarts.init(ref.current);
        instanceRef.current = instance;
        const onResize = () => instance.resize();
        window.addEventListener("resize", onResize);
        return () => {
            window.removeEventListener("resize", onResize);
            instance.dispose();
        };
    }, []);

    useEffect(() => {
        instanceRef.current?.setOption(optionFactory(), true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);

    return ref;
}

// ---------------------------------------------------------------------------
// Generation stack chart — stacked bars per tech, across the day's ticks.
// ---------------------------------------------------------------------------

const GEN_KEYS: FacilityCategory[] = [
    "pv",
    "wind",
    "hydro",
    "nuclear",
    "conventional_gas",
    "conventional_coal",
];

export function GenerationStackChart({
    hours,
    generation,
    markHour,
    height = 260,
}: {
    hours: number[];
    generation: Array<Record<FacilityCategory, number> & { hour: number }>;
    markHour?: number;
    height?: number;
}) {
    const ref = useEChart(
        () => ({
            grid: { left: 48, right: 16, top: 16, bottom: 28 },
            tooltip: {
                trigger: "axis",
                axisPointer: { type: "shadow" },
                valueFormatter: (v) => `${v} MW`,
            },
            xAxis: {
                type: "category",
                data: hours.map((h) => `${h}:00`),
                axisLabel: {
                    color: resolveVar("--muted-foreground"),
                    interval: 2,
                },
                axisLine: { lineStyle: { color: resolveVar("--border") } },
            },
            yAxis: {
                type: "value",
                name: "MW",
                axisLabel: { color: resolveVar("--muted-foreground") },
                splitLine: { lineStyle: { color: resolveVar("--border") } },
            },
            series: [
                ...GEN_KEYS.map(
                    (key): BarSeriesOption => ({
                        name: CATEGORY_META[key].label,
                        type: "bar",
                        stack: "gen",
                        data: generation.map((g) => g[key]),
                        itemStyle: { color: categoryColor(key) },
                        barMaxWidth: 22,
                    }),
                ),
                ...(markHour !== undefined
                    ? [
                          {
                              name: "scrub-marker",
                              type: "line" as const,
                              data: [],
                              markLine: {
                                  silent: true,
                                  symbol: ["none", "none"],
                                  lineStyle: {
                                      color: resolveVar("--foreground"),
                                      width: 2,
                                      type: "solid" as const,
                                  },
                                  data: [{ xAxis: markHour }],
                              },
                          },
                      ]
                    : []),
            ],
            legend: {
                bottom: 0,
                textStyle: { color: resolveVar("--muted-foreground") },
                icon: "circle",
            },
        }),
        [hours, generation, markHour],
    );

    return <div ref={ref} style={{ width: "100%", height }} />;
}

// ---------------------------------------------------------------------------
// Merit order chart — supply ascending vs. demand descending, both cumulative.
// ---------------------------------------------------------------------------

const DISPLAY_PRICE_CAP = 150;

export function MeritOrderChart({
    offers,
    clearingPrice,
    height = 320,
}: {
    offers: MeritOrderOffer[];
    clearingPrice: number;
    height?: number;
}) {
    const { supplyBlocks, demandBlocks, clearingQuantity, maxX } =
        useMemo(() => {
            const supply = offers
                .filter((o) => o.category !== "demand")
                .sort((a, b) => a.priceEurPerMwh - b.priceEurPerMwh);
            const demand = offers
                .filter((o) => o.category === "demand")
                .sort((a, b) => b.priceEurPerMwh - a.priceEurPerMwh);

            const supplyBlocks = supply.reduce<
                Array<
                    MeritOrderOffer & {
                        x1: number;
                        x2: number;
                        displayPrice: number;
                    }
                >
            >((acc, o) => {
                const x1 = acc.length ? acc[acc.length - 1]!.x2 : 0;
                const x2 = x1 + o.quantityMw;
                acc.push({ ...o, x1, x2, displayPrice: o.priceEurPerMwh });
                return acc;
            }, []);

            const demandBlocks = demand.reduce<
                Array<
                    MeritOrderOffer & {
                        x1: number;
                        x2: number;
                        displayPrice: number;
                    }
                >
            >((acc, o) => {
                const x1 = acc.length ? acc[acc.length - 1]!.x2 : 0;
                const x2 = x1 + o.quantityMw;
                const displayPrice = Number.isFinite(o.priceEurPerMwh)
                    ? o.priceEurPerMwh
                    : DISPLAY_PRICE_CAP;
                acc.push({ ...o, x1, x2, displayPrice });
                return acc;
            }, []);

            const cum = supplyBlocks[supplyBlocks.length - 1]?.x2 ?? 0;
            const cumD = demandBlocks[demandBlocks.length - 1]?.x2 ?? 0;
            const maxX = Math.max(cum, cumD) * 1.03;
            return {
                supplyBlocks,
                demandBlocks,
                clearingQuantity: supply.reduce((s, o) => s + o.quantityMw, 0),
                maxX,
            };
        }, [offers]);

    const ref = useEChart(
        () => ({
            grid: { left: 56, right: 16, top: 16, bottom: 40 },
            tooltip: {
                trigger: "item",
                formatter: (p) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const d = (p as any).data as {
                        label: string;
                        priceEurPerMwh: number;
                        quantityMw: number;
                        isOwnBid: boolean;
                    };
                    const price = Number.isFinite(d.priceEurPerMwh)
                        ? `€${d.priceEurPerMwh}/MWh`
                        : "any price (must-serve)";
                    return `<b>${d.label}</b>${d.isOwnBid ? " (you)" : ""}<br/>${d.quantityMw} MW @ ${price}`;
                },
            },
            xAxis: {
                type: "value",
                name: "Cumulative MW",
                min: 0,
                max: maxX,
                axisLabel: { color: resolveVar("--muted-foreground") },
                splitLine: { show: false },
            },
            yAxis: {
                type: "value",
                name: "€/MWh",
                min: 0,
                max: DISPLAY_PRICE_CAP,
                axisLabel: { color: resolveVar("--muted-foreground") },
                splitLine: { lineStyle: { color: resolveVar("--border") } },
            },
            series: [
                {
                    type: "custom",
                    name: "supply",
                    renderItem(_params, api) {
                        const x1 = api.value(0) as number;
                        const x2 = api.value(1) as number;
                        const y1 = 0;
                        const y2 = api.value(2) as number;
                        const topLeft = api.coord([x1, y2]);
                        const bottomRight = api.coord([x2, y1]);
                        return {
                            type: "rect",
                            shape: {
                                x: topLeft[0],
                                y: topLeft[1],
                                width:
                                    (bottomRight[0] ?? 0) - (topLeft[0] ?? 0),
                                height:
                                    (bottomRight[1] ?? 0) - (topLeft[1] ?? 0),
                            },
                            style: api.style(),
                        };
                    },
                    encode: { x: [0, 1], y: 2 },
                    data: supplyBlocks.map((b) => ({
                        value: [b.x1, b.x2, b.displayPrice],
                        label: b.label,
                        priceEurPerMwh: b.priceEurPerMwh,
                        quantityMw: b.quantityMw,
                        isOwnBid: b.isOwnBid,
                        itemStyle: {
                            color: categoryColor(b.category),
                            opacity: b.isOwnBid ? 1 : 0.55,
                            borderColor: b.isOwnBid
                                ? resolveVar("--foreground")
                                : "transparent",
                            borderWidth: b.isOwnBid ? 2 : 0,
                        },
                    })),
                    z: 2,
                },
                {
                    type: "line",
                    name: "demand curve",
                    // Explicit staircase points rather than echarts' `step`
                    // option: each block contributes its own flat segment
                    // ([x1, price] → [x2, price]) at its own price, so
                    // consecutive blocks — sharing an x at the boundary —
                    // draw the vertical drop to the next tier's price
                    // exactly at that boundary, not one tier late.
                    symbol: "none",
                    lineStyle: {
                        color: resolveVar("--muted-foreground"),
                        width: 2,
                        type: "dashed",
                    },
                    data: demandBlocks.flatMap((b) => [
                        [b.x1, b.displayPrice],
                        [b.x2, b.displayPrice],
                    ]),
                    z: 3,
                    markLine: {
                        silent: true,
                        symbol: ["none", "none"],
                        lineStyle: { color: resolveVar("--brand"), width: 2 },
                        label: { formatter: "Clearing" },
                        data: [
                            { xAxis: clearingQuantity },
                            { yAxis: clearingPrice },
                        ],
                    },
                },
            ],
        }),
        [supplyBlocks, demandBlocks, clearingQuantity, clearingPrice, maxX],
    );

    return <div ref={ref} style={{ width: "100%", height }} />;
}
