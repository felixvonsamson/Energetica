/**
 * ECharts-based Power Chart with stacked stepped areas, drag-to-zoom, and
 * absolute/percentage display modes.
 */

import { BarChart as EBarChart } from "echarts/charts";
import type { BarSeriesOption } from "echarts/charts";
import {
    DataZoomComponent,
    GridComponent,
    ToolboxComponent,
    TooltipComponent,
} from "echarts/components";
import type {
    DataZoomComponentOption,
    GridComponentOption,
    ToolboxComponentOption,
    TooltipComponentOption,
} from "echarts/components";
import type { ComposeOption } from "echarts/core";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { ZoomOut, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { FacilityIcon } from "@/components/ui/asset-icon";
import { FacilityName } from "@/components/ui/asset-name";
import { FacilityGauge } from "@/components/ui/facility-gauge";
import { useTimeMode } from "@/contexts/time-mode-context";
import { useAssetColorGetter } from "@/hooks/use-asset-color-getter";
import { useFacilities } from "@/hooks/use-facilities";
import { useGameEngine } from "@/hooks/use-game";
import { useGameTick } from "@/hooks/use-game-tick";
import { KEY_ORDER_BY_CHART_TYPE } from "@/lib/charts/key-order";
import { formatDuration, formatEnergy, formatPower } from "@/lib/format-utils";
import type { ChartType } from "@/types/charts";

// Register ECharts components once at module level (tree-shaking)
echarts.use([
    EBarChart,
    GridComponent,
    TooltipComponent,
    DataZoomComponent,
    ToolboxComponent,
    CanvasRenderer,
]);

type ECOption = ComposeOption<
    | BarSeriesOption
    | GridComponentOption
    | TooltipComponentOption
    | DataZoomComponentOption
    | ToolboxComponentOption
>;

export type PowerChartViewMode = "absolute" | "percent";

// ── React tooltip overlay ─────────────────────────────────────────────────────

interface TooltipItem {
    key: string;
    color: string;
    value: number;
}

interface Circle {
    clientX: number;
    clientY: number;
    color: string;
}

interface TooltipState {
    tick: number;
    /** Non-zero items, topmost series first (reversed stack order). */
    items: TooltipItem[];
    total: number;
    viewMode: PowerChartViewMode;
    clientX: number;
    clientY: number;
    /** Dots on the axis pointer line, one per visible non-zero series. */
    circles: Circle[];
}

/**
 * Floating tooltip rendered as a React component, positioned with `position:
 * fixed` so it escapes any `overflow: hidden` containers.
 *
 * Uses the same hooks / components as the rest of the UI so it picks up theming
 * and facility icons automatically.
 */
function PowerTooltip({ tooltip }: { tooltip: TooltipState }) {
    const { currentTick } = useGameTick();
    const { mode: timeMode } = useTimeMode();
    const { data: gameEngine } = useGameEngine();

    const timestamp =
        gameEngine && currentTick !== undefined
            ? `${formatDuration(currentTick - tooltip.tick - 1, timeMode, gameEngine)} ago`
            : "--";

    const formatVal = (v: number) =>
        tooltip.viewMode === "percent" ? `${v.toFixed(1)}%` : formatPower(v);

    const totalVal =
        tooltip.viewMode === "percent" ? "100%" : formatPower(tooltip.total);

    return (
        <div
            style={{
                position: "fixed",
                left: tooltip.clientX + 14,
                top: tooltip.clientY + 8,
                pointerEvents: "none",
                zIndex: 9999,
            }}
            className="bg-neutral-100 dark:bg-neutral-700 border border-border rounded shadow-lg p-2 text-xs"
        >
            <div className="font-semibold mb-1 pb-1 border-b border-border/50">
                {timestamp}
            </div>
            <table>
                <tbody>
                    {tooltip.items.map((item) => (
                        <tr key={item.key}>
                            <td className="pr-1 align-middle">
                                <div
                                    className="w-2.5 h-2.5 rounded-sm inline-block"
                                    style={{ backgroundColor: item.color }}
                                />
                            </td>
                            <td className="pr-3 whitespace-nowrap align-middle">
                                <div className="flex items-center gap-1">
                                    <FacilityIcon
                                        facility={item.key}
                                        size={14}
                                    />
                                    <FacilityName
                                        facility={item.key}
                                        mode="long"
                                    />
                                </div>
                            </td>
                            <td className="text-right font-mono whitespace-nowrap align-middle">
                                {formatVal(item.value)}
                            </td>
                        </tr>
                    ))}
                    <tr className="border-t border-border/50">
                        <td
                            colSpan={2}
                            className="pt-1 pr-3 font-semibold align-middle"
                        >
                            Total
                        </td>
                        <td className="pt-1 text-right font-mono font-semibold whitespace-nowrap align-middle">
                            {totalVal}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}

// ── PowerChart ────────────────────────────────────────────────────────────────

interface PowerChartProps {
    chartType: ChartType;
    chartData: Array<Record<string, unknown>>;
    isLoading: boolean;
    isError: boolean;
    hiddenFacilities: Set<string>;
    viewMode: PowerChartViewMode;
}

export function PowerChart({
    chartType,
    chartData,
    isLoading,
    isError,
    hiddenFacilities,
    viewMode,
}: PowerChartProps) {
    const chartRef = useRef<HTMLDivElement>(null);
    const instanceRef = useRef<echarts.ECharts | null>(null);
    const dataKeyRef = useRef<string>("");
    const structuralKeyRef = useRef<string>("");

    const [isZoomed, setIsZoomed] = useState(false);
    const [tooltip, setTooltip] = useState<TooltipState | null>(null);
    const [containerWidth, setContainerWidth] = useState(0);
    const [zoomRange, setZoomRange] = useState({ start: 0, end: 100 });

    const getColor = useAssetColorGetter();
    const { mode: timeMode } = useTimeMode();
    const { data: gameEngine } = useGameEngine();
    const { currentTick } = useGameTick();

    // Keep currentTick in a ref so axis/tooltip formatters stay fresh without
    // triggering full option recomputation (and consequent zoom reset) on
    // every game tick.
    const currentTickRef = useRef(currentTick);
    useEffect(() => {
        currentTickRef.current = currentTick;
    }, [currentTick]);

    // Derive visible series in predefined stack order,
    // excluding hidden and all-zero series.
    const visibleKeys = useMemo(() => {
        if (!chartData.length) return [];
        const keyOrder = KEY_ORDER_BY_CHART_TYPE[
            chartType
        ] as readonly string[];
        return keyOrder.filter(
            (key) =>
                !hiddenFacilities.has(key) &&
                chartData.some((d) => Number(d[key] ?? 0) > 0),
        );
    }, [chartData, chartType, hiddenFacilities]);

    // Compute normalised percentage data when in percent mode.
    // Percentages are based only on currently visible series so that hiding a
    // series redistributes the remaining ones to 100%.
    const displayData = useMemo(() => {
        if (viewMode !== "percent") return chartData;
        return chartData.map((dataPoint) => {
            const total = visibleKeys.reduce(
                (s, k) => s + Number(dataPoint[k] ?? 0),
                0,
            );
            const row: Record<string, unknown> = { tick: dataPoint.tick };
            visibleKeys.forEach((k) => {
                row[k] =
                    total > 0 ? (Number(dataPoint[k] ?? 0) / total) * 100 : 0;
            });
            return row;
        });
    }, [chartData, visibleKeys, viewMode]);

    // Structural key: changes only when chart type or data length changes (e.g.
    // resolution switch). Triggers a full zoom reset. Pure data updates (new
    // tick arriving, same length) do NOT change this key so the zoom is kept.
    const structuralKey = useMemo(
        () => `${chartData.length}`,
        [chartData.length],
    );

    // Full data key: changes on every new tick. Used as an effect dep so the
    // series are re-rendered when fresh data arrives, even without a zoom reset.
    const dataKey = useMemo(() => {
        const first = chartData[0]?.tick;
        const last = chartData[chartData.length - 1]?.tick;
        return `${chartType}:${chartData.length}:${first}:${last}`;
    }, [chartData, chartType]);

    // Keep the tooltip event handler fresh without rebinding ZRender listeners.
    const liveDataRef = useRef({
        chartData,
        displayData,
        visibleKeys,
        getColor,
        viewMode,
    });
    useEffect(() => {
        liveDataRef.current = {
            chartData,
            displayData,
            visibleKeys,
            getColor,
            viewMode,
        };
    }, [chartData, displayData, visibleKeys, getColor, viewMode]);

    // ── ECharts option ────────────────────────────────────────────────────────

    const option = useMemo((): ECOption => {
        const ticks = chartData.map((d) => d.tick as number);

        // X-axis label: "now" for the most recent data point, relative in-game
        // time for all others. Uses currentTickRef so changes to currentTick
        // don't trigger a full option recompute (and zoom reset).
        const lastTick = ticks[ticks.length - 1] ?? -1;
        const formatXTick = (value: string | number): string => {
            const t = Number(value);
            if (t === lastTick) return "now";
            const ct = currentTickRef.current;
            if (!gameEngine || ct === undefined) return "--";
            return formatDuration(ct - t - 1, timeMode, gameEngine);
        };

        const formatYAxis =
            viewMode === "percent"
                ? (v: number) => `${v.toFixed(0)}%`
                : (v: number) => formatPower(v);

        // Visible tick count based on current zoom window (used for both bar
        // width and label interval selection).
        const plotWidth = 1.005 * Math.max(1, containerWidth - 90); // grid left:70 + right:20
        const visibleFraction = (zoomRange.end - zoomRange.start) / 100;
        const visibleTickCount = Math.max(
            1,
            Math.ceil(ticks.length * visibleFraction),
        );

        // Choose a round label interval that gives ~6 labels across the visible
        // range. We pick the closest "nice" duration from a fixed list, then
        // convert it to a data-point count. Falls back to ticks/7 when
        // game engine data isn't available yet.
        const NICE_INTERVALS_S = [
            60, 300, 600, 1800, 3600, 7200, 14400, 21600, 43200, 86400, 172800,
            432000, 604800, 1209600, 2592000,
        ];
        const tickResolution =
            ticks.length >= 2
                ? ((ticks[ticks.length - 1] ?? 0) - (ticks[0] ?? 0)) /
                  (ticks.length - 1)
                : 1;
        const secondsPerDataPoint = gameEngine
            ? tickResolution * gameEngine.game_seconds_per_tick
            : 0;
        const tickInterval = (() => {
            if (!secondsPerDataPoint)
                return Math.max(0, Math.round(ticks.length / 7) - 1);
            const visibleSeconds = visibleTickCount * secondsPerDataPoint;
            const targetSeconds = visibleSeconds / 6;
            const niceSeconds = NICE_INTERVALS_S.reduce((a, b) =>
                Math.abs(b - targetSeconds) < Math.abs(a - targetSeconds)
                    ? b
                    : a,
            );
            return Math.max(1, Math.round(niceSeconds / secondsPerDataPoint));
        })();

        // Stacked bars — zero-gap, no visible seams, 0-value series invisible.
        // barWidth is ceil(plotWidth / visibleTicks) so adjacent bars overlap
        // by 1px, closing sub-pixel rounding gaps without any visible artefact.
        const barWidth =
            ticks.length > 0 ? Math.ceil(plotWidth / visibleTickCount) : 1;
        const series: ECOption["series"] = visibleKeys.map((key) => ({
            name: key,
            type: "bar",
            stack: "total",
            barWidth,
            emphasis: { disabled: true },
            data: displayData.map((d) => Number(d[key] ?? 0)),
            itemStyle: { color: getColor(key), borderWidth: 0 },
            animation: false,
        }));

        return {
            animation: false,
            grid: { left: 70, right: 20, top: 15, bottom: 45 },
            xAxis: {
                type: "category",
                data: ticks,
                axisLabel: {
                    formatter: formatXTick,
                    fontSize: 11,
                    // Anchor labels from the right so they fall at round
                    // intervals counting back from "now". The rightmost index
                    // always gets a label ("now"); every tickInterval steps left
                    // gets another one. ECharts won't render labels that fall
                    // outside the visible zoom window, so "now" disappears
                    // naturally when the user zooms into older data.
                    interval: (index: number) =>
                        (ticks.length - 1 - index) % tickInterval === 0,
                    hideOverlap: true,
                },
                axisTick: { show: false },
                splitLine: { show: false },
            },
            yAxis: {
                type: "value",
                axisLabel: { formatter: formatYAxis, fontSize: 11 },
                min: 0,
                max: viewMode === "percent" ? 100 : undefined,
                splitLine: {
                    lineStyle: { color: "rgba(128,128,128,0.15)" },
                },
            },
            dataZoom: [
                {
                    type: "inside",
                    xAxisIndex: 0,
                    // start/end omitted — setOption merges only specified props,
                    // so the live zoom window is preserved on every barWidth update.
                    // Initial start:0/end:100 is set via the first notMerge setOption.
                    zoomLock: true,
                    zoomOnMouseWheel: false,
                    moveOnMouseMove: false,
                    moveOnMouseWheel: false,
                },
            ],
            toolbox: {
                show: true,
                feature: {
                    dataZoom: {
                        yAxisIndex: "none",
                        brushStyle: {
                            borderWidth: 1,
                            color: "rgba(99,102,241,0.12)",
                            borderColor: "rgba(99,102,241,0.5)",
                        },
                    },
                },
                // Icons are hidden; zoom mode is permanently activated via
                // takeGlobalCursor dispatch.
                iconStyle: { opacity: 0 },
                emphasis: { iconStyle: { opacity: 0 } },
                right: 80,
                bottom: 8,
            },
            // showContent: false keeps the vertical axis pointer visible but
            // suppresses ECharts' own popup — our React overlay handles display.
            tooltip: {
                trigger: "axis",
                showContent: false,
                axisPointer: {
                    type: "line",
                    lineStyle: {
                        color: "rgba(128,128,128,0.45)",
                        type: "solid",
                        width: 1,
                    },
                },
            },
            series,
        };
    }, [
        chartData,
        displayData,
        visibleKeys,
        getColor,
        viewMode,
        timeMode,
        gameEngine,
        containerWidth,
        zoomRange,
        // currentTick intentionally omitted — accessed via currentTickRef to
        // avoid resetting the zoom on every game tick.
    ]);

    // ── Chart lifecycle ───────────────────────────────────────────────────────

    useEffect(() => {
        if (!chartRef.current) return;
        const chart = echarts.init(chartRef.current, undefined, {
            renderer: "canvas",
        });
        instanceRef.current = chart;

        // Put the chart into permanent drag-to-select zoom mode.
        chart.dispatchAction({
            type: "takeGlobalCursor",
            key: "dataZoomSelect",
            dataZoomSelectActive: true,
        });

        // Track whether a zoom window is currently applied.
        chart.on("datazoom", () => {
            const opt = chart.getOption();
            const dz = Array.isArray(opt.dataZoom) ? opt.dataZoom[0] : null;
            if (dz) {
                const { start, end } = dz as { start?: number; end?: number };
                const s = start ?? 0;
                const e = end ?? 100;
                setIsZoomed(s > 0.5 || e < 99.5);
                setZoomRange({ start: s, end: e });
            }
        });

        // React tooltip: listen at the ZRender level so we receive every
        // mousemove over the canvas, even when no series is directly hit.
        const zr = chart.getZr();

        zr.on(
            "mousemove",
            (e: { offsetX: number; offsetY: number; event: Event }) => {
                const { offsetX, offsetY } = e;
                const nativeEvent = e.event as MouseEvent;

                if (!chart.containPixel("grid", [offsetX, offsetY])) {
                    setTooltip(null);
                    return;
                }

                const rawIndex = chart.convertFromPixel(
                    { xAxisIndex: 0 },
                    offsetX,
                ) as number;

                const {
                    chartData: cd,
                    displayData: dd,
                    visibleKeys: vk,
                    getColor: gc,
                    viewMode: vm,
                } = liveDataRef.current;

                if (!cd.length) return;

                const dataIndex = Math.max(
                    0,
                    Math.min(Math.round(rawIndex), cd.length - 1),
                );
                const tick = cd[dataIndex]?.tick as number;

                // Reverse stack order: topmost series appears first in tooltip.
                const items: TooltipItem[] = [...vk]
                    .reverse()
                    .map((key) => ({
                        key,
                        color: gc(key),
                        value: Number(dd[dataIndex]?.[key] ?? 0),
                    }))
                    .filter((item) => item.value > 0);

                if (!items.length) {
                    setTooltip(null);
                    return;
                }

                // Circles on the axis pointer line: one dot at the top of each
                // stacked segment. We convert cumulative data values → canvas
                // pixels, then add the chart div's client rect offset.
                const rect = chartRef.current?.getBoundingClientRect();
                const barPixelX = chart.convertToPixel(
                    { xAxisIndex: 0 },
                    dataIndex,
                ) as number;
                const barClientX = rect
                    ? rect.left + barPixelX
                    : nativeEvent.clientX;

                let cumulative = 0;
                const circles: Circle[] = vk.flatMap((key) => {
                    const val = Number(dd[dataIndex]?.[key] ?? 0);
                    cumulative += val;
                    if (val <= 0) return [];
                    const pixelY = chart.convertToPixel(
                        { yAxisIndex: 0 },
                        cumulative,
                    ) as number;
                    return [
                        {
                            clientX: barClientX,
                            clientY: rect
                                ? rect.top + pixelY
                                : nativeEvent.clientY,
                            color: gc(key),
                        },
                    ];
                });

                setTooltip({
                    tick,
                    items,
                    total: items.reduce((s, item) => s + item.value, 0),
                    viewMode: vm,
                    clientX: nativeEvent.clientX,
                    clientY: nativeEvent.clientY,
                    circles,
                });
            },
        );

        zr.on("mouseout", () => setTooltip(null));

        return () => {
            chart.off("datazoom");
            chart.getZr().off("mousemove");
            chart.getZr().off("mouseout");
            chart.dispose();
            instanceRef.current = null;
        };
    }, []);

    // Apply option updates with the right merge strategy:
    //   • notMerge: true  on structural changes (type / resolution) → resets zoom.
    //   • replaceMerge: ['series'] otherwise → zoom window preserved.
    //     This includes new-tick arrivals so the view just shifts left.
    useEffect(() => {
        const inst = instanceRef.current;
        if (!inst) return;

        dataKeyRef.current = dataKey;

        const isStructuralChange = structuralKey !== structuralKeyRef.current;
        structuralKeyRef.current = structuralKey;

        if (isStructuralChange) {
            inst.setOption(option, { notMerge: true });
            queueMicrotask(() => {
                setIsZoomed(false);
                setZoomRange({ start: 0, end: 100 });
            });
        } else {
            inst.setOption(option, { replaceMerge: ["series"] });
        }

        // Re-activate drag-to-zoom after each setOption because notMerge
        // resets the toolbox cursor state.
        inst.dispatchAction({
            type: "takeGlobalCursor",
            key: "dataZoomSelect",
            dataZoomSelectActive: true,
        });
    }, [option, dataKey, structuralKey]);

    // Respond to container resize.
    useEffect(() => {
        const el = chartRef.current;
        if (!el) return;
        const observer = new ResizeObserver(() => {
            instanceRef.current?.resize();
            setContainerWidth(el.offsetWidth);
        });
        observer.observe(el);
        setContainerWidth(el.offsetWidth);
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

    // ── Render ────────────────────────────────────────────────────────────────

    // The chart div is always rendered to keep the ECharts instance stable.
    // Loading and error states are overlaid on top so the chart never unmounts.
    return (
        <div className="relative">
            <div
                ref={chartRef}
                className="w-full"
                style={{ height: "500px" }}
            />

            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                    <RefreshCw className="w-5 h-5 animate-spin mr-2 text-muted-foreground" />
                    <span className="text-muted-foreground">Loading data…</span>
                </div>
            )}

            {isError && !isLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-alert-red">
                        Failed to load chart data
                    </span>
                </div>
            )}

            {isZoomed && (
                <button
                    onClick={handleResetZoom}
                    className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 text-xs bg-secondary hover:bg-secondary/80 border border-border rounded transition-colors text-foreground"
                    title="Reset zoom to full range"
                >
                    <ZoomOut className="w-3 h-3" />
                    Reset
                </button>
            )}

            {tooltip && !isLoading && (
                <>
                    {tooltip.circles.map((c, i) => (
                        <div
                            key={i}
                            style={{
                                position: "fixed",
                                left: c.clientX - 5,
                                top: c.clientY - 5,
                                width: 10,
                                height: 10,
                                borderRadius: "50%",
                                backgroundColor: c.color,
                                border: "2px solid white",
                                pointerEvents: "none",
                                zIndex: 9998,
                            }}
                        />
                    ))}
                    <PowerTooltip tooltip={tooltip} />
                </>
            )}
        </div>
    );
}

// ── PowerOverviewTable ────────────────────────────────────────────────────────

/**
 * Power overview table component that displays aggregated generation or
 * consumption data by facility type.
 *
 * Shows total energy generated/consumed over the selected period, installed
 * capacity, and used capacity for generation view.
 */

interface PowerOverviewTableProps {
    /** Chart type determining if we show generation or consumption table */
    chartType: ChartType;
    /** Chart data with time series for each facility type */
    chartData: Array<Record<string, number>>;
    /** Resolution in ticks per datapoint */
    resolution: number;
    /** Set of hidden facility types */
    hiddenFacilities: Set<string>;
    /** Callback when a facility visibility is toggled */
    onToggleFacility: (facilityType: string) => void;
}

interface FacilityRow {
    facilityType: string;
    totalEnergy: number;
    installedCapacity?: number;
    usedCapacity?: number;
}

type SortKey = "facility" | "energy" | "capacity" | "used";
type SortDirection = "asc" | "desc";

/**
 * Power overview table showing aggregated generation or consumption data.
 *
 * For generation mode:
 *
 * - Facility name
 * - Total generated energy over the period
 * - Installed capacity
 * - Used capacity (percentage)
 *
 * For consumption mode:
 *
 * - Facility name
 * - Total consumed energy over the period
 */
export function PowerOverviewTable({
    chartType,
    chartData,
    resolution,
    hiddenFacilities,
    onToggleFacility,
}: PowerOverviewTableProps) {
    const [sortKey, setSortKey] = useState<SortKey>("energy");
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

    const { data: facilitiesData } = useFacilities();
    const { data: gameEngine } = useGameEngine();
    const isGeneration = chartType === "power-sources";

    // Check if all facilities are hidden
    const allHidden = useMemo(() => {
        if (chartData.length === 0) return false;
        const facilityTypes = new Set<string>();
        chartData.forEach((dataPoint) => {
            Object.keys(dataPoint).forEach((key) => {
                if (key !== "tick") {
                    facilityTypes.add(key);
                }
            });
        });
        return (
            facilityTypes.size > 0 &&
            Array.from(facilityTypes).every((type) =>
                hiddenFacilities.has(type),
            )
        );
    }, [chartData, hiddenFacilities]);

    const handleToggleAll = () => {
        if (chartData.length === 0) return;
        const facilityTypes = new Set<string>();
        chartData.forEach((dataPoint) => {
            Object.keys(dataPoint).forEach((key) => {
                if (key !== "tick") {
                    facilityTypes.add(key);
                }
            });
        });

        // If all are hidden, show all. Otherwise, hide all.
        if (allHidden) {
            // Show all - remove all from hidden set
            facilityTypes.forEach((type) => {
                if (hiddenFacilities.has(type)) {
                    onToggleFacility(type);
                }
            });
        } else {
            // Hide all - add all to hidden set
            facilityTypes.forEach((type) => {
                if (!hiddenFacilities.has(type)) {
                    onToggleFacility(type);
                }
            });
        }
    };

    // Calculate aggregated data for each facility type
    const facilityRows = useMemo(() => {
        if (chartData.length === 0) return [];
        if (!gameEngine) return [];

        // Get all facility types from the chart data
        const facilityTypes = new Set<string>();
        chartData.forEach((dataPoint) => {
            Object.keys(dataPoint).forEach((key) => {
                if (key !== "tick") {
                    facilityTypes.add(key);
                }
            });
        });

        // Calculate totals for each facility type
        const rows: FacilityRow[] = Array.from(facilityTypes).map(
            (facilityType) => {
                // Sum all power values and multiply by resolution to get total energy
                const totalEnergy = chartData.reduce((sum, dataPoint) => {
                    const power = dataPoint[facilityType] || 0;
                    // Energy = Power × Time
                    // resolution is ticks per datapoint, game_seconds_per_tick is game seconds per tick
                    // Energy (Wh) = Power (W) × Time (hours)
                    const timeInHours =
                        (resolution * gameEngine.game_seconds_per_tick) / 3600;
                    return sum + power * timeInHours;
                }, 0);

                const row: FacilityRow = {
                    facilityType,
                    totalEnergy,
                };

                // For generation view, calculate installed capacity and usage
                if (isGeneration && facilitiesData) {
                    const facilities = facilitiesData.power_facilities.filter(
                        (f) => f.facility === facilityType,
                    );

                    if (facilities.length > 0) {
                        const installedCapacity = facilities.reduce(
                            (sum, f) => sum + f.max_power_generation,
                            0,
                        );
                        row.installedCapacity = installedCapacity;

                        // Calculate used capacity as percentage
                        // Average power over the period / installed capacity
                        const timeInHours =
                            (resolution * gameEngine.game_seconds_per_tick) /
                            3600;
                        const avgPower =
                            totalEnergy / (chartData.length * timeInHours);
                        row.usedCapacity =
                            installedCapacity > 0
                                ? (avgPower / installedCapacity) * 100
                                : 0;
                    }
                }

                return row;
            },
        );

        // Filter out rows with zero energy
        return rows.filter((row) => row.totalEnergy > 0);
    }, [chartData, resolution, isGeneration, facilitiesData, gameEngine]);

    // Sort facility rows
    const sortedRows = useMemo(() => {
        const sorted = [...facilityRows];
        sorted.sort((a, b) => {
            let aVal: number | string;
            let bVal: number | string;

            switch (sortKey) {
                case "facility":
                    aVal = a.facilityType;
                    bVal = b.facilityType;
                    break;
                case "energy":
                    aVal = a.totalEnergy;
                    bVal = b.totalEnergy;
                    break;
                case "capacity":
                    aVal = a.installedCapacity ?? 0;
                    bVal = b.installedCapacity ?? 0;
                    break;
                case "used":
                    aVal = a.usedCapacity ?? 0;
                    bVal = b.usedCapacity ?? 0;
                    break;
                default:
                    return 0;
            }

            if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
            if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
            return 0;
        });

        return sorted;
    }, [facilityRows, sortKey, sortDirection]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            // Toggle direction
            setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
        } else {
            setSortKey(key);
            setSortDirection("desc");
        }
    };

    const getSortIndicator = (key: SortKey) => {
        if (sortKey !== key) return null;
        return sortDirection === "asc" ? " ▲" : " ▼";
    };

    if (sortedRows.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500">
                No data available for this period
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-secondary">
                        <th
                            className="py-3 px-4 text-left font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                            onClick={() => handleSort("facility")}
                        >
                            Facility{getSortIndicator("facility")}
                        </th>
                        <th
                            className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                            onClick={() => handleSort("energy")}
                        >
                            {isGeneration ? "Generated" : "Consumed"}
                            {getSortIndicator("energy")}
                        </th>
                        {isGeneration && (
                            <>
                                <th
                                    className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                                    onClick={() => handleSort("capacity")}
                                >
                                    Installed Cap.
                                    {getSortIndicator("capacity")}
                                </th>
                                <th
                                    className="py-3 px-4 text-center font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors min-w-37.5"
                                    onClick={() => handleSort("used")}
                                >
                                    Used Capacity
                                    {getSortIndicator("used")}
                                </th>
                            </>
                        )}
                        <th className="py-3 px-4 text-center font-semibold">
                            <button
                                onClick={handleToggleAll}
                                className="px-3 py-1 text-xs font-semibold bg-brand hover:bg-brand/80 text-white rounded transition-colors"
                            >
                                {allHidden ? "Show All" : "Hide All"}
                            </button>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {sortedRows.map((row) => {
                        const isVisible = !hiddenFacilities.has(
                            row.facilityType,
                        );
                        return (
                            <tr
                                key={row.facilityType}
                                className="border-b border-border/30 hover:bg-tan-green/20 dark:hover:bg-muted/30 transition-colors"
                            >
                                <td className="py-3 px-4">
                                    <div className="flex items-center gap-2">
                                        <FacilityIcon
                                            facility={row.facilityType}
                                            size={20}
                                        />
                                        <FacilityName
                                            facility={row.facilityType}
                                            mode="long"
                                        />
                                    </div>
                                </td>
                                <td className="py-3 px-4 text-right font-mono">
                                    {formatEnergy(row.totalEnergy)}
                                </td>
                                {isGeneration && (
                                    <>
                                        <td className="py-3 px-4 text-right font-mono">
                                            {row.installedCapacity !== undefined
                                                ? formatPower(
                                                      row.installedCapacity,
                                                  )
                                                : "-"}
                                        </td>
                                        <td className="py-3 px-4 text-center min-w-37.5">
                                            {row.usedCapacity !== undefined ? (
                                                <FacilityGauge
                                                    facilityType={
                                                        row.facilityType
                                                    }
                                                    value={row.usedCapacity}
                                                />
                                            ) : (
                                                <span className="text-center block">
                                                    -
                                                </span>
                                            )}
                                        </td>
                                    </>
                                )}
                                <td className="py-3 px-4 text-center">
                                    <button
                                        onClick={() =>
                                            onToggleFacility(row.facilityType)
                                        }
                                        className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                                            isVisible
                                                ? "bg-brand hover:bg-brand/80 text-white"
                                                : "bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300"
                                        }`}
                                    >
                                        {isVisible ? "Hide" : "Show"}
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
