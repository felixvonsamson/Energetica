/** Supply and demand curve chart for electricity markets */

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
    CartesianGrid,
    Line,
    LineChart,
    ReferenceDot,
    ReferenceArea,
    ResponsiveContainer,
    XAxis,
    YAxis,
} from "recharts";

import { useAssetColorGetter } from "@/hooks/useAssetColorGetter";
import { useMarketData } from "@/hooks/useCharts";
import { useRechartsChartArea } from "@/hooks/useRechartsChartArea";
import { getHashBasedChartColor } from "@/lib/charts/color-utils";
import {
    interpolateAtX,
    createSteppedCurve,
    generateNiceTicks,
} from "@/lib/charts/ui-utils";
import { formatMoney, formatPower } from "@/lib/format-utils";

export type BreakdownType = "supply" | "demand";
export type BreakdownMode = "player" | "type";

interface SupplyDemandChartProps {
    marketId: number;
    tick: number;
    height?: number;
    showOrderBlocks?: boolean;
    breakdownEnabled?: boolean;
    breakdownMode?: BreakdownMode;
    breakdownType?: BreakdownType;
}

interface CustomTooltipProps {
    quantity: number;
    supplyPrice: number | null;
    demandPrice: number | null;
}

// Memoized tooltip to prevent re-rendering when position changes
const CustomTooltip = memo(function CustomTooltip({
    quantity,
    supplyPrice,
    demandPrice,
}: CustomTooltipProps): ReactNode {
    return (
        <div className="bg-card border border-border p-2 rounded shadow-md pointer-events-none">
            <p className="text-sm font-semibold">
                Quantity: {formatPower(quantity)}
            </p>
            {supplyPrice !== null && (
                <p className="text-sm">Supply: ${supplyPrice.toFixed(6)}/Wh</p>
            )}
            {demandPrice !== null && (
                <p className="text-sm">Demand: ${demandPrice.toFixed(6)}/Wh</p>
            )}
        </div>
    );
});

interface OrderBlockProps {
    id: string;
    x1: number;
    x2: number;
    y1: number;
    y2: number;
    color: string;
    fillOpacity: number;
    isHovered: boolean;
}

// Memoized order block component to prevent re-rendering when not hovered
const OrderBlock = memo(function OrderBlock({
    id,
    x1,
    x2,
    y1,
    y2,
    color,
    fillOpacity,
    isHovered,
}: OrderBlockProps) {
    return (
        <ReferenceArea
            key={id}
            x1={x1}
            x2={x2}
            y1={y1}
            y2={y2}
            fill={color}
            fillOpacity={isHovered ? 0.9 : fillOpacity}
            stroke={color}
            strokeOpacity={isHovered ? 0.8 : 0.5}
            strokeWidth={isHovered ? 2 : 1}
        />
    );
});

/**
 * Supply and demand chart showing market clearing with order blocks. Displays
 * ragged supply/demand curves from discrete orders, clearing point, and
 * individual order blocks.
 */
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
    } = useMarketData({
        marketId,
        tick,
    });

    // State for tooltip content (only changes when actual values change)
    const [tooltipContent, setTooltipContent] = useState<{
        quantity: number;
        supplyPrice: number | null;
        demandPrice: number | null;
    } | null>(null);

    // State for currently hovered order block (only changes when block changes)
    const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);

    // Ref to the container for coordinate calculations
    const containerRef = useRef<HTMLDivElement>(null);

    // Ref to tooltip div for direct style manipulation (avoids re-renders)
    const tooltipRef = useRef<HTMLDivElement>(null);

    // Throttle mouse move updates to reduce memory churn
    const lastUpdateTime = useRef<number>(0);
    const THROTTLE_MS = 16; // ~60fps

    // Transform data into supply and demand curves
    const {
        supplyCurve,
        demandCurve,
        orderBlocks,
        priceDomain,
        quantityDomain,
        priceTicks,
        quantityTicks,
    } = useMemo(() => {
        if (!marketData) {
            return {
                supplyCurve: [],
                demandCurve: [],
                orderBlocks: { supply: [], demand: [] },
                priceDomain: [0, 1] as [number, number],
                quantityDomain: [0, 1] as [number, number],
                priceTicks: [0, 1],
                quantityTicks: [0, 1],
            };
        }

        // Calculate extension prices
        // Supply extends up to highest demand price
        const highestDemandPrice =
            marketData.demands.price.length > 0
                ? Math.max(...marketData.demands.price)
                : undefined;

        // Demand extends down to lowest supply price
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

        // Create order blocks for ReferenceArea
        const supplyBlocks = marketData.capacities.price.map((price, i) => ({
            id: `supply-${marketData.capacities.player_id[i]}-${i}`,
            x1: i === 0 ? 0 : marketData.capacities.cumul_capacities[i - 1],
            x2: marketData.capacities.cumul_capacities[i],
            y1: 0,
            y2: price,
            playerId: marketData.capacities.player_id[i],
            facility: marketData.capacities.facility[i],
            capacity: marketData.capacities.capacity[i],
        }));

        const demandBlocks = marketData.demands.price.map((price, i) => ({
            id: `demand-${marketData.demands.player_id[i]}-${i}`,
            x1: i === 0 ? 0 : marketData.demands.cumul_capacities[i - 1],
            x2: marketData.demands.cumul_capacities[i],
            y1: 0,
            y2: price,
            playerId: marketData.demands.player_id[i],
            facility: marketData.demands.facility[i],
            capacity: marketData.demands.capacity[i],
        }));

        // Calculate exact bounds for the data
        const allPrices = [
            ...marketData.capacities.price,
            ...marketData.demands.price,
        ];
        const minPrice = allPrices.length > 0 ? Math.min(...allPrices) : 0;
        const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) : 1;

        const maxSupplyQuantity =
            marketData.capacities.cumul_capacities.length > 0
                ? (marketData.capacities.cumul_capacities[
                      marketData.capacities.cumul_capacities.length - 1
                  ] ?? 0)
                : 0;
        const maxDemandQuantity =
            marketData.demands.cumul_capacities.length > 0
                ? (marketData.demands.cumul_capacities[
                      marketData.demands.cumul_capacities.length - 1
                  ] ?? 0)
                : 0;
        const maxQuantity = Math.max(maxSupplyQuantity, maxDemandQuantity, 1);

        // Generate predictable ticks
        const priceDomain: [number, number] = [minPrice, maxPrice];
        const quantityDomain: [number, number] = [0, maxQuantity];
        const priceTicks = generateNiceTicks(minPrice, maxPrice, 6);
        const quantityTicks = generateNiceTicks(0, maxQuantity, 6);

        return {
            supplyCurve: supply,
            demandCurve: demand,
            orderBlocks: { supply: supplyBlocks, demand: demandBlocks },
            priceDomain,
            quantityDomain,
            priceTicks,
            quantityTicks,
        };
    }, [marketData]);

    // Use supply curve as the base dataset for the chart
    // We'll add demand data to each Line separately
    const chartData = useMemo(() => {
        return supplyCurve.map((point) => ({
            quantity: point.quantity,
            supply: point.price,
        }));
    }, [supplyCurve]);

    const demandChartData = useMemo(() => {
        return demandCurve.map((point) => ({
            quantity: point.quantity,
            demand: point.price,
        }));
    }, [demandCurve]);

    // Memoize color getter function to prevent recreation on every render
    const getBlockColor = useCallback(
        (
            blockType: "supply" | "demand",
            facility?: string,
            playerId?: number,
        ): string => {
            if (!breakdownEnabled) {
                // Default colors when breakdown is disabled
                return blockType === "supply"
                    ? "var(--chart-1)"
                    : "var(--chart-2)";
            }

            if (breakdownMode === "type") {
                // Use facility color getter
                return facility ? getColor(facility) : "var(--chart-1)";
            }

            // Player mode - use hash-based color from chart palette
            const key = playerId?.toString() ?? facility ?? "unknown";
            return getHashBasedChartColor(key);
        },
        [breakdownEnabled, breakdownMode, getColor],
    );

    const fillOpacity = !breakdownEnabled ? 0.2 : 0.7;

    // Create d3 scales for coordinate conversions
    const xScale = useMemo(() => {
        return scaleLinear().domain(quantityDomain).range([0, 1]); // Will be scaled to actual pixel range in mouse handler
    }, [quantityDomain]);

    const yScale = useMemo(() => {
        return scaleLinear().domain(priceDomain).range([1, 0]); // Inverted because Y coordinates increase downward
    }, [priceDomain]);

    // Measure the actual chart plotting area from Recharts internals
    // Re-measure when tick values change (affects layout)
    const maxPriceTick = priceTicks[priceTicks.length - 1];
    const maxQuantityTick = quantityTicks[quantityTicks.length - 1];
    const chartArea = useRechartsChartArea(containerRef, [
        maxPriceTick,
        maxQuantityTick,
    ]);

    // Mouse move handler to track cursor and interpolate values
    // Optimized to minimize state updates and re-renders
    const handleMouseMove = useCallback(
        (event: MouseEvent<HTMLDivElement>) => {
            // Throttle updates to reduce memory churn
            const now = performance.now();
            if (now - lastUpdateTime.current < THROTTLE_MS) {
                return;
            }
            lastUpdateTime.current = now;

            if (!containerRef.current || !chartArea) return;

            // Cache rect calculation - only call once
            const rect = containerRef.current.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;

            // Use the measured chart area from Recharts internals
            const chartLeft = chartArea.left;
            const chartRight = chartArea.left + chartArea.width;
            const chartTop = chartArea.top;
            const chartBottom = chartArea.top + chartArea.height;
            const chartWidth = chartArea.width;
            const chartHeight = chartArea.height;

            // Check if mouse is within chart bounds
            if (
                mouseX < chartLeft ||
                mouseX > chartRight ||
                mouseY < chartTop ||
                mouseY > chartBottom
            ) {
                setTooltipContent(null);
                setHoveredBlockId(null);
                return;
            }

            // Convert mouse X position to quantity value
            const normalizedX = (mouseX - chartLeft) / chartWidth;
            const [minQ, maxQ] = xScale.domain();
            const quantity = minQ! + normalizedX * (maxQ! - minQ!);

            // Interpolate supply and demand prices at this quantity
            const supplyPrice = interpolateAtX(supplyCurve, quantity);
            const demandPrice = interpolateAtX(demandCurve, quantity);

            // Determine which order block is hovered (only in breakdown mode)
            let foundBlockId: string | null = null;
            let blockPrice: number | undefined = undefined;

            if (breakdownEnabled && showOrderBlocks) {
                // Only check supply blocks when showing supply breakdown
                if (breakdownType === "supply") {
                    for (const block of orderBlocks.supply) {
                        if (
                            block.x1 !== undefined &&
                            block.x2 !== undefined &&
                            quantity >= block.x1 &&
                            quantity <= block.x2
                        ) {
                            foundBlockId = block.id;
                            blockPrice = block.y2;
                            break;
                        }
                    }
                }
                // Only check demand blocks when showing demand breakdown
                else if (breakdownType === "demand") {
                    for (const block of orderBlocks.demand) {
                        if (
                            block.x1 !== undefined &&
                            block.x2 !== undefined &&
                            quantity >= block.x1 &&
                            quantity <= block.x2
                        ) {
                            foundBlockId = block.id;
                            blockPrice = block.y2;
                            break;
                        }
                    }
                }
            }

            // Only update hovered block ID if it changed (prevents re-renders)
            setHoveredBlockId((prev) =>
                prev !== foundBlockId ? foundBlockId : prev,
            );

            // Calculate Y position for tooltip
            let tooltipY = mouseY;
            if (blockPrice !== undefined) {
                // Convert price to pixel position using the Y scale
                // Use the already-calculated chart dimensions
                const normalizedY = yScale(blockPrice);
                tooltipY = chartTop + normalizedY * chartHeight;
            }

            // Update tooltip position directly via ref (no re-render)
            if (tooltipRef.current) {
                const tooltipOffset = 100;
                tooltipRef.current.style.left = `${mouseX + 10}px`;
                tooltipRef.current.style.top = `${tooltipY - tooltipOffset}px`;
            }

            // Only update tooltip content if values changed (prevents re-renders)
            setTooltipContent((prev) => {
                if (
                    !prev ||
                    prev.quantity !== quantity ||
                    prev.supplyPrice !== supplyPrice ||
                    prev.demandPrice !== demandPrice
                ) {
                    return { quantity, supplyPrice, demandPrice };
                }
                return prev;
            });
        },
        [
            chartArea,
            xScale,
            yScale,
            supplyCurve,
            demandCurve,
            breakdownEnabled,
            showOrderBlocks,
            breakdownType,
            orderBlocks,
        ],
    );

    const handleMouseLeave = useCallback(() => {
        setTooltipContent(null);
        setHoveredBlockId(null);
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
                <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                        dataKey="quantity"
                        type="number"
                        domain={quantityDomain}
                        ticks={quantityTicks}
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value: number) => formatPower(value)}
                        label={{
                            value: "Quantity",
                            position: "insideBottom",
                            offset: -5,
                        }}
                    />
                    <YAxis
                        domain={priceDomain}
                        ticks={priceTicks}
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value: number) =>
                            `$${formatMoney(value)}`
                        }
                        label={{
                            value: "Price ($/Wh)",
                            angle: -90,
                            position: "insideLeft",
                        }}
                    />

                    {/* Order blocks - using memoized component to prevent re-renders */}
                    {showOrderBlocks &&
                        (!breakdownEnabled || breakdownType === "supply") &&
                        orderBlocks.supply.map((block) => (
                            <OrderBlock
                                key={block.id}
                                id={block.id}
                                x1={block.x1!}
                                x2={block.x2!}
                                y1={block.y1!}
                                y2={block.y2!}
                                color={getBlockColor(
                                    "supply",
                                    block.facility,
                                    block.playerId,
                                )}
                                fillOpacity={fillOpacity}
                                isHovered={hoveredBlockId === block.id}
                            />
                        ))}

                    {showOrderBlocks &&
                        (!breakdownEnabled || breakdownType === "demand") &&
                        orderBlocks.demand.map((block) => (
                            <OrderBlock
                                key={block.id}
                                id={block.id}
                                x1={block.x1!}
                                x2={block.x2!}
                                y1={block.y1!}
                                y2={block.y2!}
                                color={getBlockColor(
                                    "demand",
                                    block.facility,
                                    block.playerId,
                                )}
                                fillOpacity={fillOpacity}
                                isHovered={hoveredBlockId === block.id}
                            />
                        ))}

                    {/* Supply curve */}
                    <Line
                        type="linear"
                        dataKey="supply"
                        data={chartData}
                        stroke="var(--chart-1)"
                        strokeWidth={2}
                        dot={false}
                        activeDot={false}
                        isAnimationActive={false}
                    />

                    {/* Demand curve */}
                    <Line
                        type="linear"
                        dataKey="demand"
                        data={demandChartData}
                        stroke="var(--chart-2)"
                        strokeWidth={2}
                        dot={false}
                        activeDot={false}
                        isAnimationActive={false}
                    />

                    {/* Clearing price/volume point */}
                    <ReferenceDot
                        x={marketData.market_quantity}
                        y={marketData.market_price}
                        r={6}
                        fill="var(--primary)"
                        stroke="var(--background)"
                        strokeWidth={2}
                        label={{
                            value: `Clearing: ${formatPower(marketData.market_quantity)} @ $${formatMoney(marketData.market_price)}/Wh`,
                            position: "top",
                            fill: "var(--foreground)",
                            fontSize: 12,
                        }}
                    />
                </LineChart>
            </ResponsiveContainer>

            {/* Custom tooltip with interpolated values */}
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
                        quantity={tooltipContent.quantity}
                        supplyPrice={tooltipContent.supplyPrice}
                        demandPrice={tooltipContent.demandPrice}
                    />
                </div>
            )}
        </div>
    );
}

// Memoize component to prevent re-renders when props haven't changed
// This is critical for slider performance - prevents re-creating hundreds of objects
export const SupplyDemandChart = memo(SupplyDemandChartInner);
