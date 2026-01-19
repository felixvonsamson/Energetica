/** Supply and demand curve chart for electricity markets */

import { RefreshCw } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import {
    CartesianGrid,
    Line,
    LineChart,
    ReferenceDot,
    ReferenceArea,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import { useMarketData } from "@/hooks/useCharts";
import { formatPower } from "@/lib/format-utils";

interface SupplyDemandChartProps {
    marketId: number;
    tick: number;
    height?: number;
    showOrderBlocks?: boolean;
}

interface CurvePoint {
    quantity: number;
    price: number;
}

interface TooltipData {
    quantity: number;
    supply?: number;
    demand?: number;
}

interface CustomTooltipProps {
    active?: boolean;
    payload?: ReadonlyArray<{
        value: number;
        name: string;
        payload: TooltipData;
        [key: string]: unknown;
    }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps): ReactNode {
    if (!active || !payload || payload.length === 0) return null;

    const data = payload[0]?.payload;
    if (!data) return null;
    return (
        <div className="bg-card border border-border p-2 rounded shadow-md">
            <p className="text-sm font-semibold">
                Quantity: {formatPower(data.quantity)}
            </p>
            {data.supply !== undefined && (
                <p className="text-sm">Supply: ${data.supply.toFixed(6)}/Wh</p>
            )}
            {data.demand !== undefined && (
                <p className="text-sm">Demand: ${data.demand.toFixed(6)}/Wh</p>
            )}
        </div>
    );
}

/**
 * Transforms order data into a stepped curve for Recharts. Creates points for a
 * ragged supply or demand curve from discrete orders.
 */
function createSteppedCurve(
    prices: number[],
    cumulCapacities: number[],
): CurvePoint[] {
    if (prices.length === 0) return [];

    const points: CurvePoint[] = [];

    // Start at origin
    points.push({ quantity: 0, price: 0 });

    for (let i = 0; i < prices.length; i++) {
        const prevCumul = i === 0 ? 0 : (cumulCapacities[i - 1] ?? 0);
        const currCumul = cumulCapacities[i] ?? 0;
        const price = prices[i] ?? 0;

        // Add vertical step (price change at same quantity)
        points.push({ quantity: prevCumul, price });
        // Add horizontal step (quantity change at same price)
        points.push({ quantity: currCumul, price });
    }

    return points;
}

/**
 * Supply and demand chart showing market clearing with order blocks. Displays
 * ragged supply/demand curves from discrete orders, clearing point, and
 * individual order blocks.
 */
export function SupplyDemandChart({
    marketId,
    tick,
    height = 500,
    showOrderBlocks = true,
}: SupplyDemandChartProps) {
    const {
        data: marketData,
        isLoading,
        isError,
    } = useMarketData({
        marketId,
        tick,
    });

    // Transform data into supply and demand curves
    const { supplyCurve, demandCurve, orderBlocks } = useMemo(() => {
        if (!marketData) {
            return {
                supplyCurve: [],
                demandCurve: [],
                orderBlocks: { supply: [], demand: [] },
            };
        }

        const supply = createSteppedCurve(
            marketData.capacities.price,
            marketData.capacities.cumul_capacities,
        );

        const demand = createSteppedCurve(
            marketData.demands.price,
            marketData.demands.cumul_capacities,
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

        return {
            supplyCurve: supply,
            demandCurve: demand,
            orderBlocks: { supply: supplyBlocks, demand: demandBlocks },
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
        <ResponsiveContainer width="100%" height={height}>
            <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                    dataKey="quantity"
                    type="number"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value: number) => formatPower(value)}
                    label={{
                        value: "Quantity (W)",
                        position: "insideBottom",
                        offset: -5,
                    }}
                />
                <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value: number) => `$${value.toFixed(6)}`}
                    label={{
                        value: "Price ($/Wh)",
                        angle: -90,
                        position: "insideLeft",
                    }}
                />

                {/* Order blocks */}
                {showOrderBlocks &&
                    orderBlocks.supply.map((block) => (
                        <ReferenceArea
                            key={block.id}
                            x1={block.x1}
                            x2={block.x2}
                            y1={block.y1}
                            y2={block.y2}
                            fill="var(--chart-1)"
                            fillOpacity={0.2}
                            stroke="var(--chart-1)"
                            strokeOpacity={0.5}
                        />
                    ))}

                {showOrderBlocks &&
                    orderBlocks.demand.map((block) => (
                        <ReferenceArea
                            key={block.id}
                            x1={block.x1}
                            x2={block.x2}
                            y1={block.y1}
                            y2={block.y2}
                            fill="var(--chart-2)"
                            fillOpacity={0.2}
                            stroke="var(--chart-2)"
                            strokeOpacity={0.5}
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
                        value: `Clearing: ${formatPower(marketData.market_quantity)} @ $${marketData.market_price.toFixed(6)}/Wh`,
                        position: "top",
                        fill: "var(--foreground)",
                        fontSize: 12,
                    }}
                />

                <Tooltip content={<CustomTooltip />} />
            </LineChart>
        </ResponsiveContainer>
    );
}
