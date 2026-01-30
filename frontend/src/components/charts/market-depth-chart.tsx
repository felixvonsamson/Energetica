/** Market depth / order book depth chart for electricity markets */

import { scaleLinear } from "d3-scale";
import { RefreshCw } from "lucide-react";
import {
    useMemo,
    useState,
    useRef,
    useCallback,
    memo,
    type ReactNode,
    type MouseEvent,
} from "react";
import {
    Area,
    AreaChart,
    CartesianGrid,
    ReferenceLine,
    ResponsiveContainer,
    XAxis,
    YAxis,
} from "recharts";

import { Money } from "@/components/ui/money";
import { useMarketData } from "@/hooks/useCharts";
import { useRechartsChartArea } from "@/hooks/useRechartsChartArea";
import { generateNiceTicks } from "@/lib/charts/ui-utils";
import { formatMoney, formatPower } from "@/lib/format-utils";

interface MarketDepthChartProps {
    marketId: number;
    tick: number;
    height?: number;
}

interface CustomTooltipProps {
    price: number;
    supplyVolume: number | null;
    demandVolume: number | null;
}

// Memoized tooltip to prevent re-rendering when position changes
const CustomTooltip = memo(function CustomTooltip({
    price,
    supplyVolume,
    demandVolume,
}: CustomTooltipProps): ReactNode {
    return (
        <div className="bg-card border border-border p-2 rounded shadow-md pointer-events-none">
            <p className="text-sm font-semibold">
                <Money amount={price} />
                /Wh
            </p>
            {supplyVolume !== null && (
                <p className="text-sm">Supply: {formatPower(supplyVolume)}</p>
            )}
            {demandVolume !== null && (
                <p className="text-sm">Demand: {formatPower(demandVolume)}</p>
            )}
        </div>
    );
});

/**
 * Market depth chart showing cumulative order book depth. Displays volume
 * (y-axis) vs price (x-axis) for both supply (asks) and demand (bids), with
 * market clearing price.
 */
function MarketDepthChartInner({
    marketId,
    tick,
    height = 500,
}: MarketDepthChartProps) {
    const {
        data: marketData,
        isLoading,
        isError,
    } = useMarketData({
        marketId,
        tick,
    });

    // State for tooltip content
    const [tooltipContent, setTooltipContent] = useState<{
        price: number;
        supplyVolume: number | null;
        demandVolume: number | null;
    } | null>(null);

    // Ref to the container for coordinate calculations
    const containerRef = useRef<HTMLDivElement>(null);

    // Ref to tooltip div for direct style manipulation
    const tooltipRef = useRef<HTMLDivElement>(null);

    // Throttle mouse move updates
    const lastUpdateTime = useRef<number>(0);
    const THROTTLE_MS = 16; // ~60fps

    // Transform data into market depth curves
    const {
        chartData,
        priceDomain,
        volumeDomain,
        priceTicks,
        volumeTicks,
        clearingPrice,
    } = useMemo(() => {
        if (!marketData) {
            return {
                chartData: [],
                priceDomain: [0, 1] as [number, number],
                volumeDomain: [0, 1] as [number, number],
                priceTicks: [0, 1],
                volumeTicks: [0, 1],
                clearingPrice: 0,
            };
        }

        const clearingVolume = marketData.market_quantity;
        const clearingPrice = marketData.market_price;

        /**
         * MarketData.capacities and marketData.demands are objects containing
         * lists of numbers. Capacities are asks and demands are bids. The keys
         * for these two objects are: player_id, capacity, cumul_capacity,
         * price, and facility (exceptionally a string.) Note these lists are
         * uniform and should be thought of as lists of objects. For both,
         * objects are given in order such that cumul_capacity is increasing.
         * That is, asks are increasing in price and bids are decreasing in
         * price.
         */
        const bids = marketData.demands;
        const asks = marketData.capacities;
        const asksCount = asks.price.length; // can use any key, not just price
        const bidsCount = bids.price.length;

        // Calculate price bounds from original market data
        const minBidPrice = Math.min(
            bids.price[bidsCount - 1] ?? clearingPrice,
            clearingPrice,
        );
        const maxAskPrice = Math.max(
            asks.price[asksCount - 1] ?? clearingPrice,
            clearingPrice,
        );

        // Add 10% margin on each side for visual clarity
        const priceRange = maxAskPrice - minBidPrice;
        const margin = priceRange > 0 ? priceRange * 0.1 : 0.01;
        const minPrice = minBidPrice - margin;
        const maxPrice = maxAskPrice + margin;

        /**
         * After filtering, the asks and bids now need to be in order of
         * increasing price. This then amounts to ordering each order as they
         * will appear on screen from left to right. In this regard, asks
         * already appear in the correct order, with some asks at the start
         * having been omitted. Bids appear in the opposite order. In their
         * original order, some of bids are omitted. When viewed after reversal,
         * items at the end are omitted.
         */

        // Merge sorted price arrays and build depth data in one pass
        const depthData: Array<{
            price: number;
            supplyVolume: number | null;
            demandVolume: number | null;
        }> = [];

        let askIdx = 0;
        let bidIdx = bidsCount - 1; // Reverse iteration (demandDepth sorted descending)

        // Three-way merge: supply (ascending), demand (descending), special prices
        while (askIdx < asksCount || bidIdx >= 0) {
            // Get next candidate price from each source
            const askPrice = asks.price[askIdx] ?? Infinity;
            const bidPrice = bids.price[bidIdx] ?? Infinity;

            if (bidIdx < 0 || (askIdx < asksCount && askPrice < bidPrice)) {
                const askVol = asks.cumul_capacities[askIdx]! - clearingVolume;
                if (askVol > 0) {
                    depthData.push({
                        price: askPrice,
                        supplyVolume: askVol,
                        demandVolume: null,
                    });
                    if (askIdx >= asksCount - 1)
                        depthData.push({
                            price: maxPrice,
                            supplyVolume: askVol,
                            demandVolume: null,
                        });
                }
                askIdx++;
            } else {
                const bidVol = bids.cumul_capacities[bidIdx]! - clearingVolume;
                if (bidVol > 0) {
                    if (depthData.length === 0)
                        depthData.push({
                            price: minPrice,
                            supplyVolume: null,
                            demandVolume: bidVol,
                        });
                    depthData.push({
                        price: bidPrice,
                        supplyVolume: null,
                        demandVolume: bidVol,
                    });
                }
                bidIdx--;
            }
        }

        // Calculate volume domain
        const maxSupplyVolume =
            asksCount > 0 ? asks.cumul_capacities[asksCount - 1]! : 0;
        const maxDemandVolume =
            bidsCount > 0 ? bids.cumul_capacities[bidsCount - 1]! : 0;
        const maxVolume =
            Math.max(maxSupplyVolume, maxDemandVolume) - clearingVolume;

        const priceDomain = [minPrice, maxPrice] as const;
        const volumeDomain = [0, maxVolume] as const;

        const priceTicks = generateNiceTicks(minPrice, maxPrice, 6);
        const volumeTicks = generateNiceTicks(0, maxVolume, 6);

        return {
            chartData: depthData,
            priceDomain,
            volumeDomain,
            priceTicks,
            volumeTicks,
            clearingPrice,
        };
    }, [marketData]);

    // Create d3 scale for coordinate conversions
    const xScale = useMemo(() => {
        return scaleLinear().domain(priceDomain).range([0, 1]);
    }, [priceDomain]);

    // Measure the actual chart plotting area from Recharts internals
    const maxPriceTick = priceTicks[priceTicks.length - 1];
    const maxVolumeTick = volumeTicks[volumeTicks.length - 1];
    const chartArea = useRechartsChartArea(containerRef, [
        maxPriceTick,
        maxVolumeTick,
    ]);

    // Mouse move handler for tooltip
    const handleMouseMove = useCallback(
        (event: MouseEvent<HTMLDivElement>) => {
            const now = performance.now();
            if (now - lastUpdateTime.current < THROTTLE_MS) {
                return;
            }
            lastUpdateTime.current = now;

            if (!containerRef.current || !chartArea || chartData.length === 0)
                return;

            const rect = containerRef.current.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;

            const chartLeft = chartArea.left;
            const chartRight = chartArea.left + chartArea.width;
            const chartTop = chartArea.top;
            const chartBottom = chartArea.top + chartArea.height;
            const chartWidth = chartArea.width;

            // Check if mouse is within chart bounds
            if (
                mouseX < chartLeft ||
                mouseX > chartRight ||
                mouseY < chartTop ||
                mouseY > chartBottom
            ) {
                setTooltipContent(null);
                return;
            }

            // Convert mouse X position to price value
            const normalizedX = (mouseX - chartLeft) / chartWidth;
            const [minP, maxP] = xScale.domain();
            const price = minP! + normalizedX * (maxP! - minP!);

            // Find closest data point and interpolate volumes
            let supplyVolume: number | null = null;
            let demandVolume: number | null = null;

            // Find supply volume at this price (highest price at or below)
            for (let i = chartData.length - 1; i >= 0; i--) {
                const point = chartData[i];
                if (
                    point &&
                    point.price <= price &&
                    point.supplyVolume !== null
                ) {
                    supplyVolume = point.supplyVolume;
                    break;
                }
            }

            // Find demand volume at this price (highest price at or below)
            // For stepAfter, we want the volume from the step we're currently on
            for (let i = chartData.length - 1; i >= 0; i--) {
                const point = chartData[i];
                if (
                    point &&
                    point.price <= price &&
                    point.demandVolume !== null
                ) {
                    demandVolume = point.demandVolume;
                    break;
                }
            }

            // Update tooltip position
            if (tooltipRef.current) {
                tooltipRef.current.style.left = `${mouseX + 10}px`;
                tooltipRef.current.style.top = `${mouseY - 50}px`;
            }

            // Update tooltip content
            setTooltipContent((prev) => {
                if (
                    !prev ||
                    prev.price !== price ||
                    prev.supplyVolume !== supplyVolume ||
                    prev.demandVolume !== demandVolume
                ) {
                    return { price, supplyVolume, demandVolume };
                }
                return prev;
            });
        },
        [chartArea, xScale, chartData],
    );

    const handleMouseLeave = useCallback(() => {
        setTooltipContent(null);
    }, []);

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
        <div
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{
                position: "relative",
                width: "100%",
                height: `${height}px`,
            }}
        >
            <ResponsiveContainer width="100%" height={height}>
                <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                        dataKey="price"
                        type="number"
                        domain={priceDomain}
                        ticks={priceTicks}
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value: number) =>
                            `$${formatMoney(value)}`
                        }
                        label={{
                            value: "Price ($/Wh)",
                            position: "insideBottom",
                            offset: -5,
                        }}
                    />
                    <YAxis
                        domain={volumeDomain}
                        ticks={volumeTicks}
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value: number) => formatPower(value)}
                        label={{
                            value: "Cumulative Volume",
                            angle: -90,
                            position: "insideLeft",
                        }}
                    />

                    {/* Demand area (bids) - shown on left side */}
                    <Area
                        type="stepBefore"
                        dataKey="demandVolume"
                        stroke="var(--chart-2)"
                        fill="var(--chart-2)"
                        fillOpacity={0.3}
                        strokeWidth={2}
                        isAnimationActive={false}
                        connectNulls={false}
                    />

                    {/* Supply area (asks) - shown on right side */}
                    <Area
                        type="stepAfter"
                        dataKey="supplyVolume"
                        stroke="var(--chart-1)"
                        fill="var(--chart-1)"
                        fillOpacity={0.3}
                        strokeWidth={2}
                        isAnimationActive={false}
                        connectNulls={false}
                    />

                    {/* Clearing price line */}
                    <ReferenceLine
                        x={clearingPrice}
                        stroke="var(--primary)"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        label={{
                            value: `Clearing: $${formatMoney(clearingPrice)}/Wh`,
                            position: "insideTop",
                            fill: "var(--foreground)",
                            fontSize: 12,
                        }}
                    />
                </AreaChart>
            </ResponsiveContainer>

            {/* Custom tooltip */}
            {tooltipContent && (
                <div
                    ref={tooltipRef}
                    style={{
                        position: "absolute",
                        zIndex: 50,
                        left: 0,
                        top: 0,
                    }}
                >
                    <CustomTooltip
                        price={tooltipContent.price}
                        supplyVolume={tooltipContent.supplyVolume}
                        demandVolume={tooltipContent.demandVolume}
                    />
                </div>
            )}
        </div>
    );
}

// Memoize component to prevent re-renders
export const MarketDepthChart = memo(MarketDepthChartInner);
