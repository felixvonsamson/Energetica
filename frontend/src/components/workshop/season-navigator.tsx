/**
 * Picking the days a full-season review shows in detail (#1399).
 *
 * A full season is 91 days: too many to chart at every settlement point, and
 * the trends that matter, such as hydro rising through spring, only show over
 * the whole of it. So the review shows the season at a low resolution, and
 * charts a window of its days in detail.
 *
 * - `SeasonNavigator`, in the review's sticky bar: the market's generation over
 *   the season, stacked by facility type, with the window drawn over it. The
 *   window is dragged, or resized by its edges.
 * - `SeasonPriceChart`, above the season's daily energy mix: the trend of the
 *   price over the season, smoothed. Clicking a day moves the window there.
 */

import { LineChart } from "echarts/charts";
import type { LineSeriesOption } from "echarts/charts";
import {
    DataZoomComponent,
    GridComponent,
    MarkAreaComponent,
    TooltipComponent,
} from "echarts/components";
import type {
    DataZoomComponentOption,
    GridComponentOption,
    MarkAreaComponentOption,
    TooltipComponentOption,
} from "echarts/components";
import type { ComposeOption } from "echarts/core";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import {
    labelIntervalSeconds,
    type ZoomRange,
} from "@/components/charts/echarts-time-series";
import { resolveCSSVar } from "@/lib/charts/color-utils";
import {
    clampWindow,
    type DayWindow,
    dateOfDay,
    weekdayOfDay,
    windowLabel,
} from "@/lib/workshop-review";
import type { ApiSchema } from "@/types/api-helpers";
import { formatMoney } from "@energetica/core/format-utils";
import { Button } from "@energetica/ui/components/button";

echarts.use([
    LineChart,
    GridComponent,
    TooltipComponent,
    DataZoomComponent,
    MarkAreaComponent,
    CanvasRenderer,
]);

type ECOption = ComposeOption<
    | LineSeriesOption
    | GridComponentOption
    | TooltipComponentOption
    | DataZoomComponentOption
    | MarkAreaComponentOption
>;

type Overview = ApiSchema<"WorkshopSeasonOverviewOut">;

const HOURS_PER_DAY = 24;

/** How many hours the season's price is averaged over, to show its trend. */
const SMOOTHING_HOURS = 48;

interface ChartHandlers {
    /** A click on the plot, with the x-axis value under it. */
    onClick?: (value: number) => void;
    /** The slider moved the window. */
    onDataZoom?: (chart: echarts.ECharts) => void;
}

/** One ECharts chart, filling its box, kept up to date with `option`. */
function useEChart(option: ECOption, handlers: ChartHandlers) {
    const ref = useRef<HTMLDivElement>(null);
    const chart = useRef<echarts.ECharts | null>(null);
    const handlersRef = useRef(handlers);
    useLayoutEffect(() => {
        handlersRef.current = handlers;
    });

    useEffect(() => {
        const element = ref.current;
        if (!element) return;
        const instance = echarts.init(element, null, { renderer: "canvas" });
        chart.current = instance;
        const observer = new ResizeObserver(() => instance.resize());
        observer.observe(element);
        instance.getZr().on("click", (e) => {
            if (
                !instance.containPixel({ gridIndex: 0 }, [e.offsetX, e.offsetY])
            )
                return;
            const value = instance.convertFromPixel(
                { xAxisIndex: 0 },
                e.offsetX,
            );
            if (typeof value === "number")
                handlersRef.current.onClick?.(Math.round(value));
        });
        instance.on("datazoom", () =>
            handlersRef.current.onDataZoom?.(instance),
        );
        return () => {
            observer.disconnect();
            instance.dispose();
            chart.current = null;
        };
    }, []);

    useEffect(() => {
        // Merged, so the slider is not reset while it is dragged.
        chart.current?.setOption(option);
    }, [option]);

    return ref;
}

function theme() {
    return {
        text: resolveCSSVar("--muted-foreground"),
        border: resolveCSSVar("--border"),
        primary: resolveCSSVar("--primary"),
        price: resolveCSSVar("--chart-1"),
    };
}

/** What the season charts need to name and colour facility types. */
interface FacilityLabels {
    assetColor: (key: string) => string;
    /** Facility types bottom first. */
    facilityOrder: readonly string[];
}

/**
 * Each facility type's running total, bottom first, without the types that
 * generated nothing. ECharts stacks along x when both axes are value axes, so
 * the strip stacks by hand: each series is drawn from zero up to its running
 * total, the top one first, so the lower ones cover it.
 */
function stacked(
    series: Overview["power"],
    facilityOrder: readonly string[],
): { facility: string; top: number[] }[] {
    const rank = (facility: string) => {
        const index = facilityOrder.indexOf(facility);
        return index === -1 ? Infinity : index;
    };
    let running: number[] = [];
    return series
        .filter((item) => item.values.some((value) => value > 0))
        .sort((a, b) => rank(a.facility) - rank(b.facility))
        .map((item) => {
            running = item.values.map((v, i) => (running[i] ?? 0) + v);
            return { facility: item.facility, top: running };
        })
        .reverse();
}

// ── Navigator ────────────────────────────────────────────────────────────────

/**
 * The season's generation, with the window of days shown in detail over it.
 * Dragging the window, or one of its edges, moves it once released. A click
 * beside the window moves it there at once.
 */
export function SeasonNavigator({
    overview,
    days,
    labels,
    window,
    onWindowChange,
}: {
    overview: Overview;
    /** The day of the year of each of the period's days. */
    days: readonly number[];
    labels: FacilityLabels;
    window: DayWindow;
    onWindowChange: (window: DayWindow) => void;
}) {
    // While dragging, the window is only a draft, shown in the heading. ECharts
    // moves the window for a click after the pointer is released, so a change
    // with no pointer down is committed at once.
    const [draft, setDraft] = useState<DayWindow | null>(null);
    const draftRef = useRef<DayWindow | null>(null);
    const pressed = useRef(false);
    const dayCount = days.length;

    const option = useMemo((): ECOption => {
        const t = theme();
        // One unit per day, each point in the middle of its part of the day.
        const perDay = overview.points_per_day;
        const at = (i: number) =>
            Math.floor(i / perDay) - 0.5 + ((i % perDay) + 0.5) / perDay;
        const axis = {
            type: "value" as const,
            min: -0.5,
            max: dayCount - 0.5,
            show: false,
        };
        return {
            animation: false,
            // No margins, so the sticky bar stays thin. The heading names the
            // window's dates.
            grid: { left: 8, right: 8, top: 0, bottom: 1 },
            // The slider drives a second, hidden axis, so the strip itself
            // never zooms.
            xAxis: [axis, axis],
            yAxis: { type: "value", show: false },
            dataZoom: [
                {
                    type: "slider",
                    xAxisIndex: 1,
                    filterMode: "none",
                    startValue: window.first - 0.5,
                    endValue: window.first + window.count - 0.5,
                    minValueSpan: 1,
                    top: 0,
                    bottom: 1,
                    left: 8,
                    right: 8,
                    showDetail: false,
                    showDataShadow: false,
                    brushSelect: false,
                    backgroundColor: "transparent",
                    borderColor: "transparent",
                    fillerColor: "rgba(127,127,127,0.25)",
                    handleSize: "100%",
                    handleStyle: { color: t.primary, borderColor: t.primary },
                    moveHandleSize: 6,
                    moveHandleStyle: { color: t.primary, opacity: 0.6 },
                },
            ],
            series: stacked(overview.power, labels.facilityOrder).map(
                ({ facility, top }): LineSeriesOption => ({
                    type: "line",
                    symbol: "none",
                    silent: true,
                    lineStyle: { width: 0 },
                    areaStyle: {
                        color: labels.assetColor(facility),
                        opacity: 1,
                    },
                    data: top.map((v, i) => [at(i), v]),
                }),
            ),
        };
    }, [overview, labels, window, dayCount]);

    const ref = useEChart(option, {
        onDataZoom: (chart) => {
            const [zoom] = chart.getOption().dataZoom as {
                startValue: number;
                endValue: number;
            }[];
            if (!zoom) return;
            const next = clampWindow(
                {
                    first: Math.round(zoom.startValue + 0.5),
                    count: Math.round(zoom.endValue - zoom.startValue),
                },
                dayCount,
            );
            if (!pressed.current) {
                onWindowChange(next);
                return;
            }
            draftRef.current = next;
            setDraft(next);
        },
    });

    useEffect(() => {
        const press = () => {
            pressed.current = true;
        };
        const release = () => {
            pressed.current = false;
            const next = draftRef.current;
            if (!next) return;
            draftRef.current = null;
            setDraft(null);
            onWindowChange(next);
        };
        document.addEventListener("pointerdown", press);
        document.addEventListener("pointerup", release);
        return () => {
            document.removeEventListener("pointerdown", press);
            document.removeEventListener("pointerup", release);
        };
    }, [onWindowChange]);

    const step = (by: number) =>
        onWindowChange(
            clampWindow(
                { first: window.first + by, count: window.count },
                dayCount,
            ),
        );

    return (
        <div className="w-full">
            <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium">
                    {windowLabel(days, draft ?? window)}
                </span>
                <span className="text-xs text-muted-foreground">
                    Drag the window, or its edges
                </span>
                <div className="ml-auto flex gap-1">
                    <Button
                        variant="outline"
                        size="icon-sm"
                        className="size-6"
                        aria-label="Earlier days"
                        onClick={() => step(-window.count)}
                    >
                        <ChevronLeft />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon-sm"
                        className="size-6"
                        aria-label="Later days"
                        onClick={() => step(window.count)}
                    >
                        <ChevronRight />
                    </Button>
                </div>
            </div>
            <div ref={ref} className="h-[104px] w-full" />
        </div>
    );
}

// ── Season price ─────────────────────────────────────────────────────────────

/** A moving average over `width` values around each one, skipping gaps. */
function smooth(values: readonly (number | null)[], width: number) {
    const half = Math.floor(width / 2);
    return values.map((_, i) => {
        let sum = 0;
        let count = 0;
        for (let j = i - half; j <= i + half; j++) {
            const v = values[j];
            if (v === null || v === undefined) continue;
            sum += v;
            count++;
        }
        return count ? sum / count : null;
    });
}

/**
 * The trend of the price over the season: the hourly price, and a band between
 * each day's lowest and highest price, both smoothed. It sits right above the
 * season's daily bars, with the same margins, date labels and zoom, so each day
 * lines up with its bar. Its tooltip gives the day's actual prices.
 */
export function SeasonPriceChart({
    overview,
    days,
    window,
    zoom,
    onDayClick,
}: {
    overview: Overview;
    /** The day of the year of each of the period's days. */
    days: readonly number[];
    window: DayWindow;
    /** The daily bars' zoom. */
    zoom: ZoomRange;
    onDayClick: (day: number) => void;
}) {
    const option = useMemo((): ECOption => {
        const t = theme();
        const ofEachHour = (daily: readonly (number | null)[]) =>
            overview.hourly_price.map(
                (_, hour) => daily[Math.floor(hour / HOURS_PER_DAY)] ?? null,
            );
        const mean = smooth(overview.hourly_price, SMOOTHING_HOURS);
        const min = smooth(ofEachHour(overview.price_min), SMOOTHING_HOURS);
        const max = smooth(ofEachHour(overview.price_max), SMOOTHING_HOURS);
        const value = (v: number | null) => v ?? "-";
        const row = (label: string, v: number | null | undefined) =>
            `<tr><td class="pr-1 align-middle"><div class="w-2.5 h-2.5 rounded-sm inline-block" style="background:${t.price}"></div></td>` +
            `<td class="pr-3 whitespace-nowrap align-middle">${label}</td>` +
            `<td class="text-right font-mono whitespace-nowrap align-middle">${typeof v === "number" ? `${formatMoney(v)}/MWh` : "None"}</td></tr>`;
        // A date label every so many hours, as the bars below space theirs,
        // in the middle of the day, under its bar.
        const visibleDays = Math.max(
            1,
            Math.ceil((days.length * (zoom.end - zoom.start)) / 100),
        );
        const labelEvery =
            Math.max(
                1,
                Math.round(labelIntervalSeconds(visibleDays * 86_400) / 86_400),
            ) * HOURS_PER_DAY;
        const middle = HOURS_PER_DAY / 2;
        const quiet = { silent: true, emphasis: { disabled: true } } as const;
        return {
            animation: false,
            // The bars' margins, with room below for the date labels.
            grid: { left: 70, right: 20, top: 8, bottom: 22 },
            dataZoom: [
                {
                    type: "inside",
                    start: zoom.start,
                    end: zoom.end,
                    zoomOnMouseWheel: false,
                    moveOnMouseMove: false,
                    moveOnMouseWheel: false,
                    preventDefaultMouseMove: false,
                },
            ],
            tooltip: {
                trigger: "axis",
                axisPointer: { type: "line", lineStyle: { color: t.text } },
                backgroundColor: "transparent",
                borderWidth: 0,
                padding: 0,
                extraCssText: "box-shadow:none",
                // The same look as the review's other tooltips. Only dates and
                // numbers, so nothing a player typed.
                formatter: (params) => {
                    const [first] = Array.isArray(params) ? params : [params];
                    const index = Math.floor(
                        (first?.dataIndex ?? 0) / HOURS_PER_DAY,
                    );
                    const day = days[index] ?? 0;
                    return (
                        `<div class="bg-neutral-100 dark:bg-neutral-700 border border-border rounded shadow-lg p-2 text-xs text-foreground">` +
                        `<div class="font-semibold mb-1 pb-1 border-b border-border/50">${weekdayOfDay(day)} ${dateOfDay(day)}</div>` +
                        `<table><tbody>` +
                        row("Highest price", overview.price_max[index]) +
                        row("Average price", overview.price_mean[index]) +
                        row("Lowest price", overview.price_min[index]) +
                        `</tbody></table>` +
                        `<div class="mt-1 text-muted-foreground">The chart is smoothed.</div></div>`
                    );
                },
            },
            xAxis: {
                type: "category",
                data: mean.map((_, hour) => String(hour)),
                axisTick: { show: false },
                axisLabel: {
                    color: t.text,
                    fontSize: 11,
                    interval: (hour: number) => hour % labelEvery === middle,
                    formatter: (hour: string) =>
                        dateOfDay(
                            days[Math.floor(Number(hour) / HOURS_PER_DAY)] ?? 0,
                        ),
                },
                axisLine: { lineStyle: { color: t.border } },
            },
            yAxis: {
                type: "value",
                name: "Price",
                nameLocation: "middle",
                nameGap: 52,
                nameTextStyle: { color: t.text, fontSize: 11 },
                splitNumber: 3,
                axisLabel: {
                    color: t.text,
                    fontSize: 11,
                    formatter: (v: number) => formatMoney(v),
                },
                splitLine: { lineStyle: { color: t.border, opacity: 0.2 } },
            },
            series: [
                // The band: the lowest price, then the spread stacked on it.
                {
                    type: "line",
                    stack: "band",
                    symbol: "none",
                    ...quiet,
                    lineStyle: { width: 0 },
                    data: min.map(value),
                    // The days shown in detail, as on the bars below.
                    markArea: {
                        silent: true,
                        itemStyle: {
                            color: t.primary,
                            opacity: 0.15,
                            borderColor: t.primary,
                            borderWidth: 1.5,
                        },
                        data: [
                            [
                                { xAxis: window.first * HOURS_PER_DAY },
                                {
                                    xAxis:
                                        (window.first + window.count) *
                                            HOURS_PER_DAY -
                                        1,
                                },
                            ],
                        ],
                    },
                },
                {
                    type: "line",
                    stack: "band",
                    symbol: "none",
                    ...quiet,
                    lineStyle: { width: 0 },
                    areaStyle: { color: t.price, opacity: 0.3 },
                    data: max.map((high, i) => {
                        const low = min[i];
                        return high === null ||
                            low === null ||
                            low === undefined
                            ? "-"
                            : high - low;
                    }),
                },
                {
                    type: "line",
                    symbol: "none",
                    ...quiet,
                    lineStyle: { color: t.price, width: 1.5 },
                    data: mean.map(value),
                },
            ],
        };
    }, [overview, days, window, zoom]);

    const ref = useEChart(option, {
        onClick: (hour) => onDayClick(Math.floor(hour / HOURS_PER_DAY)),
    });
    return <div ref={ref} className="h-[150px] w-full" />;
}
