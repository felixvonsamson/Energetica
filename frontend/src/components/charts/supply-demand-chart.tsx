/** Merit Order & Market Clearing chart for electricity markets */

import { CustomChart, LineChart as ELineChart } from "echarts/charts";
import type { CustomSeriesOption, LineSeriesOption } from "echarts/charts";
import {
    DataZoomComponent,
    GridComponent,
    MarkLineComponent,
    MarkPointComponent,
    ToolboxComponent,
    TooltipComponent,
} from "echarts/components";
import type {
    DataZoomComponentOption,
    GridComponentOption,
    MarkLineComponentOption,
    MarkPointComponentOption,
    ToolboxComponentOption,
    TooltipComponentOption,
} from "echarts/components";
import type { ComposeOption } from "echarts/core";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { ZoomOut } from "lucide-react";
import {
    memo,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";

import { CoinIcon } from "@/components/ui/coin-icon";
import { Label } from "@/components/ui/label";
import {
    SegmentedPicker,
    SegmentedPickerOption,
} from "@/components/ui/segmented-picker";
import { Slider } from "@/components/ui/slider";
import { useAssetColorGetter } from "@/hooks/use-asset-color-getter";
import { useMarketData } from "@/hooks/use-charts";
import { useElectricityMarket } from "@/hooks/use-electricity-markets";
import { useGameEngine } from "@/hooks/use-game";
import { useGameTick } from "@/hooks/use-game-tick";
import { usePlayerMap } from "@/hooks/use-players";
import { getAssetLongName } from "@/lib/assets/asset-names";
import {
    getHashBasedChartColor,
    resolveColor,
    resolveCSSVar,
} from "@/lib/charts/color-utils";
import {
    createSteppedCurve,
    interpolateAtX,
} from "@/lib/charts/ui-utils";
import { formatDuration, formatMoney, formatPower } from "@/lib/format-utils";

echarts.use([
    ELineChart,
    CustomChart,
    GridComponent,
    TooltipComponent,
    MarkLineComponent,
    MarkPointComponent,
    DataZoomComponent,
    ToolboxComponent,
    CanvasRenderer,
]);

type ECOption = ComposeOption<
    | LineSeriesOption
    | CustomSeriesOption
    | GridComponentOption
    | TooltipComponentOption
    | MarkLineComponentOption
    | MarkPointComponentOption
    | DataZoomComponentOption
    | ToolboxComponentOption
>;

export type ActiveMode = "supply" | "demand";
export type ColorMode = "player" | "type";

// ── Tooltip ───────────────────────────────────────────────────────────────────

interface BlockTooltipProps {
    quantity: number;
    price: number;
    playerName: string;
    facility: string;
    clientX: number;
    clientY: number;
}

function BlockTooltip({
    quantity,
    price,
    playerName,
    facility,
    clientX,
    clientY,
}: BlockTooltipProps): ReactNode {
    return (
        <div
            style={{
                position: "fixed",
                left: clientX + 14,
                top: clientY + 8,
                pointerEvents: "none",
                zIndex: 9999,
            }}
            className="bg-neutral-100 dark:bg-neutral-700 border border-border rounded shadow-lg p-2 text-xs"
        >
            <table>
                <tbody>
                    <tr>
                        <td className="pr-3 text-muted-foreground">Quantity</td>
                        <td className="font-mono">{formatPower(quantity)}</td>
                    </tr>
                    <tr>
                        <td className="pr-3 text-muted-foreground">Price</td>
                        <td className="font-mono flex items-center gap-1">
                            {formatMoney(price)}
                            <CoinIcon className="w-3 h-3" />
                            /MWh
                        </td>
                    </tr>
                    <tr>
                        <td className="pr-3 text-muted-foreground">Player</td>
                        <td>{playerName}</td>
                    </tr>
                    <tr>
                        <td className="pr-3 text-muted-foreground">Type</td>
                        <td>{getAssetLongName(facility)}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}

// ── MeritOrderChart ───────────────────────────────────────────────────────────

export interface MeritOrderChartProps {
    marketId: number;
    height?: number;
}

interface OrderBlock {
    x1: number;
    x2: number;
    y1: number;
    y2: number;
    playerId: number;
    facility: string;
    capacity: number;
    price: number;
}

interface TooltipState {
    clientX: number;
    clientY: number;
    block: OrderBlock;
}

function MeritOrderChartInner({
    marketId,
    height = 500,
}: MeritOrderChartProps) {
    const { currentTick } = useGameTick();
    const { data: gameEngine } = useGameEngine();
    const getColor = useAssetColorGetter();
    const playerMap = usePlayerMap();
    const marketDetails = useElectricityMarket(marketId);

    // Tick selection (last 360 ticks).
    // ticksBack=0 always shows the latest tick; increases as the slider moves left.
    const [ticksBack, setTicksBack] = useState(0);
    const maxTick = currentTick !== undefined ? currentTick - 1 : 0;
    const minTick = useMemo(() => {
        if (!currentTick) return 0;
        const marketStart = marketDetails?.created_tick ?? 0;
        return Math.max(marketStart, currentTick - 360);
    }, [currentTick, marketDetails]);
    const selectedTick = Math.max(minTick, maxTick - ticksBack);

    const [activeMode, setActiveMode] = useState<ActiveMode>("supply");
    const [colorMode, setColorMode] = useState<ColorMode>("player");

    const {
        data: marketData,
        isLoading,
        isError,
    } = useMarketData({ marketId, tick: selectedTick });

    const chartRef = useRef<HTMLDivElement>(null);
    const highlightRef = useRef<HTMLDivElement>(null);
    const instanceRef = useRef<echarts.ECharts | null>(null);
    const [isZoomed, setIsZoomed] = useState(false);
    // Zoom range as percentages (0–100). Kept in sync with the datazoom event
    // so the option memo can pre-clip blocks to the visible X window.
    const [zoomRange, setZoomRange] = useState({ start: 0, end: 100 });
    const [tooltipState, setTooltipState] = useState<TooltipState | null>(null);

    // Live ref for ZRender event handlers (avoids stale closures)
    const liveRef = useRef<{
        supplyBlocks: OrderBlock[];
        demandBlocks: OrderBlock[];
        activeMode: ActiveMode;
    }>({
        supplyBlocks: [],
        demandBlocks: [],
        activeMode: "supply",
    });

    // ── Data transformation ───────────────────────────────────────────────────

    const getBlockColor = useCallback(
        (playerId: number, facility: string, mode: ColorMode): string => {
            if (mode === "type") {
                return resolveColor(getColor(facility));
            }
            return resolveColor(getHashBasedChartColor(playerId.toString()));
        },
        [getColor],
    );

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
                supplyCurve: [] as { quantity: number; price: number }[],
                demandCurve: [] as { quantity: number; price: number }[],
                supplyBlocks: [] as OrderBlock[],
                demandBlocks: [] as OrderBlock[],
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

        const supplyBlocks: OrderBlock[] = marketData.capacities.price.map(
            (price, i) => ({
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
                price,
            }),
        );

        const demandBlocks: OrderBlock[] = marketData.demands.price.map(
            (price, i) => ({
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
                price,
            }),
        );

        const allPrices = [
            ...marketData.capacities.price,
            ...marketData.demands.price,
        ];
        const minPrice = allPrices.length > 0 ? Math.min(...allPrices) : 0;
        const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) : 1;

        const maxSupplyQ = marketData.capacities.cumul_capacities.at(-1) ?? 0;
        const maxDemandQ = marketData.demands.cumul_capacities.at(-1) ?? 0;
        const maxQ = Math.max(maxSupplyQ, maxDemandQ, 1);

        return {
            supplyCurve: supply,
            demandCurve: demand,
            supplyBlocks,
            demandBlocks,
            priceDomain: [Math.min(0, minPrice), maxPrice] as [number, number],
            quantityDomain: [0, maxQ] as [number, number],
        };
    }, [marketData]);

    // Keep live ref updated
    useEffect(() => {
        liveRef.current = { supplyBlocks, demandBlocks, activeMode };
    }, [supplyBlocks, demandBlocks, activeMode]);

    // ── ECharts option ────────────────────────────────────────────────────────

    const option = useMemo((): ECOption => {
        const mutedColor = resolveCSSVar("--muted-foreground");
        const chart1Color = resolveColor("var(--chart-1)");
        const chart2Color = resolveColor("var(--chart-2)");

        const activeBlocks =
            activeMode === "supply" ? supplyBlocks : demandBlocks;

        // Pre-clip blocks to the visible X window so that ECharts' dataZoom
        // doesn't skip renderItem for partially-visible blocks. Blocks that
        // overlap the window get their x1/x2 clamped; fully-outside blocks
        // are dropped. The liveRef still holds the original blocks for the
        // tooltip/highlight so their labels remain correct.
        const span = quantityDomain[1] - quantityDomain[0];
        const visXMin =
            quantityDomain[0] + span * (zoomRange.start / 100);
        const visXMax =
            quantityDomain[0] + span * (zoomRange.end / 100);
        const visibleBlocks = activeBlocks
            .filter((b) => b.x2 > visXMin && b.x1 < visXMax)
            .map((b) => ({
                ...b,
                x1: Math.max(b.x1, visXMin),
                x2: Math.min(b.x2, visXMax),
            }));

        const blockSeriesData = visibleBlocks.map((block) => {
            const color = getBlockColor(
                block.playerId,
                block.facility,
                colorMode,
            );
            return {
                value: [block.x1, block.x2, block.y1, block.y2],
                itemStyle: { color, opacity: 0.7 },
            };
        });

        const activeCurve = activeMode === "supply" ? supplyCurve : demandCurve;
        const inactiveCurve =
            activeMode === "supply" ? demandCurve : supplyCurve;
        const activeLineColor =
            activeMode === "supply" ? chart1Color : chart2Color;
        const inactiveLineColor =
            activeMode === "supply" ? chart2Color : chart1Color;

        // Clip a step curve to the visible X window so the line extends
        // exactly to the zoom boundary instead of stopping at the nearest
        // data point or bleeding off-screen.
        const clipCurve = (
            curve: { quantity: number; price: number }[],
        ): [number, number][] => {
            if (!curve.length) return [];
            const inner = curve.filter(
                (p) => p.quantity >= visXMin && p.quantity <= visXMax,
            );
            const result: [number, number][] = [];
            // Prepend a boundary point if the curve starts before visXMin
            if ((inner[0]?.quantity ?? visXMax + 1) > visXMin) {
                const y = interpolateAtX(curve, visXMin);
                if (y !== null) result.push([visXMin, y]);
            }
            for (const p of inner) result.push([p.quantity, p.price]);
            // Append a boundary point if the curve ends after visXMax
            if ((inner[inner.length - 1]?.quantity ?? visXMin - 1) < visXMax) {
                const y = interpolateAtX(curve, visXMax);
                if (y !== null) result.push([visXMax, y]);
            }
            return result;
        };

        const activeSeriesData = clipCurve(activeCurve);
        const inactiveSeriesData = clipCurve(inactiveCurve);

        const series: ECOption["series"] = [
            // Active side: filled colored blocks
            {
                type: "custom" as const,
                name: "blocks",
                silent: true,
                clip: true,
                renderItem(params, api) {
                    const x1 = api.value(0) as number;
                    const x2 = api.value(1) as number;
                    const y1 = api.value(2) as number;
                    const y2 = api.value(3) as number;

                    const cs = params.coordSys as unknown as {
                        x: number;
                        y: number;
                        width: number;
                        height: number;
                    };

                    const topLeft = api.coord([x1, y2]);
                    const bottomRight = api.coord([x2, y1]);

                    // Clip horizontally to the plot area so that blocks
                    // partially outside the zoom window are shown clipped
                    // rather than dropped entirely.
                    const rawLeft = topLeft[0] ?? 0;
                    const rawRight = bottomRight[0] ?? 0;
                    const clippedLeft = Math.max(rawLeft, cs.x);
                    const clippedRight = Math.min(rawRight, cs.x + cs.width);

                    if (clippedRight <= clippedLeft) {
                        return { type: "group" as const, children: [] };
                    }

                    return {
                        type: "rect" as const,
                        shape: {
                            x: clippedLeft,
                            y: topLeft[1] ?? 0,
                            width: clippedRight - clippedLeft,
                            height:
                                (bottomRight[1] ?? 0) - (topLeft[1] ?? 0),
                        },
                        style: api.style(),
                    };
                },
                data: blockSeriesData,
                encode: { x: [0, 1], y: [2, 3] },
                z: 1,
            },
            // Active side: step curve outline
            {
                name: "active-curve",
                type: "line" as const,
                symbol: "none",
                data: activeSeriesData,
                lineStyle: { color: activeLineColor, width: 2 },
                itemStyle: { color: activeLineColor },
                animation: false,
                silent: true,
                z: 3,
                markLine: {
                    silent: true,
                    symbol: ["none", "none"],
                    data: [
                        {
                            xAxis: marketData?.market_quantity ?? 0,
                            name: `Clearing: ${formatPower(marketData?.market_quantity ?? 0)}`,
                        },
                        {
                            yAxis: marketData?.market_price ?? 0,
                            name: `Price: ${formatMoney(marketData?.market_price ?? 0)}/MWh`,
                            label: { position: "insideStartTop" },
                        },
                    ],
                    lineStyle: {
                        color: mutedColor,
                        type: "dashed",
                        width: 1.5,
                    },
                    label: {
                        formatter: "{b}",
                        fontSize: 11,
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
                            symbolSize: 10,
                            itemStyle: { color: "#ef4444" },
                            label: { show: false },
                        },
                    ],
                    animation: false,
                },
            },
            // Inactive side: step curve outline only (no fill)
            {
                name: "inactive-curve",
                type: "line" as const,
                symbol: "none",
                data: inactiveSeriesData,
                lineStyle: { color: inactiveLineColor, width: 2 },
                itemStyle: { color: inactiveLineColor },
                animation: false,
                silent: true,
                z: 2,
            },
        ];

        return {
            animation: false,
            grid: { left: 90, right: 20, top: 20, bottom: 55 },
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
                splitLine: {
                    lineStyle: { color: "rgba(128,128,128,0.15)" },
                },
            },
            yAxis: {
                type: "value",
                min: priceDomain[0],
                max: priceDomain[1],
                name: "Price (coins/MWh)",
                nameLocation: "middle",
                nameGap: 70,
                axisLabel: {
                    formatter: (value: number) => formatMoney(value),
                    fontSize: 11,
                },
                splitLine: {
                    lineStyle: { color: "rgba(128,128,128,0.15)" },
                },
            },
            tooltip: { trigger: "none", showContent: false },
            dataZoom: [
                {
                    type: "inside",
                    xAxisIndex: 0,
                    zoomLock: true,
                    // Preserve the current zoom position so that the
                    // notMerge:true setOption call doesn't reset it to 0–100.
                    start: zoomRange.start,
                    end: zoomRange.end,
                },
            ],
            toolbox: {
                show: true,
                feature: {
                    dataZoom: {
                        xAxisIndex: 0,
                        yAxisIndex: "none",
                        brushStyle: {
                            borderWidth: 1,
                            color: "rgba(99,102,241,0.12)",
                            borderColor: "rgba(99,102,241,0.5)",
                        },
                    },
                },
                iconStyle: { opacity: 0 },
                emphasis: { iconStyle: { opacity: 0 } },
                right: 80,
                bottom: 8,
            },
            series,
        };
    }, [
        supplyBlocks,
        demandBlocks,
        supplyCurve,
        demandCurve,
        activeMode,
        colorMode,
        getBlockColor,
        priceDomain,
        quantityDomain,
        marketData,
        zoomRange,
    ]);

    // ── Chart lifecycle ───────────────────────────────────────────────────────

    useEffect(() => {
        if (!chartRef.current) return;
        const chart = echarts.init(chartRef.current, undefined, {
            renderer: "canvas",
        });
        instanceRef.current = chart;

        // Start in permanent drag-to-select zoom mode
        chart.dispatchAction({
            type: "takeGlobalCursor",
            key: "dataZoomSelect",
            dataZoomSelectActive: true,
        });

        chart.on("datazoom", () => {
            const opt = chart.getOption();
            const dzArr = Array.isArray(opt.dataZoom) ? opt.dataZoom : [];
            const dzX = dzArr[0] as
                | { start?: number; end?: number }
                | undefined;
            const sx = dzX?.start ?? 0;
            const ex = dzX?.end ?? 100;
            setIsZoomed(sx > 0.5 || ex < 99.5);
            setZoomRange({ start: sx, end: ex });
        });

        const zr = chart.getZr();

        zr.on("mousemove", (e: { offsetX: number; event: Event }) => {
            const { offsetX } = e;
            const nativeEvent = e.event as MouseEvent;

            // Convert pixel X to data coordinate. Works anywhere vertically
            // in the canvas so the tooltip appears above/below blocks too.
            const xData = chart.convertFromPixel(
                { xAxisIndex: 0 },
                offsetX,
            ) as number;

            if (isNaN(xData)) {
                setTooltipState(null);
                return;
            }

            const {
                supplyBlocks: sb,
                demandBlocks: db,
                activeMode: am,
            } = liveRef.current;
            const activeBlocks = am === "supply" ? sb : db;

            const hovered = activeBlocks.find(
                (block) => xData >= block.x1 && xData <= block.x2,
            );

            if (hovered) {
                setTooltipState({
                    clientX: nativeEvent.clientX,
                    clientY: nativeEvent.clientY,
                    block: hovered,
                });
                // Draw full-height highlight band over the hovered block's
                // X range, clamped to the grid area.
                if (highlightRef.current) {
                    const x1px = chart.convertToPixel(
                        { xAxisIndex: 0 },
                        hovered.x1,
                    ) as number;
                    const x2px = chart.convertToPixel(
                        { xAxisIndex: 0 },
                        hovered.x2,
                    ) as number;
                    const gridLeft = 90; // matches grid.left in option
                    const gridRight = chart.getWidth() - 20; // chart.width - grid.right
                    const clampedLeft = Math.max(x1px, gridLeft);
                    const clampedRight = Math.min(x2px, gridRight);
                    if (clampedRight > clampedLeft) {
                        highlightRef.current.style.left = `${clampedLeft}px`;
                        highlightRef.current.style.width = `${clampedRight - clampedLeft}px`;
                        highlightRef.current.style.display = "block";
                    } else {
                        highlightRef.current.style.display = "none";
                    }
                }
            } else {
                setTooltipState(null);
                if (highlightRef.current) {
                    highlightRef.current.style.display = "none";
                }
            }
        });

        zr.on("mouseout", () => {
            setTooltipState(null);
            if (highlightRef.current) {
                highlightRef.current.style.display = "none";
            }
        });

        return () => {
            chart.getZr().off("mousemove");
            chart.getZr().off("mouseout");
            chart.off("datazoom");
            chart.dispose();
            instanceRef.current = null;
        };
    }, []);

    useEffect(() => {
        instanceRef.current?.setOption(option, { notMerge: true });
        // Re-activate drag-to-zoom after notMerge resets toolbox state
        instanceRef.current?.dispatchAction({
            type: "takeGlobalCursor",
            key: "dataZoomSelect",
            dataZoomSelectActive: true,
        });
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

    const handleResetZoom = useCallback(() => {
        const inst = instanceRef.current;
        if (!inst) return;
        inst.dispatchAction({ type: "dataZoom", start: 0, end: 100 });
        setIsZoomed(false);
        setZoomRange({ start: 0, end: 100 });
        inst.dispatchAction({
            type: "takeGlobalCursor",
            key: "dataZoomSelect",
            dataZoomSelectActive: true,
        });
    }, []);

    // ── Slider label ──────────────────────────────────────────────────────────

    const sliderLabel = useMemo(() => {
        if (!currentTick || !gameEngine) return `Tick ${selectedTick}`;
        const ticksAgo = currentTick - selectedTick;
        if (ticksAgo <= 0) return "Current";
        return `${formatDuration(ticksAgo, gameEngine, true)} ago`;
    }, [selectedTick, currentTick, gameEngine]);

    // ── Render ────────────────────────────────────────────────────────────────

    if (!currentTick) return null;

    const tooltipBlock = tooltipState?.block;
    const tooltipPlayerName = tooltipBlock
        ? (playerMap?.[tooltipBlock.playerId]?.username ??
          `Player ${tooltipBlock.playerId}`)
        : "";

    const isEmpty =
        !isLoading &&
        !isError &&
        marketData &&
        marketData.capacities.price.length === 0 &&
        marketData.demands.price.length === 0;

    return (
        <div className="space-y-4">
            {/* Controls */}
            <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-3">
                    <Label className="text-sm font-medium shrink-0">Show</Label>
                    <SegmentedPicker
                        value={activeMode}
                        onValueChange={(v) => setActiveMode(v as ActiveMode)}
                    >
                        <SegmentedPickerOption value="supply">
                            Supply
                        </SegmentedPickerOption>
                        <SegmentedPickerOption value="demand">
                            Demand
                        </SegmentedPickerOption>
                    </SegmentedPicker>
                </div>
                <div className="flex items-center gap-3">
                    <Label className="text-sm font-medium shrink-0">
                        Color by
                    </Label>
                    <SegmentedPicker
                        value={colorMode}
                        onValueChange={(v) => setColorMode(v as ColorMode)}
                    >
                        <SegmentedPickerOption value="player">
                            Player
                        </SegmentedPickerOption>
                        <SegmentedPickerOption value="type">
                            Technology
                        </SegmentedPickerOption>
                    </SegmentedPicker>
                </div>
            </div>

            {/* Tick slider */}
            <div className="flex items-center gap-4">
                <Label className="text-sm font-medium shrink-0 w-28 text-right">
                    {sliderLabel}
                </Label>
                <div className="flex-1">
                    <Slider
                        min={minTick}
                        max={maxTick}
                        step={1}
                        value={[selectedTick]}
                        onValueChange={(values) =>
                            setTicksBack(maxTick - (values[0] ?? maxTick))
                        }
                        disabled={minTick >= maxTick}
                    />
                </div>
            </div>

            {/* Chart */}
            <div className="relative min-w-0 overflow-hidden" style={{ height: `${height}px` }}>
                <div ref={chartRef} className="w-full h-full" />

                {/* Full-height highlight band for the hovered block column */}
                <div
                    ref={highlightRef}
                    style={{
                        position: "absolute",
                        top: "20px",
                        bottom: "55px",
                        display: "none",
                        background: "rgba(128,128,128,0.15)",
                        pointerEvents: "none",
                        zIndex: 1,
                    }}
                />

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

                {isEmpty && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-muted-foreground">
                            No orders for this tick
                        </span>
                    </div>
                )}

                {isZoomed && (
                    <button
                        onClick={handleResetZoom}
                        className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 text-xs bg-secondary hover:bg-secondary/80 border border-border rounded transition-colors text-foreground"
                        title="Reset zoom"
                    >
                        <ZoomOut className="w-3 h-3" />
                        Reset
                    </button>
                )}

                {tooltipState && tooltipBlock && (
                    <BlockTooltip
                        quantity={tooltipBlock.capacity}
                        price={tooltipBlock.price}
                        playerName={tooltipPlayerName}
                        facility={tooltipBlock.facility}
                        clientX={tooltipState.clientX}
                        clientY={tooltipState.clientY}
                    />
                )}
            </div>
        </div>
    );
}

export const MeritOrderChart = memo(MeritOrderChartInner);
