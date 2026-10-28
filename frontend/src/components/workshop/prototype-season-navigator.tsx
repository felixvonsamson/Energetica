/**
 * PROTOTYPE (#1399), throwaway: three ways to view and navigate a full-season
 * (91-day) Trading period's review, switchable with `?variant=` (A, B, C).
 *
 * In every variant, a "Daily energy mix" card at the top (`SeasonMixCard` in
 * period-review.tsx) shows the whole season, one bar per day, and the selected
 * window of days. The detailed charts below show that window at full
 * resolution. The variants differ in the
 * navigator in the sticky bar:
 *
 * - A, Brush strip: a stacked-area strip of the season, 8 points a day, with a
 *   draggable, resizable window over it. The one picked so far.
 * - B, Hover lens: a strip of daily bars. Hovering a day shows that day at full
 *   resolution above the strip; clicking moves the window there. The window's
 *   length is picked with buttons.
 * - C, Price band: the season's daily price range. Dragging across it draws a
 *   new window; clicking moves the window there.
 *
 * Not for main. See the branch `prototype/1399-season-overview`.
 */

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { BarChart, LineChart } from "echarts/charts";
import type { BarSeriesOption, LineSeriesOption } from "echarts/charts";
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
import {
    type ReactNode,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from "react";

import { resolveCSSVar } from "@/lib/charts/color-utils";
import { dateOfDay, weekdayOfDay } from "@/lib/workshop-review";
import type { ApiSchema } from "@/types/api-helpers";
import { apiClient } from "@energetica/core/api-client";
import { formatMoney } from "@energetica/core/format-utils";
import { Button } from "@energetica/ui/components/button";
import {
    SegmentedPicker,
    SegmentedPickerOption,
} from "@energetica/ui/components/segmented-picker";

echarts.use([
    BarChart,
    LineChart,
    GridComponent,
    TooltipComponent,
    DataZoomComponent,
    MarkAreaComponent,
    CanvasRenderer,
]);

type ECOption = ComposeOption<
    | BarSeriesOption
    | LineSeriesOption
    | GridComponentOption
    | TooltipComponentOption
    | DataZoomComponentOption
    | MarkAreaComponentOption
>;

type Season = ApiSchema<"TradingPeriod">["season"];
type Overview = ApiSchema<"PrototypeSeasonOverviewOut">;
type PeriodWeek = ApiSchema<"WorkshopPeriodWeekOut">;

/** A window of the season's days, by their position in the period. */
export interface DayWindow {
    first: number;
    count: number;
}

export const MAX_WINDOW_DAYS = 14;
const DEFAULT_WINDOW_DAYS = 7;

/** The default window: 7 days in the middle of the season. */
export function middleWindow(dayCount: number): DayWindow {
    const count = Math.min(DEFAULT_WINDOW_DAYS, dayCount);
    return { first: Math.floor((dayCount - count) / 2), count };
}

function clampWindow(window: DayWindow, dayCount: number): DayWindow {
    const count = Math.max(1, Math.min(MAX_WINDOW_DAYS, window.count, dayCount));
    const first = Math.max(0, Math.min(dayCount - count, window.first));
    return { first, count };
}

/** The window of `count` days centred on `day`. */
export function centredOn(day: number, count: number, dayCount: number): DayWindow {
    return clampWindow(
        { first: day - Math.floor((count - 1) / 2), count },
        dayCount,
    );
}

export function windowLabel(days: readonly number[], window: DayWindow) {
    const first = days[window.first] ?? 0;
    const last = days[window.first + window.count - 1] ?? first;
    const span = window.count === 1 ? "1 day" : `${window.count} days`;
    return window.count === 1
        ? `${weekdayOfDay(first)} ${dateOfDay(first)}`
        : `${dateOfDay(first)} – ${dateOfDay(last)} (${span})`;
}

// ── Variant switching ────────────────────────────────────────────────────────

export const VARIANTS = [
    { key: "A", name: "Brush strip" },
    { key: "B", name: "Hover lens" },
    { key: "C", name: "Price band" },
] as const;
export type VariantKey = (typeof VARIANTS)[number]["key"];

const VARIANT_EVENT = "prototype-variant-change";

function readVariant(): VariantKey {
    const value = new URLSearchParams(window.location.search).get("variant");
    return VARIANTS.find((variant) => variant.key === value)?.key ?? "A";
}

export function setVariant(key: VariantKey) {
    const url = new URL(window.location.href);
    url.searchParams.set("variant", key);
    window.history.replaceState(window.history.state, "", url);
    window.dispatchEvent(new Event(VARIANT_EVENT));
}

export function usePrototypeVariant(): VariantKey {
    return useSyncExternalStore((onChange) => {
        window.addEventListener(VARIANT_EVENT, onChange);
        window.addEventListener("popstate", onChange);
        return () => {
            window.removeEventListener(VARIANT_EVENT, onChange);
            window.removeEventListener("popstate", onChange);
        };
    }, readVariant);
}

// ── Data ─────────────────────────────────────────────────────────────────────

export function useSeasonOverview(
    round: number,
    season: Season,
    enabled: boolean,
) {
    return useQuery({
        queryKey: ["prototype-overview", round, season],
        queryFn: () =>
            apiClient.get<Overview>(
                `/workshop/periods/${round}/${season}/prototype-overview`,
            ),
        enabled,
        staleTime: Infinity,
    });
}

export function useSeasonDays(
    round: number,
    season: Season,
    window: DayWindow | null,
) {
    return useQuery({
        queryKey: [
            "prototype-days",
            round,
            season,
            window?.first,
            window?.count,
        ],
        queryFn: () =>
            apiClient.get<PeriodWeek>(
                `/workshop/periods/${round}/${season}/prototype-days/${window?.first}/${window?.count}`,
            ),
        enabled: window !== null,
        staleTime: Infinity,
        placeholderData: keepPreviousData,
    });
}

/** Holds a value until it has stopped changing for `delay` ms. */
function useDebounced<T>(value: T, delay: number): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);
    return debounced;
}

// ── ECharts plumbing ─────────────────────────────────────────────────────────

interface ChartHandlers {
    /** A click on the plot, with the day under it. */
    onDayClick?: (day: number) => void;
    /** The day under the pointer, or null once it leaves. */
    onDayHover?: (day: number | null, x: number) => void;
    /** Raw pointer events, with the day under the pointer. */
    onPointerDown?: (day: number) => void;
    onPointerMove?: (day: number) => void;
    onPointerUp?: (day: number) => void;
    onDataZoom?: (chart: echarts.ECharts) => void;
}

function useEChart(
    option: ECOption,
    handlers: ChartHandlers,
    { merge = false }: { merge?: boolean } = {},
) {
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

        const dayAt = (x: number, y: number): number | null => {
            if (!instance.containPixel({ gridIndex: 0 }, [x, y])) return null;
            const value = instance.convertFromPixel({ xAxisIndex: 0 }, x);
            return typeof value === "number" ? Math.round(value) : null;
        };
        const zr = instance.getZr();
        zr.on("click", (e) => {
            const day = dayAt(e.offsetX, e.offsetY);
            if (day !== null) handlersRef.current.onDayClick?.(day);
        });
        zr.on("mousemove", (e) => {
            const day = dayAt(e.offsetX, e.offsetY);
            handlersRef.current.onDayHover?.(day, e.offsetX);
            if (day !== null) handlersRef.current.onPointerMove?.(day);
        });
        zr.on("globalout", () => handlersRef.current.onDayHover?.(null, 0));
        zr.on("mousedown", (e) => {
            const day = dayAt(e.offsetX, e.offsetY);
            if (day !== null) handlersRef.current.onPointerDown?.(day);
        });
        zr.on("mouseup", (e) => {
            const value = instance.convertFromPixel(
                { xAxisIndex: 0 },
                e.offsetX,
            );
            if (typeof value === "number")
                handlersRef.current.onPointerUp?.(Math.round(value));
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
        chart.current?.setOption(option, { notMerge: !merge });
    }, [option, merge]);

    return { ref, chart };
}

function theme() {
    return {
        text: resolveCSSVar("--muted-foreground"),
        foreground: resolveCSSVar("--foreground"),
        border: resolveCSSVar("--border"),
        card: resolveCSSVar("--card"),
        primary: resolveCSSVar("--primary"),
        price: resolveCSSVar("--chart-1"),
    };
}

/** The season's days as an x axis of values, one unit per day. */
function dayAxis(
    days: readonly number[],
    { labels }: { labels: boolean },
): ECOption["xAxis"] {
    const t = theme();
    return {
        type: "value",
        min: -0.5,
        max: days.length - 0.5,
        splitLine: { show: false },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: t.border } },
        axisLabel: labels
            ? {
                  color: t.text,
                  fontSize: 10,
                  hideOverlap: true,
                  formatter: (value: number) => {
                      if (!Number.isInteger(value)) return "";
                      const day = days[value];
                      return day === undefined ? "" : dateOfDay(day);
                  },
              }
            : { show: false },
        minInterval: 1,
        interval: 7,
    };
}

/** Shading over the selected window, on a series' markArea. */
function windowArea(window: DayWindow, color: string, opacity = 0.18) {
    return {
        silent: true,
        itemStyle: {
            color,
            opacity,
            borderColor: color,
            borderWidth: 1.5,
        },
        data: [
            [
                { xAxis: window.first - 0.5 },
                { xAxis: window.first + window.count - 0.5 },
            ],
        ] as [{ xAxis: number }, { xAxis: number }][],
    };
}

/** Facility types of the overview in stack order, leaving out empty ones. */
function stackedFacilities(
    overview: Overview,
    facilityOrder: readonly string[],
    series: Overview["facilities"] = overview.facilities,
) {
    const rank = (facility: string) => {
        const index = facilityOrder.indexOf(facility);
        return index === -1 ? Infinity : index;
    };
    return series
        .filter((facility) => facility.energy.some((value) => value > 0))
        .sort((a, b) => rank(a.facility) - rank(b.facility));
}

/** What the season charts need to name and colour facility types. */
export interface FacilityLabels {
    facilityName: (facility: string) => string;
    assetColor: (key: string) => string;
    facilityOrder: readonly string[];
}

// ── Navigators (the sticky bar) ──────────────────────────────────────────────

interface NavigatorProps {
    round: number;
    season: Season;
    overview: Overview;
    labels: FacilityLabels;
    window: DayWindow;
    onWindowChange: (window: DayWindow) => void;
}

export function SeasonNavigator(
    props: NavigatorProps & { variant: VariantKey },
) {
    if (props.variant === "B") return <HoverLensNavigator {...props} />;
    if (props.variant === "C") return <PriceBandNavigator {...props} />;
    return <BrushStripNavigator {...props} />;
}

function WindowHeading({
    overview,
    window,
    compact = false,
    children,
}: {
    overview: Overview;
    window: DayWindow;
    compact?: boolean;
    children?: ReactNode;
}) {
    return (
        <div
            className={`flex flex-wrap items-center gap-3 ${compact ? "" : "pb-1"}`}
        >
            <span className="text-sm font-medium">
                {windowLabel(overview.days, window)}
            </span>
            {children}
        </div>
    );
}

// A — Brush strip

function BrushStripNavigator({
    overview,
    labels,
    window,
    onWindowChange,
}: NavigatorProps) {
    // While dragging, the window is only a draft, shown in the heading. It is
    // committed once the pointer is released.
    const [draft, setDraft] = useState<DayWindow | null>(null);
    const draftRef = useRef<DayWindow | null>(null);
    const dayCount = overview.days.length;

    const option = useMemo((): ECOption => {
        const t = theme();
        const facilities = stackedFacilities(
            overview,
            labels.facilityOrder,
            overview.strip,
        );
        // Each strip point sits in the middle of its part of the day.
        const perDay = overview.strip_points_per_day;
        const at = (i: number) =>
            Math.floor(i / perDay) - 0.5 + ((i % perDay) + 0.5) / perDay;
        const axis = dayAxis(overview.days, { labels: true }) as object;
        return {
            animation: false,
            grid: { left: 8, right: 8, top: 2, bottom: 16 },
            xAxis: [axis, { ...axis, show: false }],
            yAxis: { type: "value", show: false },
            dataZoom: [
                {
                    type: "slider",
                    // The slider drives a hidden axis, so the strip itself
                    // never zooms.
                    xAxisIndex: 1,
                    filterMode: "none",
                    startValue: window.first - 0.5,
                    endValue: window.first + window.count - 0.5,
                    minValueSpan: 1,
                    maxValueSpan: MAX_WINDOW_DAYS,
                    top: 2,
                    bottom: 16,
                    left: 8,
                    right: 8,
                    height: undefined,
                    showDetail: false,
                    showDataShadow: false,
                    brushSelect: false,
                    realtime: true,
                    backgroundColor: "transparent",
                    borderColor: "transparent",
                    fillerColor: "rgba(127,127,127,0.25)",
                    handleSize: "100%",
                    handleStyle: { color: t.primary, borderColor: t.primary },
                    moveHandleSize: 6,
                    moveHandleStyle: { color: t.primary, opacity: 0.6 },
                },
            ],
            series: facilities.map(
                (facility): LineSeriesOption => ({
                    type: "line",
                    stack: "mix",
                    symbol: "none",
                    silent: true,
                    lineStyle: { width: 0 },
                    areaStyle: {
                        color: labels.assetColor(facility.facility),
                        opacity: 0.85,
                    },
                    data: facility.energy.map((v, i) => [at(i), v]),
                }),
            ),
        };
    }, [overview, labels, window]);

    const { ref } = useEChart(
        option,
        {
            onDataZoom: (chart) => {
                const zoom = (
                    chart.getOption().dataZoom as {
                        startValue: number;
                        endValue: number;
                    }[]
                )[0];
                if (!zoom) return;
                const next = clampWindow(
                    {
                        first: Math.round(zoom.startValue + 0.5),
                        count: Math.round(zoom.endValue - zoom.startValue),
                    },
                    dayCount,
                );
                draftRef.current = next;
                setDraft(next);
            },
        },
        { merge: true },
    );

    useEffect(() => {
        const commit = () => {
            const next = draftRef.current;
            if (!next) return;
            draftRef.current = null;
            setDraft(null);
            onWindowChange(next);
        };
        document.addEventListener("pointerup", commit);
        return () => document.removeEventListener("pointerup", commit);
    }, [onWindowChange]);

    const shown = draft ?? window;
    const step = (by: number) =>
        onWindowChange(
            clampWindow({ first: window.first + by, count: window.count }, dayCount),
        );

    return (
        <div className="w-full">
            <WindowHeading overview={overview} window={shown} compact>
                <span className="text-xs text-muted-foreground">
                    Drag the window, or its edges (up to {MAX_WINDOW_DAYS}{" "}
                    days)
                </span>
                <div className="ml-auto flex gap-1">
                    <Button
                        variant="outline"
                        size="icon-sm"
                        className="size-6"
                        aria-label="Earlier"
                        onClick={() => step(-window.count)}
                    >
                        <ChevronLeft />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon-sm"
                        className="size-6"
                        aria-label="Later"
                        onClick={() => step(window.count)}
                    >
                        <ChevronRight />
                    </Button>
                </div>
            </WindowHeading>
            <div ref={ref} className="h-[104px] w-full" />
        </div>
    );
}

// B — Hover lens

const LENGTH_OPTIONS = ["1", "3", "7", "14"] as const;

function HoverLensNavigator({
    round,
    season,
    overview,
    labels,
    window,
    onWindowChange,
}: NavigatorProps) {
    const [hover, setHover] = useState<{ day: number; x: number } | null>(
        null,
    );
    const dayCount = overview.days.length;

    const option = useMemo((): ECOption => {
        const t = theme();
        const facilities = stackedFacilities(overview, labels.facilityOrder);
        return {
            animation: false,
            grid: { left: 8, right: 8, top: 4, bottom: 18 },
            xAxis: dayAxis(overview.days, { labels: true }),
            yAxis: { type: "value", show: false },
            series: [
                ...facilities.map(
                    (facility, i): BarSeriesOption => ({
                        type: "bar",
                        stack: "mix",
                        silent: true,
                        barWidth: "75%",
                        itemStyle: {
                            color: labels.assetColor(facility.facility),
                        },
                        data: facility.energy.map((v, day) => [day, v]),
                        markArea:
                            i === 0
                                ? windowArea(window, t.primary, 0.15)
                                : undefined,
                    }),
                ),
                // The hovered day's outline.
                {
                    type: "line",
                    data: [],
                    silent: true,
                    markArea:
                        hover === null
                            ? undefined
                            : windowArea(
                                  { first: hover.day, count: 1 },
                                  t.foreground,
                                  0.12,
                              ),
                },
            ],
        };
    }, [overview, labels, window, hover]);

    const { ref } = useEChart(option, {
        onDayHover: (day, x) =>
            setHover(
                day === null || day < 0 || day >= dayCount ? null : { day, x },
            ),
        onDayClick: (day) => onWindowChange(centredOn(day, window.count, dayCount)),
    });

    // Fetched only once the pointer rests on a day for a moment.
    const lensDay = useDebounced(hover?.day ?? null, 120);
    const lens = useSeasonDays(
        round,
        season,
        lensDay === null ? null : { first: lensDay, count: 1 },
    );
    const step = (by: number) =>
        onWindowChange(
            clampWindow({ first: window.first + by, count: window.count }, dayCount),
        );

    return (
        <div className="relative w-full">
            {hover !== null && (
                <DayLens
                    day={overview.days[hover.day] ?? 0}
                    data={lens.data}
                    stale={lens.isPlaceholderData || lensDay !== hover.day}
                    labels={labels}
                    x={hover.x}
                />
            )}
            <WindowHeading overview={overview} window={window}>
                <SegmentedPicker
                    value={String(window.count)}
                    onValueChange={(value) =>
                        onWindowChange(
                            centredOn(
                                window.first + Math.floor(window.count / 2),
                                Number(value),
                                dayCount,
                            ),
                        )
                    }
                >
                    {LENGTH_OPTIONS.map((length) => (
                        <SegmentedPickerOption key={length} value={length}>
                            {length === "1" ? "1 day" : `${length} days`}
                        </SegmentedPickerOption>
                    ))}
                </SegmentedPicker>
                <span className="text-xs text-muted-foreground">
                    Hover a day to preview it, click to show it below
                </span>
                <div className="ml-auto flex gap-1">
                    <Button
                        variant="outline"
                        size="icon"
                        aria-label="Earlier"
                        onClick={() => step(-window.count)}
                    >
                        <ChevronLeft />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        aria-label="Later"
                        onClick={() => step(window.count)}
                    >
                        <ChevronRight />
                    </Button>
                </div>
            </WindowHeading>
            <div ref={ref} className="h-[64px] w-full" />
        </div>
    );
}

/** One day at full resolution: the market's generation by type and the price. */
function DayLens({
    day,
    data,
    stale,
    labels,
    x,
}: {
    day: number;
    data: PeriodWeek | undefined;
    stale: boolean;
    labels: FacilityLabels;
    x: number;
}) {
    const option = useMemo((): ECOption => {
        if (!data) return {};
        const t = theme();
        const byType = new Map<string, number[]>();
        for (const pool of data.pools) {
            const sum = byType.get(pool.facility) ?? pool.generation.map(() => 0);
            pool.generation.forEach((v, i) => (sum[i] = (sum[i] ?? 0) + v));
            byType.set(pool.facility, sum);
        }
        const rank = (facility: string) => {
            const index = labels.facilityOrder.indexOf(facility);
            return index === -1 ? Infinity : index;
        };
        const types = [...byType.entries()]
            .filter(([, values]) => values.some((v) => v > 0))
            .sort(([a], [b]) => rank(a) - rank(b));
        const hours = data.price.map((_, i) => (i * 24) / data.price.length);
        return {
            animation: false,
            grid: { left: 44, right: 44, top: 10, bottom: 20 },
            xAxis: {
                type: "category",
                data: hours.map(
                    (h) => `${String(Math.floor(h)).padStart(2, "0")}:00`,
                ),
                axisLabel: { color: t.text, fontSize: 9, interval: 5 },
                axisTick: { show: false },
                axisLine: { lineStyle: { color: t.border } },
            },
            yAxis: [
                {
                    type: "value",
                    axisLabel: {
                        color: t.text,
                        fontSize: 9,
                        formatter: (v: number) => `${Math.round(v / 1e6)} MW`,
                    },
                    splitLine: { lineStyle: { color: t.border, opacity: 0.2 } },
                },
                {
                    type: "value",
                    axisLabel: {
                        color: t.price,
                        fontSize: 9,
                        formatter: (v: number) => formatMoney(v),
                    },
                    splitLine: { show: false },
                },
            ],
            series: [
                ...types.map(
                    ([facility, values]): BarSeriesOption => ({
                        type: "bar",
                        stack: "gen",
                        barCategoryGap: 0,
                        itemStyle: { color: labels.assetColor(facility) },
                        data: values,
                    }),
                ),
                {
                    type: "line",
                    yAxisIndex: 1,
                    step: "start",
                    symbol: "none",
                    lineStyle: { color: t.price, width: 2 },
                    data: data.price.map((v) => v ?? "-"),
                },
            ],
        };
    }, [data, labels]);
    const { ref } = useEChart(option, {});

    return (
        <div
            className="pointer-events-none absolute bottom-full mb-5 w-[380px] rounded-lg border border-border bg-surface-card p-3 shadow-xl"
            style={{ left: `clamp(0px, calc(${x}px - 190px), calc(100% - 380px))` }}
        >
            <div className="flex items-baseline justify-between pb-1 text-sm font-medium">
                <span>
                    {weekdayOfDay(day)} {dateOfDay(day)}
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                    Market generation and price
                </span>
            </div>
            <div
                ref={ref}
                className={`h-[170px] w-full transition-opacity ${stale ? "opacity-40" : ""}`}
            />
        </div>
    );
}

// C — Price band

function PriceBandNavigator({
    overview,
    window,
    onWindowChange,
}: NavigatorProps) {
    const dayCount = overview.days.length;
    // The window being drawn: from the day the drag started to the day under
    // the pointer.
    const [drawing, setDrawing] = useState<{ from: number; to: number } | null>(
        null,
    );
    const drawingRef = useRef(drawing);
    useLayoutEffect(() => {
        drawingRef.current = drawing;
    });

    const drawn = (span: { from: number; to: number }): DayWindow => {
        const from = Math.min(span.from, span.to);
        const to = Math.max(span.from, span.to);
        // Drawing longer than the limit keeps the end the pointer is at.
        const count = Math.min(MAX_WINDOW_DAYS, to - from + 1);
        const first = span.to >= span.from ? to - count + 1 : from;
        return clampWindow({ first, count }, dayCount);
    };
    const shown = drawing ? drawn(drawing) : window;

    const option = useMemo((): ECOption => {
        const t = theme();
        const min = overview.price_min;
        const max = overview.price_max;
        return {
            animation: false,
            grid: { left: 8, right: 8, top: 4, bottom: 18 },
            xAxis: dayAxis(overview.days, { labels: true }),
            yAxis: { type: "value", show: false, min: 0 },
            series: [
                // The band from each day's lowest to its highest price: the
                // highest filled down to zero, then the lowest masked out.
                {
                    type: "line",
                    symbol: "none",
                    silent: true,
                    lineStyle: { width: 0 },
                    areaStyle: { color: t.price, opacity: 0.3 },
                    data: max.map((v, day) => [day, v ?? "-"]),
                    markArea: windowArea(shown, t.primary, 0.2),
                },
                {
                    type: "line",
                    symbol: "none",
                    silent: true,
                    lineStyle: { width: 0 },
                    areaStyle: { color: t.card, opacity: 1 },
                    data: min.map((v, day) => [day, v ?? "-"]),
                },
                {
                    type: "line",
                    symbol: "none",
                    silent: true,
                    lineStyle: { color: t.price, width: 1.5 },
                    data: overview.price_mean.map((v, day) => [day, v ?? "-"]),
                },
            ],
        };
    }, [overview, shown]);

    const { ref } = useEChart(option, {
        onPointerDown: (day) => setDrawing({ from: day, to: day }),
        onPointerMove: (day) =>
            drawingRef.current &&
            setDrawing({
                from: drawingRef.current.from,
                to: Math.max(0, Math.min(dayCount - 1, day)),
            }),
    });

    useEffect(() => {
        const commit = () => {
            const span = drawingRef.current;
            if (!span) return;
            setDrawing(null);
            // A click without a drag moves the window there, keeping its length.
            onWindowChange(
                span.from === span.to
                    ? centredOn(span.from, window.count, dayCount)
                    : drawn(span),
            );
        };
        document.addEventListener("pointerup", commit);
        return () => document.removeEventListener("pointerup", commit);
    });

    const mean = (values: (number | null)[]) => {
        const finite = values.filter((v): v is number => v !== null);
        return finite.length
            ? finite.reduce((a, b) => a + b, 0) / finite.length
            : null;
    };
    const slice = (values: (number | null)[]) =>
        values.slice(shown.first, shown.first + shown.count);
    const windowMean = mean(slice(overview.price_mean));
    const windowMax = Math.max(
        ...slice(overview.price_max).map((v) => v ?? -Infinity),
    );

    return (
        <div className="w-full">
            <WindowHeading overview={overview} window={shown}>
                <span className="text-xs text-muted-foreground">
                    Average {windowMean === null ? "—" : formatMoney(windowMean)}
                    /MWh, peak {formatMoney(windowMax)}/MWh
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                    Daily price range. Drag across it to pick days (up to{" "}
                    {MAX_WINDOW_DAYS}), or click a day
                </span>
            </WindowHeading>
            <div ref={ref} className="h-[72px] w-full cursor-crosshair" />
        </div>
    );
}
