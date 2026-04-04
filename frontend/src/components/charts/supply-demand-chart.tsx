/** Supply and demand curve chart for electricity markets */

import { CustomChart, LineChart as ELineChart } from "echarts/charts";
import type { CustomSeriesOption, LineSeriesOption } from "echarts/charts";
import {
    GridComponent,
    MarkLineComponent,
    MarkPointComponent,
    TooltipComponent,
} from "echarts/components";
import type {
    GridComponentOption,
    MarkLineComponentOption,
    MarkPointComponentOption,
    TooltipComponentOption,
} from "echarts/components";
import type { ComposeOption } from "echarts/core";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { RefreshCw } from "lucide-react";
import {
    memo,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";

import { useAssetColorGetter } from "@/hooks/use-asset-color-getter";
import { useMarketData } from "@/hooks/use-charts";
import { getHashBasedChartColor } from "@/lib/charts/color-utils";
import {
    createSteppedCurve,
    interpolateAtX,
} from "@/lib/charts/ui-utils";
import { formatMoney, formatPower } from "@/lib/format-utils";

echarts.use([
    ELineChart,
    CustomChart,
    GridComponent,
    TooltipComponent,
    MarkLineComponent,
    MarkPointComponent,
    CanvasRenderer,
]);

type ECOption = ComposeOption<
    | LineSeriesOption
    | CustomSeriesOption
    | GridComponentOption
    | TooltipComponentOption
    | MarkLineComponentOption
    | MarkPointComponentOption
>;

export type BreakdownType = "supply" | "demand";
export type BreakdownMode = "player" | "type";

// ── CSS variable resolver ─────────────────────────────────────────────────────

function resolveCSSVar(varName: string): string {
    if (typeof document === "undefined") return "#888";
    const root = document.documentElement;
    let val = getComputedStyle(root).getPropertyValue(varName).trim();
    const m = val.match(/^var\(([^,)]+)/);
    if (m?.[1]) val = getComputedStyle(root).getPropertyValue(m[1]).trim();
    return val || "#888";
}

function resolveColor(color: string): string {
    if (!color.startsWith("var(")) return color;
    const varName = color.match(/^var\(([^,)]+)/)?.[1];
    if (!varName) return color;
    return resolveCSSVar(varName);
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

interface SDTooltipProps {
    quantity: number;
    supplyPrice: number | null;
    demandPrice: number | null;
}

const SDTooltip = memo(function SDTooltip({
    quantity,
    supplyPrice,
    demandPrice,
}: SDTooltipProps): ReactNode {
    return (
        <div className="bg-card border border-border p-2 rounded shadow-md pointer-events-none text-sm">
            <p className="font-semibold">Quantity: {formatPower(quantity)}</p>
            {supplyPrice !== null && (
                <p>Supply: ${supplyPrice.toFixed(6)}/MWh</p>
            )}
            {demandPrice !== null && (
                <p>Demand: ${demandPrice.toFixed(6)}/MWh</p>
            )}
        </div>
    );
});

// ── SupplyDemandChart ─────────────────────────────────────────────────────────

interface SupplyDemandChartProps {
    marketId: number;
    tick: number;
    height?: number;
    showOrderBlocks?: boolean;
    breakdownEnabled?: boolean;
    breakdownMode?: BreakdownMode;
    breakdownType?: BreakdownType;
}

interface OrderBlockItem {
    id: string;
    x1: number;
    x2: number;
    y1: number;
    y2: number;
    playerId: number;
    facility: string;
    capacity: number;
}

function SupplyDemandChartInner({
    marketId,
    tick,
    height = 500,
    showOrderBlocks = true,
    breakdownEnabled = false,
    breakdownMode = "player",
    breakdownType = "supply",
}: SupplyDemandChartProps) {
    const getColor = useAssetColorGetter();
    const {
        data: marketData,
        isLoading,
        isError,
    } = useMarketData({ marketId, tick });

    const chartRef = useRef<HTMLDivElement>(null);
    const instanceRef = useRef<echarts.ECharts | null>(null);

    const [tooltipState, setTooltipState] = useState<{
        clientX: number;
        clientY: number;
        quantity: number;
        supplyPrice: number | null;
        demandPrice: number | null;
    } | null>(null);

    // Keep live data in a ref for use inside ZRender event handler
    const liveRef = useRef({
        supplyCurve: [] as { quantity: number; price: number }[],
        demandCurve: [] as { quantity: number; price: number }[],
    });

    // ── Data transformation ───────────────────────────────────────────────────

    const getBlockColor = useCallback(
        (
            blockType: "supply" | "demand",
            facility?: string,
            playerId?: number,
        ): string => {
            if (!breakdownEnabled) {
                return blockType === "supply"
                    ? resolveColor("var(--chart-1)")
                    : resolveColor("var(--chart-2)");
            }
            if (breakdownMode === "type") {
                return facility ? resolveColor(getColor(facility)) : resolveColor("var(--chart-1)");
            }
            const key = playerId?.toString() ?? facility ?? "unknown";
            return resolveColor(getHashBasedChartColor(key));
        },
        [breakdownEnabled, breakdownMode, getColor],
    );

    const fillOpacity = !breakdownEnabled ? 0.2 : 0.7;

    const {
        supplyCurve,
        demandCurve,
        supplyBlocks,
        demandBlocks,
        priceDomain,
        quantityDomain,
    } = useMemo(() => {
        if (!marketData) {
            return {
                supplyCurve: [],
                demandCurve: [],
                supplyBlocks: [] as OrderBlockItem[],
                demandBlocks: [] as OrderBlockItem[],
                priceDomain: [0, 1] as [number, number],
                quantityDomain: [0, 1] as [number, number],
            };
        }

        const highestDemandPrice =
            marketData.demands.price.length > 0
                ? Math.max(...marketData.demands.price)
                : undefined;
        const lowestSupplyPrice =
            marketData.capacities.price.length > 0
                ? Math.min(...marketData.capacities.price)
                : undefined;

        const supply = createSteppedCurve(
            marketData.capacities.price,
            marketData.capacities.cumul_capacities,
            highestDemandPrice,
        );
        const demand = createSteppedCurve(
            marketData.demands.price,
            marketData.demands.cumul_capacities,
            lowestSupplyPrice,
        );

        const supplyBlocks: OrderBlockItem[] =
            marketData.capacities.price.map((price, i) => ({
                id: `supply-${marketData.capacities.player_id[i]}-${i}`,
                x1:
                    i === 0
                        ? 0
                        : (marketData.capacities.cumul_capacities[i - 1] ?? 0),
                x2: marketData.capacities.cumul_capacities[i] ?? 0,
                y1: 0,
                y2: price,
                playerId: marketData.capacities.player_id[i] ?? 0,
                facility: marketData.capacities.facility[i] ?? "",
                capacity: marketData.capacities.capacity[i] ?? 0,
            }));

        const demandBlocks: OrderBlockItem[] = marketData.demands.price.map(
            (price, i) => ({
                id: `demand-${marketData.demands.player_id[i]}-${i}`,
                x1:
                    i === 0
                        ? 0
                        : (marketData.demands.cumul_capacities[i - 1] ?? 0),
                x2: marketData.demands.cumul_capacities[i] ?? 0,
                y1: 0,
                y2: price,
                playerId: marketData.demands.player_id[i] ?? 0,
                facility: marketData.demands.facility[i] ?? "",
                capacity: marketData.demands.capacity[i] ?? 0,
            }),
        );

        const allPrices = [
            ...marketData.capacities.price,
            ...marketData.demands.price,
        ];
        const minPrice = allPrices.length > 0 ? Math.min(...allPrices) : 0;
        const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) : 1;

        const maxSupplyQuantity =
            marketData.capacities.cumul_capacities.length > 0
                ? (marketData.capacities.cumul_capacities.at(-1) ?? 0)
                : 0;
        const maxDemandQuantity =
            marketData.demands.cumul_capacities.length > 0
                ? (marketData.demands.cumul_capacities.at(-1) ?? 0)
                : 0;
        const maxQuantity = Math.max(maxSupplyQuantity, maxDemandQuantity, 1);

        return {
            supplyCurve: supply,
            demandCurve: demand,
            supplyBlocks,
            demandBlocks,
            priceDomain: [minPrice, maxPrice] as [number, number],
            quantityDomain: [0, maxQuantity] as [number, number],
        };
    }, [marketData]);

    // Keep live curves in ref for event handlers
    useEffect(() => {
        liveRef.current = { supplyCurve, demandCurve };
    }, [supplyCurve, demandCurve]);

    // ── ECharts option ────────────────────────────────────────────────────────

    const option = useMemo((): ECOption => {
        const chart1Color = resolveColor("var(--chart-1)");
        const chart2Color = resolveColor("var(--chart-2)");
        const primaryColor = resolveCSSVar("--primary");
        const mutedColor = resolveCSSVar("--muted-foreground");

        // Convert curve points to [quantity, price] pairs
        const supplySeriesData = supplyCurve.map(
            (p) => [p.quantity, p.price] as [number, number],
        );
        const demandSeriesData = demandCurve.map(
            (p) => [p.quantity, p.price] as [number, number],
        );

        // Build order block custom series data
        const activeBlocks =
            showOrderBlocks && breakdownEnabled
                ? breakdownType === "supply"
                    ? supplyBlocks
                    : demandBlocks
                : showOrderBlocks && !breakdownEnabled
                  ? [...supplyBlocks, ...demandBlocks]
                  : [];

        const blockSeriesData = activeBlocks.map((block) => {
            const blockKind = block.id.startsWith("supply")
                ? "supply"
                : "demand";
            const color = getBlockColor(blockKind, block.facility, block.playerId);
            return {
                value: [block.x1, block.x2, block.y1, block.y2],
                itemStyle: { color, opacity: fillOpacity },
            };
        });

        const series: ECOption["series"] = [
            // Order blocks as custom series
            {
                type: "custom" as const,
                silent: true,
                renderItem(_params, api) {
                    const x1 = api.value(0) as number;
                    const x2 = api.value(1) as number;
                    const y1 = api.value(2) as number;
                    const y2 = api.value(3) as number;
                    const topLeft = api.coord([x1, y2]);
                    const bottomRight = api.coord([x2, y1]);
                    return {
                        type: "rect" as const,
                        shape: {
                            x: topLeft[0] ?? 0,
                            y: topLeft[1] ?? 0,
                            width: (bottomRight[0] ?? 0) - (topLeft[0] ?? 0),
                            height: (bottomRight[1] ?? 0) - (topLeft[1] ?? 0),
                        },
                        style: api.style(),
                    };
                },
                data: blockSeriesData,
                encode: { x: [0, 1], y: [2, 3] },
                z: 1,
            },
            // Supply curve
            {
                name: "supply",
                type: "line" as const,
                symbol: "none",
                step: "end",
                data: supplySeriesData,
                lineStyle: { color: chart1Color, width: 2 },
                itemStyle: { color: chart1Color },
                animation: false,
                z: 2,
                markLine: {
                    silent: true,
                    symbol: ["none", "none"],
                    data: [
                        {
                            xAxis: marketData?.market_quantity ?? 0,
                            name: `Clearing Volume: ${formatPower(marketData?.market_quantity ?? 0)}`,
                        },
                        {
                            yAxis: marketData?.market_price ?? 0,
                            name: `Clearing Price: $${formatMoney(marketData?.market_price ?? 0)}/MWh`,
                        },
                    ],
                    lineStyle: {
                        color: primaryColor,
                        type: "dashed",
                        width: 2,
                    },
                    label: {
                        formatter: "{b}",
                        color: mutedColor,
                        fontSize: 12,
                    },
                },
                markPoint: {
                    data: [
                        {
                            name: "clearing",
                            coord: [
                                marketData?.market_quantity ?? 0,
                                marketData?.market_price ?? 0,
                            ],
                            symbol: "circle",
                            symbolSize: 12,
                            itemStyle: { color: primaryColor },
                            label: { show: false },
                        },
                    ],
                    animation: false,
                },
            },
            // Demand curve
            {
                name: "demand",
                type: "line" as const,
                symbol: "none",
                step: "end",
                data: demandSeriesData,
                lineStyle: { color: chart2Color, width: 2 },
                itemStyle: { color: chart2Color },
                animation: false,
                z: 2,
            },
        ];

        return {
            animation: false,
            grid: { left: 90, right: 20, top: 15, bottom: 55 },
            xAxis: {
                type: "value",
                min: quantityDomain[0],
                max: quantityDomain[1],
                name: "Quantity",
                nameLocation: "middle",
                nameGap: 30,
                axisLabel: {
                    formatter: (value: number) => formatPower(value),
                    fontSize: 11,
                },
                splitLine: { lineStyle: { color: "rgba(128,128,128,0.15)" } },
            },
            yAxis: {
                type: "value",
                min: priceDomain[0],
                max: priceDomain[1],
                name: "Price ($/MWh)",
                nameLocation: "middle",
                nameGap: 70,
                axisLabel: {
                    formatter: (value: number) => `$${formatMoney(value)}`,
                    fontSize: 11,
                },
                splitLine: { lineStyle: { color: "rgba(128,128,128,0.15)" } },
            },
            tooltip: { trigger: "none", showContent: false },
            series,
        };
    }, [
        supplyCurve,
        demandCurve,
        supplyBlocks,
        demandBlocks,
        showOrderBlocks,
        breakdownEnabled,
        breakdownType,
        getBlockColor,
        fillOpacity,
        priceDomain,
        quantityDomain,
        marketData,
    ]);

    // ── Chart lifecycle ───────────────────────────────────────────────────────

    useEffect(() => {
        if (!chartRef.current) return;
        const chart = echarts.init(chartRef.current, undefined, {
            renderer: "canvas",
        });
        instanceRef.current = chart;

        const zr = chart.getZr();

        zr.on(
            "mousemove",
            (e: { offsetX: number; offsetY: number; event: Event }) => {
                const { offsetX, offsetY } = e;
                const nativeEvent = e.event as MouseEvent;

                if (!chart.containPixel("grid", [offsetX, offsetY])) {
                    setTooltipState(null);
                    return;
                }

                const quantity = chart.convertFromPixel(
                    { xAxisIndex: 0 },
                    offsetX,
                ) as number;

                const { supplyCurve: sc, demandCurve: dc } = liveRef.current;
                const supplyPrice = interpolateAtX(sc, quantity);
                const demandPrice = interpolateAtX(dc, quantity);

                if (supplyPrice === null && demandPrice === null) {
                    setTooltipState(null);
                    return;
                }

                setTooltipState({
                    clientX: nativeEvent.clientX,
                    clientY: nativeEvent.clientY,
                    quantity,
                    supplyPrice,
                    demandPrice,
                });
            },
        );

        zr.on("mouseout", () => setTooltipState(null));

        return () => {
            chart.getZr().off("mousemove");
            chart.getZr().off("mouseout");
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

    // ── Render ────────────────────────────────────────────────────────────────

    if (isLoading) {
        return (
            <div
                className="w-full flex items-center justify-center py-12"
                style={{ height: `${height}px` }}
            >
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                Loading market data...
            </div>
        );
    }

    if (isError || !marketData) {
        return (
            <div className="text-center py-12 text-destructive">
                Failed to load market data
            </div>
        );
    }

    return (
        <div className="relative" style={{ height: `${height}px` }}>
            <div ref={chartRef} className="w-full h-full" />
            {tooltipState && (
                <div
                    style={{
                        position: "fixed",
                        left: tooltipState.clientX + 12,
                        top: tooltipState.clientY - 100,
                        pointerEvents: "none",
                        zIndex: 9999,
                    }}
                >
                    <SDTooltip
                        quantity={tooltipState.quantity}
                        supplyPrice={tooltipState.supplyPrice}
                        demandPrice={tooltipState.demandPrice}
                    />
                </div>
            )}
        </div>
    );
}

export const SupplyDemandChart = memo(SupplyDemandChartInner);
