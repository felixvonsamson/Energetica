/**
 * Sankey diagram of electricity market flows at a single tick.
 *
 * Visualizes sellers → Market → buyers with link widths proportional to cleared
 * MW. Sources and sinks are grouped either by player or by facility type,
 * controlled by `colorMode`. The center node is labeled with the clearing
 * volume and price.
 *
 * Reuses the breakdown chart endpoints (market-exports / market-imports /
 * market-generation / market-consumption) which already return per-tick
 * pre-aggregated values, so no client-side merit-order walking is needed.
 */

import { SankeyChart } from "echarts/charts";
import type { SankeySeriesOption } from "echarts/charts";
import { TooltipComponent } from "echarts/components";
import type { TooltipComponentOption } from "echarts/components";
import type { ComposeOption } from "echarts/core";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { memo, useEffect, useMemo, useRef } from "react";

import type { ColorMode } from "@/components/charts/supply-demand-chart";
import { useAssetColorGetter } from "@/hooks/use-asset-color-getter";
import { useChartData } from "@/hooks/use-charts";
import { usePlayerMap } from "@/hooks/use-players";
import { getAssetLongName } from "@/lib/assets/asset-names";
import {
    getHashBasedChartColor,
    resolveColor,
    resolveCSSVar,
} from "@/lib/charts/color-utils";
import { formatMoney, formatPower } from "@/lib/format-utils";

echarts.use([SankeyChart, TooltipComponent, CanvasRenderer]);

type ECOption = ComposeOption<SankeySeriesOption | TooltipComponentOption>;

export interface MarketFlowSankeyProps {
    marketId: number;
    selectedTick: number;
    colorMode: ColorMode;
    height?: number;
}

// Slider window in supply-demand-chart.tsx is the same 360-tick window we
// pull breakdown data over here.
const SLIDER_RANGE = 360;
// Suppress labels for nodes contributing less than this share of cleared volume.
const LABEL_MIN_SHARE = 0.02;
const MARKET_NODE_ID = "__market__";

interface SideNode {
    id: string;
    displayName: string;
    value: number;
    color: string;
}

function MarketFlowSankeyInner({
    marketId,
    selectedTick,
    colorMode,
    height = 500,
}: MarketFlowSankeyProps) {
    const getColor = useAssetColorGetter();
    const playerMap = usePlayerMap();

    const supplyChartType =
        colorMode === "player" ? "market-exports" : "market-generation";
    const demandChartType =
        colorMode === "player" ? "market-imports" : "market-consumption";

    const {
        chartData: supplyData,
        isLoading: isLoadingSupply,
        isError: isErrorSupply,
    } = useChartData({
        config: { chartType: supplyChartType, resolution: 1, marketId },
        maxDatapoints: SLIDER_RANGE,
    });
    const {
        chartData: demandData,
        isLoading: isLoadingDemand,
        isError: isErrorDemand,
    } = useChartData({
        config: { chartType: demandChartType, resolution: 1, marketId },
        maxDatapoints: SLIDER_RANGE,
    });
    const { chartData: clearingData } = useChartData({
        config: { chartType: "market-clearing", resolution: 1, marketId },
        maxDatapoints: SLIDER_RANGE,
    });

    const isLoading = isLoadingSupply || isLoadingDemand;
    const isError = isErrorSupply || isErrorDemand;

    const chartRef = useRef<HTMLDivElement>(null);
    const instanceRef = useRef<echarts.ECharts | null>(null);

    const { sourceNodes, sinkNodes, marketQuantity, marketPrice, hasData } =
        useMemo(() => {
            const supplyPoint = supplyData.find(
                (dp) => dp.tick === selectedTick,
            );
            const demandPoint = demandData.find(
                (dp) => dp.tick === selectedTick,
            );
            const clearingPoint = clearingData.find(
                (dp) => dp.tick === selectedTick,
            );

            const marketQuantity = clearingPoint?.quantity ?? 0;
            const marketPrice = clearingPoint?.price ?? 0;

            if (!supplyPoint || !demandPoint) {
                return {
                    sourceNodes: [] as SideNode[],
                    sinkNodes: [] as SideNode[],
                    marketQuantity,
                    marketPrice,
                    hasData: false,
                };
            }

            const labelName = (key: string): string => {
                if (colorMode === "player") {
                    return (
                        playerMap?.[parseInt(key)]?.username ?? `Player ${key}`
                    );
                }
                return getAssetLongName(key);
            };
            const nodeColor = (key: string): string => {
                if (colorMode === "player") {
                    return resolveColor(getHashBasedChartColor(key));
                }
                return resolveColor(getColor(key));
            };

            const toSide = (
                point: Record<string, unknown>,
                sideTag: "src" | "sink",
            ): SideNode[] =>
                Object.entries(point)
                    .filter(
                        ([k, v]) =>
                            k !== "tick" && typeof v === "number" && v > 0,
                    )
                    .map(([key, v]) => ({
                        id: `${sideTag}:${key}`,
                        displayName: labelName(key),
                        value: v as number,
                        color: nodeColor(key),
                    }))
                    .sort((a, b) => b.value - a.value);

            const sourceNodes = toSide(supplyPoint, "src");
            const sinkNodes = toSide(demandPoint, "sink");

            return {
                sourceNodes,
                sinkNodes,
                marketQuantity,
                marketPrice,
                hasData: sourceNodes.length > 0 || sinkNodes.length > 0,
            };
        }, [
            supplyData,
            demandData,
            clearingData,
            selectedTick,
            colorMode,
            playerMap,
            getColor,
        ]);

    const totalCleared = useMemo(() => {
        if (marketQuantity > 0) return marketQuantity;
        return Math.max(
            sourceNodes.reduce((s, n) => s + n.value, 0),
            sinkNodes.reduce((s, n) => s + n.value, 0),
        );
    }, [marketQuantity, sourceNodes, sinkNodes]);

    const displayNames = useMemo(() => {
        const m = new Map<string, string>();
        for (const n of sourceNodes) m.set(n.id, n.displayName);
        for (const n of sinkNodes) m.set(n.id, n.displayName);
        m.set(
            MARKET_NODE_ID,
            `Market — ${formatPower(marketQuantity)} @ ${formatMoney(marketPrice)}/MWh`,
        );
        return m;
    }, [sourceNodes, sinkNodes, marketQuantity, marketPrice]);

    const option = useMemo<ECOption>(() => {
        const foreground = resolveCSSVar("--foreground");
        const muted = resolveCSSVar("--muted-foreground");
        const marketLabel = displayNames.get(MARKET_NODE_ID) ?? "Market";

        const labelFormatterFor = (displayName: string) => () => displayName;

        const data: SankeySeriesOption["data"] = [
            ...sourceNodes.map((n) => ({
                name: n.id,
                value: n.value,
                itemStyle: { color: n.color },
                label: {
                    show:
                        totalCleared > 0 &&
                        n.value / totalCleared >= LABEL_MIN_SHARE,
                    formatter: labelFormatterFor(n.displayName),
                    color: foreground,
                    position: "right" as const,
                },
            })),
            {
                name: MARKET_NODE_ID,
                itemStyle: { color: muted },
                label: {
                    show: true,
                    formatter: labelFormatterFor(marketLabel),
                    color: foreground,
                    fontWeight: "bold",
                    // Place the Market node's label above so it doesn't crowd
                    // the inflow/outflow links, which are densest right at the
                    // node's vertical centre.
                    position: "top" as const,
                },
            },
            ...sinkNodes.map((n) => ({
                name: n.id,
                value: n.value,
                itemStyle: { color: n.color },
                label: {
                    show:
                        totalCleared > 0 &&
                        n.value / totalCleared >= LABEL_MIN_SHARE,
                    formatter: labelFormatterFor(n.displayName),
                    color: foreground,
                    // Sink nodes sit on the chart's right edge; default label
                    // position would push text off-canvas, so place labels to
                    // the left of the node (i.e. inside the chart).
                    position: "left" as const,
                },
            })),
        ];

        const links: SankeySeriesOption["links"] = [
            ...sourceNodes.map((n) => ({
                source: n.id,
                target: MARKET_NODE_ID,
                value: n.value,
            })),
            ...sinkNodes.map((n) => ({
                source: MARKET_NODE_ID,
                target: n.id,
                value: n.value,
            })),
        ];

        return {
            animation: false,
            tooltip: {
                trigger: "item",
                triggerOn: "mousemove",
                formatter: (raw: unknown) => {
                    const params = raw as {
                        dataType?: string;
                        data?: unknown;
                        value?: number;
                        name?: string;
                    };
                    if (params.dataType === "edge") {
                        const e = params.data as {
                            source: string;
                            target: string;
                            value: number;
                        };
                        const from = displayNames.get(e.source) ?? e.source;
                        const to = displayNames.get(e.target) ?? e.target;
                        const share =
                            totalCleared > 0
                                ? (e.value / totalCleared) * 100
                                : 0;
                        return `${from} → ${to}<br/>${formatPower(e.value)} (${share.toFixed(1)}%)`;
                    }
                    if (params.dataType === "node") {
                        const n = params.data as { name: string };
                        const display = displayNames.get(n.name) ?? n.name;
                        if (n.name === MARKET_NODE_ID) {
                            return display;
                        }
                        const value =
                            typeof params.value === "number" ? params.value : 0;
                        const share =
                            totalCleared > 0 ? (value / totalCleared) * 100 : 0;
                        return `${display}<br/>${formatPower(value)} (${share.toFixed(1)}%)`;
                    }
                    return "";
                },
            },
            series: [
                {
                    type: "sankey",
                    nodeAlign: "justify",
                    // Disable node dragging: it's a neat default but adds no
                    // value for a snapshot view (state resets on slider change)
                    // and is awkward on touch devices.
                    draggable: false,
                    data,
                    links,
                    emphasis: { focus: "adjacency" },
                    // Soften ECharts' default fade-on-hover: the default blur
                    // opacity (~0.1) makes non-adjacent items nearly invisible,
                    // which reads as flicker. Keep non-adjacent items visibly
                    // de-emphasized but legible.
                    blur: {
                        itemStyle: { opacity: 0.6 },
                        lineStyle: { opacity: 0.3 },
                        label: { color: foreground },
                    },
                    lineStyle: {
                        color: "gradient",
                        curveness: 0.5,
                        opacity: 0.5,
                    },
                    label: { color: foreground },
                    nodeWidth: 12,
                    nodeGap: 8,
                    left: 10,
                    right: 10,
                    top: 20,
                    bottom: 20,
                },
            ],
        };
    }, [sourceNodes, sinkNodes, totalCleared, displayNames]);

    useEffect(() => {
        if (!chartRef.current) return;
        const chart = echarts.init(chartRef.current, undefined, {
            renderer: "canvas",
        });
        instanceRef.current = chart;
        return () => {
            chart.dispose();
            instanceRef.current = null;
        };
    }, []);

    useEffect(() => {
        instanceRef.current?.setOption(option, { notMerge: true });
    }, [option]);

    useEffect(() => {
        const el = chartRef.current;
        if (!el) return;
        const observer = new ResizeObserver(() =>
            instanceRef.current?.resize(),
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const showEmpty = !isLoading && !isError && !hasData;

    return (
        <div
            className="relative min-w-0 overflow-hidden"
            style={{ height: `${height}px` }}
        >
            <div ref={chartRef} className="w-full h-full" />

            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                    <span className="text-muted-foreground">
                        Loading market data…
                    </span>
                </div>
            )}

            {isError && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-destructive">
                        Failed to load market data
                    </span>
                </div>
            )}

            {showEmpty && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-muted-foreground">
                        No flows for this tick
                    </span>
                </div>
            )}
        </div>
    );
}

export const MarketFlowSankey = memo(MarketFlowSankeyInner);
