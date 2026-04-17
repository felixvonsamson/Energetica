/** Market depth / order book depth chart for electricity markets */

import { LineChart as ELineChart } from "echarts/charts";
import type { LineSeriesOption } from "echarts/charts";
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
import { RefreshCw } from "lucide-react";
import {
    memo,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";

import { Money } from "@/components/ui/money";
import { useMarketData } from "@/hooks/use-charts";
import { resolveColor, resolveCSSVar } from "@/lib/charts/color-utils";
import { formatMoney, formatPower } from "@/lib/format-utils";

echarts.use([
    ELineChart,
    GridComponent,
    TooltipComponent,
    MarkLineComponent,
    CanvasRenderer,
]);

type ECOption = ComposeOption<
    | LineSeriesOption
    | GridComponentOption
    | TooltipComponentOption
    | MarkLineComponentOption
>;

// ── Tooltip ───────────────────────────────────────────────────────────────────

interface DepthTooltipProps {
    price: number;
    supplyVolume: number | null;
    demandVolume: number | null;
}

const DepthTooltip = memo(function DepthTooltip({
    price,
    supplyVolume,
    demandVolume,
}: DepthTooltipProps): ReactNode {
    return (
        <div className="bg-card border border-border p-2 rounded shadow-md pointer-events-none text-sm">
            <p className="font-semibold">
                <Money amount={price} />
                /MWh
            </p>
            {supplyVolume !== null && (
                <p>Supply: {formatPower(supplyVolume)}</p>
            )}
            {demandVolume !== null && (
                <p>Demand: {formatPower(demandVolume)}</p>
            )}
        </div>
    );
});

// ── MarketDepthChart ──────────────────────────────────────────────────────────

interface MarketDepthChartProps {
    marketId: number;
    tick: number;
    height?: number;
}

function MarketDepthChartInner({
    marketId,
    tick,
    height = 500,
}: MarketDepthChartProps) {
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
        price: number;
        supplyVolume: number | null;
        demandVolume: number | null;
    } | null>(null);

    // ── Data transformation ───────────────────────────────────────────────────

    const {
        supplyData,
        demandData,
        priceDomain,
        volumeDomain,
        clearingPrice,
    } = useMemo(() => {
        if (!marketData) {
            return {
                supplyData: [] as [number, number][],
                demandData: [] as [number, number][],
                priceDomain: [0, 1] as [number, number],
                volumeDomain: [0, 1] as [number, number],
                clearingPrice: 0,
            };
        }

        const clearingVolume = marketData.market_quantity;
        const clearingPrice = marketData.market_price;
        const bids = marketData.demands;
        const asks = marketData.capacities;
        const asksCount = asks.price.length;
        const bidsCount = bids.price.length;

        const minBidPrice = Math.min(
            bids.price[bidsCount - 1] ?? clearingPrice,
            clearingPrice,
        );
        const maxAskPrice = Math.max(
            asks.price[asksCount - 1] ?? clearingPrice,
            clearingPrice,
        );

        const priceRange = maxAskPrice - minBidPrice;
        const margin = priceRange > 0 ? priceRange * 0.1 : 0.01;
        const minPrice = minBidPrice - margin;
        const maxPrice = maxAskPrice + margin;

        // Build supply series: ascending price, cumulative volume above clearing
        const supplyData: [number, number][] = [];
        for (let i = 0; i < asksCount; i++) {
            const askVol = asks.cumul_capacities[i]! - clearingVolume;
            if (askVol > 0) {
                supplyData.push([asks.price[i]!, askVol]);
                if (i === asksCount - 1) {
                    supplyData.push([maxPrice, askVol]);
                }
            }
        }

        // Build demand series: bids in ascending price order (reversed from original)
        // Original bids are descending in price, so we reverse to get ascending
        const demandData: [number, number][] = [];
        let firstDemand = true;
        for (let i = bidsCount - 1; i >= 0; i--) {
            const bidVol = bids.cumul_capacities[i]! - clearingVolume;
            if (bidVol > 0) {
                if (firstDemand) {
                    demandData.push([minPrice, bidVol]);
                    firstDemand = false;
                }
                demandData.push([bids.price[i]!, bidVol]);
            }
        }

        const maxSupplyVolume =
            asksCount > 0 ? asks.cumul_capacities[asksCount - 1]! : 0;
        const maxDemandVolume =
            bidsCount > 0 ? bids.cumul_capacities[bidsCount - 1]! : 0;
        const maxVolume =
            Math.max(maxSupplyVolume, maxDemandVolume) - clearingVolume;

        const priceDomain: [number, number] = [minPrice, maxPrice];
        const volumeDomain: [number, number] = [0, maxVolume];
        return {
            supplyData,
            demandData,
            priceDomain,
            volumeDomain,
            clearingPrice,
        };
    }, [marketData]);

    // ── ECharts option ────────────────────────────────────────────────────────

    const option = useMemo((): ECOption => {
        const chart1Color = resolveColor("var(--chart-1)");
        const chart2Color = resolveColor("var(--chart-2)");
        const primaryColor = resolveCSSVar("--primary");
        const mutedColor = resolveCSSVar("--muted-foreground");

        const demandSeries: LineSeriesOption = {
            name: "demand",
            type: "line",
            step: "start",
            symbol: "none",
            data: demandData,
            areaStyle: { opacity: 0.3, color: chart2Color },
            lineStyle: { color: chart2Color, width: 2 },
            itemStyle: { color: chart2Color },
            animation: false,
        };

        const supplySeries: LineSeriesOption = {
            name: "supply",
            type: "line",
            step: "end",
            symbol: "none",
            data: supplyData,
            areaStyle: { opacity: 0.3, color: chart1Color },
            lineStyle: { color: chart1Color, width: 2 },
            itemStyle: { color: chart1Color },
            animation: false,
            markLine: {
                silent: true,
                symbol: ["none", "none"],
                data: [{ xAxis: clearingPrice, name: `Clearing: $${formatMoney(clearingPrice)}/MWh` }],
                lineStyle: { color: primaryColor, type: "dashed", width: 2 },
                label: {
                    formatter: "{b}",
                    position: "insideStartTop",
                    color: mutedColor,
                    fontSize: 12,
                },
            },
        };

        return {
            animation: false,
            grid: { left: 80, right: 20, top: 15, bottom: 55 },
            xAxis: {
                type: "value",
                min: priceDomain[0],
                max: priceDomain[1],
                name: "Price ($/MWh)",
                nameLocation: "middle",
                nameGap: 30,
                axisLabel: {
                    formatter: (value: number) => `$${formatMoney(value)}`,
                    fontSize: 11,
                },
                splitLine: { lineStyle: { color: "rgba(128,128,128,0.15)" } },
            },
            yAxis: {
                type: "value",
                min: volumeDomain[0],
                max: volumeDomain[1],
                name: "Cumulative Volume",
                nameLocation: "middle",
                nameGap: 60,
                axisLabel: {
                    formatter: (value: number) => formatPower(value),
                    fontSize: 11,
                },
                splitLine: { lineStyle: { color: "rgba(128,128,128,0.15)" } },
            },
            tooltip: { trigger: "none", showContent: false },
            series: [demandSeries, supplySeries],
        };
    }, [supplyData, demandData, priceDomain, volumeDomain, clearingPrice]);

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

                // Convert pixel to data coordinates
                const price = chart.convertFromPixel(
                    { xAxisIndex: 0 },
                    offsetX,
                ) as number;

                // Interpolate volumes at this price from the raw chart data
                // We use the chart's series data directly
                const opt = chart.getOption() as ECOption;
                const seriesArr = Array.isArray(opt.series) ? opt.series : [];

                let supplyVolume: number | null = null;
                let demandVolume: number | null = null;

                // supply series is step='end', so we want highest price <= cursor
                const supplyRaw = (
                    seriesArr[1] as LineSeriesOption | undefined
                )?.data as [number, number][] | undefined;
                if (supplyRaw) {
                    for (let i = supplyRaw.length - 1; i >= 0; i--) {
                        if (supplyRaw[i]![0] <= price) {
                            supplyVolume = supplyRaw[i]![1];
                            break;
                        }
                    }
                }

                // demand series is step='start', so we want highest price <= cursor
                const demandRaw = (
                    seriesArr[0] as LineSeriesOption | undefined
                )?.data as [number, number][] | undefined;
                if (demandRaw) {
                    for (let i = demandRaw.length - 1; i >= 0; i--) {
                        if (demandRaw[i]![0] <= price) {
                            demandVolume = demandRaw[i]![1];
                            break;
                        }
                    }
                }

                if (supplyVolume === null && demandVolume === null) {
                    setTooltipState(null);
                    return;
                }

                setTooltipState({
                    clientX: nativeEvent.clientX,
                    clientY: nativeEvent.clientY,
                    price,
                    supplyVolume,
                    demandVolume,
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
        <div className="relative min-w-0 overflow-hidden" style={{ height: `${height}px` }}>
            <div ref={chartRef} className="w-full h-full" />
            {tooltipState && (
                <div
                    style={{
                        position: "fixed",
                        left: tooltipState.clientX + 12,
                        top: tooltipState.clientY - 50,
                        pointerEvents: "none",
                        zIndex: 9999,
                    }}
                >
                    <DepthTooltip
                        price={tooltipState.price}
                        supplyVolume={tooltipState.supplyVolume}
                        demandVolume={tooltipState.demandVolume}
                    />
                </div>
            )}
        </div>
    );
}

export const MarketDepthChart = memo(MarketDepthChartInner);
