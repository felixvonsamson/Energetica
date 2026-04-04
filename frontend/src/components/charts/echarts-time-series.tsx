/**
 * Generic ECharts time-series chart replacing the old Recharts TimeSeriesChart.
 *
 * Supports area (stacked stepped), steppedLine, and smoothLine variants with
 * drag-to-zoom, React tooltip overlay, and configurable reference lines.
 */

import { LineChart as ELineChart } from "echarts/charts";
import type { LineSeriesOption } from "echarts/charts";
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

import { useTimeMode } from "@/contexts/time-mode-context";
import { useGameEngine } from "@/hooks/use-game";
import { useGameTick } from "@/hooks/use-game-tick";
import { getAssetLongName } from "@/lib/assets/asset-names";
import {
    KEY_ORDER_BY_CHART_TYPE,
    reorderObjectKeys,
} from "@/lib/charts/key-order";
import { formatDuration } from "@/lib/format-utils";
import type { ChartType } from "@/types/charts";

// Register ECharts components (tree-shaking; safe to call multiple times)
echarts.use([
    ELineChart,
    GridComponent,
    TooltipComponent,
    DataZoomComponent,
    ToolboxComponent,
    MarkLineComponent,
    CanvasRenderer,
]);

type ECOption = ComposeOption<
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
    /** Visual variant */
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
    /** Keys to fill with profit/loss gradient (success above 0, destructive below) */
    gradientKeys?: string[];
    /** Whether to hide zero values in tooltip (default true) */
    hideZeroValues?: boolean;
    /** Extra reference lines beyond the automatic Game Start line at x=0 */
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

/**
 * Resolves a CSS variable name (e.g. "--primary") to its computed color value,
 * following one level of var() indirection. Used to translate CSS custom
 * properties into concrete color strings for the ECharts Canvas renderer.
 */
function resolveCSSVar(varName: string): string {
    if (typeof document === "undefined") return "#888";
    const root = document.documentElement;
    let val = getComputedStyle(root).getPropertyValue(varName).trim();
    // Follow one level of var() reference
    const m = val.match(/^var\(([^,)]+)/);
    if (m?.[1]) val = getComputedStyle(root).getPropertyValue(m[1]).trim();
    return val || "#888";
}

/** Resolves "var(--foo)" strings to concrete color values. */
function resolveColor(color: string): string {
    if (!color.startsWith("var(")) return color;
    const varName = color.match(/^var\(([^,)]+)/)?.[1];
    if (!varName) return color;
    return resolveCSSVar(varName);
}

// ── Tooltip overlay ───────────────────────────────────────────────────────────

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

    const [isZoomed, setIsZoomed] = useState(false);
    const [tooltip, setTooltip] = useState<TSTooltipState | null>(null);

    const { mode: timeMode } = useTimeMode();
    const { data: gameEngine } = useGameEngine();
    const { currentTick } = useGameTick();

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

    // Stable string identifying the current dataset (triggers zoom reset when changed)
    const dataKey = useMemo(() => {
        const first = data[0]?.tick;
        const last = data[data.length - 1]?.tick;
        return `${config.chartType}:${config.chartVariant}:${config.stacked}:${data.length}:${first}:${last}`;
    }, [data, config.chartType, config.chartVariant, config.stacked]);

    // Live ref used inside ZRender event handlers to avoid stale closures
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

    // ── ECharts option ────────────────────────────────────────────────────────

    const option = useMemo((): ECOption => {
        const ticks = processedData.map((d) => d.tick as number);
        const tickInterval = Math.max(0, Math.round(ticks.length / 7) - 1);

        const formatXTick = (value: string | number): string => {
            const t = Number(value);
            const ct = currentTickRef.current;
            if (!gameEngine || ct === undefined) return "--";
            return formatDuration(ct - t - 1, timeMode, gameEngine);
        };

        // Resolve CSS variables for canvas renderer
        const primaryColor = resolveCSSVar("--primary");
        const mutedColor = resolveCSSVar("--muted-foreground");
        const successColor = resolveCSSVar("--success");
        const destructiveColor = resolveCSSVar("--destructive");

        // Compute gradient offsets for gradient-filled series
        const gradientOffsets: Record<string, number> = {};
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
            else if (dataMin >= 0 || Math.abs(dataMin) < (dataMax - dataMin) * 0.01)
                gradientOffsets[key] = 1;
            else gradientOffsets[key] = dataMax / (dataMax - dataMin);
        }

        const allRefLines = [
            { x: 0, label: "Game Start" },
            ...(config.referenceLines ?? []),
        ];

        const series: ECOption["series"] = visibleKeys.map((key) => {
            const rawColor = config.getColor?.(key) ?? "#888";
            const color = resolveColor(rawColor);
            const useGradient = (config.gradientKeys ?? []).includes(key);
            const gradientOffset = gradientOffsets[key] ?? 0.5;

            const areaColor = useGradient
                ? new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                      { offset: 0, color: successColor },
                      { offset: gradientOffset, color: successColor },
                      { offset: gradientOffset, color: destructiveColor },
                      { offset: 1, color: destructiveColor },
                  ])
                : color;

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
                return {
                    ...base,
                    smooth: true,
                    lineStyle: { width: 2, color },
                };
            }
            if (config.chartVariant === "steppedLine") {
                return {
                    ...base,
                    step: "end",
                    lineStyle: { width: 2, color },
                };
            }
            // "area" variant: stepped filled area, no visible line
            return {
                ...base,
                step: "end",
                areaStyle: { opacity: 1, color: areaColor },
                lineStyle: { width: 0, opacity: 0 },
            };
        });

        // Attach reference lines to the first visible series via markLine
        if (series.length > 0) {
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
                axisLabel: {
                    formatter: formatXTick,
                    fontSize: 11,
                    interval: tickInterval,
                    hideOverlap: true,
                },
                axisTick: { show: false },
                splitLine: { show: false },
                boundaryGap: false,
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
                    start: 0,
                    end: 100,
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
                iconStyle: { opacity: 0 },
                emphasis: { iconStyle: { opacity: 0 } },
                right: 80,
                bottom: 8,
            },
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
        // currentTick intentionally omitted — accessed via currentTickRef
    ]);

    // ── Chart lifecycle ───────────────────────────────────────────────────────

    useEffect(() => {
        if (!chartRef.current) return;
        const chart = echarts.init(chartRef.current, undefined, {
            renderer: "canvas",
        });
        instanceRef.current = chart;

        chart.dispatchAction({
            type: "takeGlobalCursor",
            key: "dataZoomSelect",
            dataZoomSelectActive: true,
        });

        chart.on("datazoom", () => {
            const opt = chart.getOption();
            const dz = Array.isArray(opt.dataZoom) ? opt.dataZoom[0] : null;
            if (dz) {
                const { start, end } = dz as { start?: number; end?: number };
                setIsZoomed((start ?? 0) > 0.5 || (end ?? 100) < 99.5);
            }
        });

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

                // Stacked charts: topmost series first; others: natural order
                const orderedKeys = st ? [...vk].reverse() : vk;

                const entries: TooltipEntry[] = orderedKeys
                    .map((key) => {
                        const rawColor = gc?.(key) ?? "#888";
                        const color = resolveColor(rawColor);
                        const value = Number(pd[dataIndex]?.[key] ?? 0);
                        const label: ReactNode = fl
                            ? fl(key)
                            : getAssetLongName(key);
                        return { key, color, value, label };
                    })
                    .filter((e) => !hzv || e.value !== 0);

                if (!entries.length) {
                    setTooltip(null);
                    return;
                }

                setTooltip({
                    clientX: nativeEvent.clientX,
                    clientY: nativeEvent.clientY,
                    tick,
                    entries,
                    stacked: st,
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

    // Apply option with zoom-preserving or zoom-resetting merge strategy
    useEffect(() => {
        const inst = instanceRef.current;
        if (!inst) return;

        const isDataReset = dataKey !== dataKeyRef.current;
        dataKeyRef.current = dataKey;

        if (isDataReset) {
            inst.setOption(option, { notMerge: true });
            queueMicrotask(() => setIsZoomed(false));
        } else {
            inst.setOption(option, { replaceMerge: ["series"] });
        }

        inst.dispatchAction({
            type: "takeGlobalCursor",
            key: "dataZoomSelect",
            dataZoomSelectActive: true,
        });
    }, [option, dataKey]);

    // Respond to container resize
    useEffect(() => {
        const el = chartRef.current;
        if (!el) return;
        const observer = new ResizeObserver(() => {
            instanceRef.current?.resize();
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const handleResetZoom = useCallback(() => {
        const inst = instanceRef.current;
        if (!inst) return;
        inst.dispatchAction({ type: "dataZoom", start: 0, end: 100 });
        setIsZoomed(false);
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
                    <span className="text-muted-foreground">
                        Loading data…
                    </span>
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
                <TSTooltip
                    tooltip={tooltip}
                    formatValue={config.formatValue}
                />
            )}
        </div>
    );
}
