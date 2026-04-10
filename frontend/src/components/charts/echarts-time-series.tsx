/**
 * Generic ECharts time-series chart replacing the old Recharts TimeSeriesChart.
 *
 * "area" variant renders as zero-gap stacked bars (like PowerChart).
 * "steppedLine" and "smoothLine" render as line series.
 *
 * Features shared across all variants:
 *
 * - Right-anchored "now" tick label with adaptive round intervals
 * - Drag-to-zoom with zoom preservation on new data
 * - React tooltip overlay with colored circles on the axis pointer
 */

import { BarChart as EBarChart, LineChart as ELineChart } from "echarts/charts";
import type { BarSeriesOption, LineSeriesOption } from "echarts/charts";
import {
    DataZoomComponent,
    GridComponent,
    MarkLineComponent,
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
import { ZoomOut } from "lucide-react";
import {
    type ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import { FacilityIcon } from "@/components/ui/asset-icon";
import { FacilityName } from "@/components/ui/asset-name";
import { useTimeMode } from "@/contexts/time-mode-context";
import { useGameEngine } from "@/hooks/use-game";
import { useGameTick } from "@/hooks/use-game-tick";
import { getAssetIcon } from "@/lib/assets/asset-icons";
import { getAssetLongName } from "@/lib/assets/asset-names";
import {
    KEY_ORDER_BY_CHART_TYPE,
    reorderObjectKeys,
} from "@/lib/charts/key-order";
import { formatDuration } from "@/lib/format-utils";
import type { ChartType } from "@/types/charts";

// Register ECharts components once at module level (tree-shaking)
echarts.use([
    EBarChart,
    ELineChart,
    GridComponent,
    TooltipComponent,
    DataZoomComponent,
    ToolboxComponent,
    MarkLineComponent,
    CanvasRenderer,
]);

type ECOption = ComposeOption<
    | BarSeriesOption
    | LineSeriesOption
    | GridComponentOption
    | TooltipComponentOption
    | DataZoomComponentOption
    | ToolboxComponentOption
>;

export type ChartVariant = "area" | "steppedLine" | "smoothLine";

/** Configuration for EChartsTimeSeries. */
export interface EChartsTimeSeriesConfig {
    /** Chart type for key ordering */
    chartType?: ChartType;
    /**
     * Visual variant ("area" = stacked bars, "steppedLine" / "smoothLine" =
     * lines)
     */
    chartVariant: ChartVariant;
    /** Whether to stack multiple series */
    stacked?: boolean;
    /** Height in pixels (default 500) */
    height?: number;
    /** Color getter per series key */
    getColor?: (key: string) => string;
    /** Data key filters applied in order */
    filterDataKeys?: Array<(key: string, data: unknown[]) => boolean>;
    /** Y-axis label formatter */
    formatYAxis?: (value: number) => string;
    /** Tooltip value formatter */
    formatValue: (value: number) => ReactNode;
    /** Tooltip label formatter (default: getAssetLongName or raw key) */
    formatLabel?: (key: string) => ReactNode;
    /**
     * Keys whose bars are colored green when positive, red when negative. For
     * "area" variant bars this replaces the old linear gradient. For line
     * variants a green/red linear gradient fill is still used.
     */
    gradientKeys?: string[];
    /** Whether to hide zero values in tooltip (default true) */
    hideZeroValues?: boolean;
    referenceLines?: Array<{ x: number; label?: string }>;
    /** Y-axis minimum (default: auto) */
    yAxisMin?: number;
    /** Y-axis maximum (default: auto) */
    yAxisMax?: number;
}

export interface EChartsTimeSeriesProps {
    data: Array<Record<string, unknown>>;
    config: EChartsTimeSeriesConfig;
    isLoading?: boolean;
    isError?: boolean;
}

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

// ── Tooltip overlay ───────────────────────────────────────────────────────────

interface Circle {
    clientX: number;
    clientY: number;
    color: string;
}

interface TooltipEntry {
    key: string;
    color: string;
    value: number;
    label: ReactNode;
}

interface TSTooltipState {
    clientX: number;
    clientY: number;
    tick: number;
    entries: TooltipEntry[];
    stacked: boolean;
    circles: Circle[];
}

function TSTooltip({
    tooltip,
    formatValue,
}: {
    tooltip: TSTooltipState;
    formatValue: (v: number) => ReactNode;
}) {
    const { currentTick } = useGameTick();
    const { mode: timeMode } = useTimeMode();
    const { data: gameEngine } = useGameEngine();

    const timestamp =
        gameEngine && currentTick !== undefined
            ? `${formatDuration(currentTick - tooltip.tick - 1, timeMode, gameEngine)} ago`
            : "--";

    const total = tooltip.stacked
        ? tooltip.entries.reduce((s, e) => s + e.value, 0)
        : null;

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
                    {tooltip.entries.map((entry) => (
                        <tr key={entry.key}>
                            <td className="pr-1 align-middle">
                                <div
                                    className="w-2.5 h-2.5 rounded-sm inline-block"
                                    style={{ backgroundColor: entry.color }}
                                />
                            </td>
                            <td className="pr-3 whitespace-nowrap align-middle">
                                {entry.label}
                            </td>
                            <td className="text-right font-mono whitespace-nowrap align-middle">
                                {formatValue(entry.value)}
                            </td>
                        </tr>
                    ))}
                    {total !== null && (
                        <tr className="border-t border-border/50">
                            <td
                                colSpan={2}
                                className="pt-1 pr-3 font-semibold align-middle"
                            >
                                Total
                            </td>
                            <td className="pt-1 text-right font-mono font-semibold whitespace-nowrap align-middle">
                                {formatValue(total)}
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}

// ── Nice tick intervals (game-seconds) ───────────────────────────────────────

const NICE_INTERVALS_S = [
    60, 300, 600, 1800, 3600, 7200, 14400, 21600, 43200, 86400, 172800, 432000,
    604800, 1209600, 2592000,
];

// ── EChartsTimeSeries ─────────────────────────────────────────────────────────

/**
 * Generic ECharts time-series chart component.
 *
 * Callers should memoize the `config` object to prevent unnecessary re-renders.
 */
export function EChartsTimeSeries({
    data,
    config,
    isLoading = false,
    isError = false,
}: EChartsTimeSeriesProps) {
    const chartRef = useRef<HTMLDivElement>(null);
    const instanceRef = useRef<echarts.ECharts | null>(null);
    const dataKeyRef = useRef<string>("");
    const structuralKeyRef = useRef<string>("");

    const [isZoomed, setIsZoomed] = useState(false);
    const [tooltip, setTooltip] = useState<TSTooltipState | null>(null);
    const [containerWidth, setContainerWidth] = useState(0);
    const [zoomRange, setZoomRange] = useState({ start: 0, end: 100 });

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

    // Reorder data keys according to chartType's predefined ordering
    const processedData = useMemo(() => {
        if (!config.chartType) return data;
        const keyOrder = KEY_ORDER_BY_CHART_TYPE[config.chartType];
        return data.map((dp) => reorderObjectKeys(dp, keyOrder));
    }, [data, config.chartType]);

    // Extract and filter visible series keys
    const visibleKeys = useMemo(() => {
        if (processedData.length === 0) return [];
        const firstPoint = processedData[0];
        if (!firstPoint) return [];
        const allKeys = Object.keys(firstPoint).filter((k) => k !== "tick");
        if (!config.filterDataKeys) return allKeys;
        return allKeys.filter((key) =>
            config.filterDataKeys!.every((f) => f(key, processedData)),
        );
    }, [processedData, config.filterDataKeys]);

    // Structural key: triggers a full zoom reset when chart identity or
    // resolution changes. New ticks arriving with the same data length
    // keep the same key so the current zoom window is preserved.
    const structuralKey = useMemo(
        () =>
            `${config.chartType}:${config.chartVariant}:${config.stacked}:${data.length}`,
        [data.length, config.chartType, config.chartVariant, config.stacked],
    );

    // Full data key: changes on every new tick arrival. Used as effect dep so
    // series are re-rendered on fresh data even without a zoom reset.
    const dataKey = useMemo(() => {
        const first = data[0]?.tick;
        const last = data[data.length - 1]?.tick;
        return `${config.chartType}:${config.chartVariant}:${config.stacked}:${data.length}:${first}:${last}`;
    }, [data, config.chartType, config.chartVariant, config.stacked]);

    // Live ref keeps tooltip/circle handlers fresh without rebinding ZRender
    // listeners or triggering option recomputation.
    const liveDataRef = useRef({
        processedData,
        visibleKeys,
        getColor: config.getColor,
        hideZeroValues: config.hideZeroValues ?? true,
        formatLabel: config.formatLabel,
        stacked: config.stacked ?? false,
    });
    useEffect(() => {
        liveDataRef.current = {
            processedData,
            visibleKeys,
            getColor: config.getColor,
            hideZeroValues: config.hideZeroValues ?? true,
            formatLabel: config.formatLabel,
            stacked: config.stacked ?? false,
        };
    }, [
        processedData,
        visibleKeys,
        config.getColor,
        config.hideZeroValues,
        config.formatLabel,
        config.stacked,
    ]);

    // Forward wheel events to the page so trackpad/mouse scroll works normally.
    // ECharts' ZRender calls stopPropagation(), so we need capture phase.
    useEffect(() => {
        const el = chartRef.current;
        if (!el) return;
        const handler = (e: WheelEvent) => window.scrollBy(0, e.deltaY);
        el.addEventListener("wheel", handler, { capture: true, passive: true });
        return () =>
            el.removeEventListener("wheel", handler, { capture: true });
    }, []);

    // ── ECharts option ────────────────────────────────────────────────────────

    const option = useMemo((): ECOption => {
        const ticks = processedData.map((d) => d.tick as number);
        const isBar = config.chartVariant === "area";

        // "now" label for the rightmost data point; relative in-game time for
        // all others. Uses currentTickRef so currentTick changes don't trigger
        // a full option recompute (and zoom reset) on every game tick.
        const lastTick = ticks[ticks.length - 1] ?? -1;
        const formatXTick = (value: string | number): string => {
            const t = Number(value);
            if (t === lastTick) return "now";
            const ct = currentTickRef.current;
            if (!gameEngine || ct === undefined) return "--";
            return formatDuration(ct - t - 1, timeMode, gameEngine);
        };

        // Visible tick count based on current zoom window — drives both barWidth
        // (bars only) and tick label interval selection (all variants).
        const visibleFraction = (zoomRange.end - zoomRange.start) / 100;
        const visibleTickCount = Math.max(
            1,
            Math.ceil(ticks.length * visibleFraction),
        );

        // Choose a round label interval giving ~6 labels across the visible
        // range. Falls back to ticks/7 when game engine data isn't available yet.
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

        // Stacked bar width: ceil so adjacent bars overlap by 1px, closing
        // sub-pixel rounding gaps. plotWidth mirrors the grid margins (l:70, r:20).
        const plotWidth = 1.005 * Math.max(1, containerWidth - 90);
        const barWidth =
            ticks.length > 0 ? Math.ceil(plotWidth / visibleTickCount) : 1;

        // Resolve CSS variables for canvas renderer
        const primaryColor = resolveCSSVar("--primary");
        const mutedColor = resolveCSSVar("--muted-foreground");
        const successColor = resolveCSSVar("--success");
        const destructiveColor = resolveCSSVar("--destructive");

        // Gradient offsets for line-variant gradient fills
        const gradientOffsets: Record<string, number> = {};
        if (!isBar) {
            for (const key of config.gradientKeys ?? []) {
                const values = processedData
                    .map((d) =>
                        typeof d[key] === "number" ? (d[key] as number) : 0,
                    )
                    .filter((v) => !isNaN(v));
                if (values.length === 0) continue;
                const dataMax = Math.max(...values);
                const dataMin = Math.min(...values);
                if (dataMax <= 0) gradientOffsets[key] = 0;
                else if (
                    dataMin >= 0 ||
                    Math.abs(dataMin) < (dataMax - dataMin) * 0.01
                )
                    gradientOffsets[key] = 1;
                else gradientOffsets[key] = dataMax / (dataMax - dataMin);
            }
        }

        const allRefLines = [...(config.referenceLines ?? [])];

        const series: ECOption["series"] = visibleKeys.map((key) => {
            const rawColor = config.getColor?.(key) ?? "#888";
            const color = resolveColor(rawColor);
            const useGradient = (config.gradientKeys ?? []).includes(key);

            if (isBar) {
                // "area" → stacked bars, 0-gap, 1px overlap to seal sub-pixel seams.
                // Gradient keys: color each bar green (≥0) or red (<0) by value.
                return {
                    name: key,
                    type: "bar",
                    stack: config.stacked ? "total" : undefined,
                    barWidth,
                    emphasis: { disabled: true },
                    data: processedData.map((d) => Number(d[key] ?? 0)),
                    itemStyle: {
                        borderWidth: 0,
                        color: useGradient
                            ? (params: { value: unknown }) =>
                                  Number(params.value) >= 0
                                      ? successColor
                                      : destructiveColor
                            : color,
                    },
                    animation: false,
                } satisfies BarSeriesOption;
            }

            // Line variants
            const base: LineSeriesOption = {
                name: key,
                type: "line",
                symbol: "none",
                stack: config.stacked ? "total" : undefined,
                emphasis: { disabled: true },
                data: processedData.map((d) => Number(d[key] ?? 0)),
                itemStyle: { color },
                animation: false,
            };

            if (config.chartVariant === "smoothLine") {
                const areaColor = useGradient
                    ? new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                          { offset: 0, color: successColor },
                          {
                              offset: gradientOffsets[key] ?? 0.5,
                              color: successColor,
                          },
                          {
                              offset: gradientOffsets[key] ?? 0.5,
                              color: destructiveColor,
                          },
                          { offset: 1, color: destructiveColor },
                      ])
                    : undefined;
                return {
                    ...base,
                    smooth: true,
                    lineStyle: { width: 2, color },
                    ...(areaColor
                        ? { areaStyle: { opacity: 0.3, color: areaColor } }
                        : {}),
                };
            }

            // steppedLine
            const areaColor = useGradient
                ? new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                      { offset: 0, color: successColor },
                      {
                          offset: gradientOffsets[key] ?? 0.5,
                          color: successColor,
                      },
                      {
                          offset: gradientOffsets[key] ?? 0.5,
                          color: destructiveColor,
                      },
                      { offset: 1, color: destructiveColor },
                  ])
                : undefined;
            return {
                ...base,
                step: "end",
                lineStyle: { width: 2, color },
                ...(areaColor
                    ? { areaStyle: { opacity: 0.3, color: areaColor } }
                    : {}),
            };
        });

        // Attach reference lines to the first visible series via markLine
        if (series.length > 0 && allRefLines.length > 0) {
            (series[0] as LineSeriesOption).markLine = {
                silent: true,
                symbol: ["none", "none"],
                data: allRefLines.map((rl) => ({
                    xAxis: rl.x,
                    name: rl.label ?? "",
                })),
                lineStyle: { color: primaryColor, type: "dashed", width: 2 },
                label: {
                    formatter: "{b}",
                    position: "insideStartTop",
                    color: mutedColor,
                    fontSize: 12,
                },
            };
        }

        return {
            animation: false,
            grid: { left: 70, right: 20, top: 15, bottom: 45 },
            xAxis: {
                type: "category",
                data: ticks,
                // boundaryGap: true (default) for bars so first bar isn't cut;
                // false for lines so the series starts at the left edge.
                boundaryGap: isBar,
                axisLabel: {
                    formatter: formatXTick,
                    fontSize: 11,
                    // Right-anchored interval: the rightmost data point always
                    // gets the "now" label; every tickInterval steps leftward
                    // gets another label at a round duration.
                    interval: (index: number) =>
                        (ticks.length - 1 - index) % tickInterval === 0,
                    hideOverlap: true,
                },
                axisTick: { show: false },
                splitLine: { show: false },
            },
            yAxis: {
                type: "value",
                axisLabel: { formatter: config.formatYAxis, fontSize: 11 },
                min: config.yAxisMin,
                max: config.yAxisMax,
                splitLine: {
                    lineStyle: { color: "rgba(128,128,128,0.15)" },
                },
            },
            dataZoom: [
                {
                    type: "inside",
                    xAxisIndex: 0,
                    // start/end omitted — preserves live zoom window across
                    // every setOption call. Initial 0/100 is set by the first
                    // notMerge call in the apply-options effect.
                    zoomLock: true,
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
                // Icons hidden; zoom mode permanently activated via
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
        processedData,
        visibleKeys,
        config,
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

        // React tooltip: listen at the ZRender level to receive every
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
                    processedData: pd,
                    visibleKeys: vk,
                    getColor: gc,
                    hideZeroValues: hzv,
                    formatLabel: fl,
                    stacked: st,
                } = liveDataRef.current;

                if (!pd.length) return;

                const dataIndex = Math.max(
                    0,
                    Math.min(Math.round(rawIndex), pd.length - 1),
                );
                const tick = pd[dataIndex]?.tick as number;

                // Stacked charts: topmost series first in tooltip; others: natural order
                const orderedKeys = st ? [...vk].reverse() : vk;

                const entries: TooltipEntry[] = orderedKeys
                    .map((key) => {
                        const rawColor = gc?.(key) ?? "#888";
                        const color = resolveColor(rawColor);
                        const value = Number(pd[dataIndex]?.[key] ?? 0);
                        // Show facility icon + name when the key maps to a known
                        // asset; fall back to text for synthetic keys (e.g.
                        // "temperature", "CO2", "net-profit").
                        const label: ReactNode = fl ? (
                            fl(key)
                        ) : getAssetIcon(key) ? (
                            <div className="flex items-center gap-1">
                                <FacilityIcon facility={key} size={14} />
                                <FacilityName facility={key} mode="long" />
                            </div>
                        ) : (
                            getAssetLongName(key)
                        );
                        return { key, color, value, label };
                    })
                    .filter((e) => !hzv || e.value !== 0);

                if (!entries.length) {
                    setTooltip(null);
                    return;
                }

                // Circles on the axis pointer line: one dot per visible non-zero series.
                // For stacked charts: at the cumulative top of each segment.
                // For non-stacked: at each series' own value.
                const rect = chartRef.current?.getBoundingClientRect();
                const pixelX = chart.convertToPixel(
                    { xAxisIndex: 0 },
                    dataIndex,
                ) as number;
                const lineClientX = rect
                    ? rect.left + pixelX
                    : nativeEvent.clientX;

                const circles: Circle[] = [];
                if (st) {
                    let cumulative = 0;
                    for (const key of vk) {
                        const val = Number(pd[dataIndex]?.[key] ?? 0);
                        cumulative += val;
                        if (val <= 0) continue;
                        const pixelY = chart.convertToPixel(
                            { yAxisIndex: 0 },
                            cumulative,
                        ) as number;
                        circles.push({
                            clientX: lineClientX,
                            clientY: rect
                                ? rect.top + pixelY
                                : nativeEvent.clientY,
                            color: resolveColor(gc?.(key) ?? "#888"),
                        });
                    }
                } else {
                    for (const key of vk) {
                        const val = Number(pd[dataIndex]?.[key] ?? 0);
                        if (val === 0 && hzv) continue;
                        const pixelY = chart.convertToPixel(
                            { yAxisIndex: 0 },
                            val,
                        ) as number;
                        circles.push({
                            clientX: lineClientX,
                            clientY: rect
                                ? rect.top + pixelY
                                : nativeEvent.clientY,
                            color: resolveColor(gc?.(key) ?? "#888"),
                        });
                    }
                }

                setTooltip({
                    clientX: nativeEvent.clientX,
                    clientY: nativeEvent.clientY,
                    tick,
                    entries,
                    stacked: st,
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

    // Respond to container resize — also updates containerWidth so barWidth
    // recomputes on the next option useMemo run.
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

    const height = config.height ?? 500;

    // Chart div always rendered to keep the ECharts instance stable.
    // Loading and error states are overlaid so the chart never unmounts.
    return (
        <div className="relative">
            <div
                ref={chartRef}
                className="w-full"
                style={{ height: `${height}px` }}
            />

            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80">
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
                    {tooltip.circles.map((c) => (
                        <div
                            key={c.color}
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
                    <TSTooltip
                        tooltip={tooltip}
                        formatValue={config.formatValue}
                    />
                </>
            )}
        </div>
    );
}
