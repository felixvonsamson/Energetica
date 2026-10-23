/**
 * The control room's panels (#1289), each drawn from one part of the server's
 * answer. A panel with nothing to show yet says so instead of drawing an empty
 * chart.
 */

import { type ReactNode, useMemo } from "react";

import {
    PRICE_CAP,
    PRICE_GROUPS,
    type PriceGroup,
    alarmLine,
    energyScale,
    formatCo2,
    formatMegawattHours,
    formatMegawatts,
    fuelPrice,
    periodLabel,
    priceScales,
    riskLabel,
    taxPerTonne,
} from "@/lib/workshop-control-room";
import type { ApiSchema } from "@/types/api-helpers";
import { CoinIcon } from "@energetica/ui/components/coin-icon";
import { cn } from "@energetica/ui/lib/utils";

import { type ControlRoomChartOption, EChart } from "./echart";
import { MONO, THEME, sourceColor, sourceTitleColor } from "./theme";

type ControlRoom = ApiSchema<"ControlRoom">;
type PowerSource = ApiSchema<"PowerSource">;
type RoomPrices = ApiSchema<"RoomPrices">;

const NOTHING_SETTLED = "Fills in once the first season has settled";

const axisLabel = (fontSize: number) => ({
    color: THEME.dim,
    fontSize,
    fontFamily: MONO,
});

const formatFixed = (value: number, digits: number) =>
    value.toLocaleString("en-US", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });

export function Panel({
    title,
    children,
    className,
    right,
}: {
    title: string;
    children: ReactNode;
    className?: string;
    right?: ReactNode;
}) {
    return (
        <section
            className={cn(
                "flex min-h-0 min-w-0 flex-col rounded-sm border",
                className,
            )}
            style={{ borderColor: THEME.border, background: THEME.panel }}
        >
            <header
                className="flex items-center justify-between border-b px-3 py-1.5 text-[15px] font-semibold tracking-[0.14em] uppercase"
                style={{ borderColor: THEME.border, color: THEME.dim }}
            >
                <span>{title}</span>
                {right}
            </header>
            <div className="min-h-0 flex-1 p-2">{children}</div>
        </section>
    );
}

function Empty({ children }: { children: string }) {
    return (
        <div
            className="flex h-full items-center justify-center text-center text-xl italic"
            style={{ color: THEME.dim }}
        >
            {children}
        </div>
    );
}

function categoryAxis(data: string[]) {
    return {
        type: "category" as const,
        data,
        axisLabel: {
            ...axisLabel(12),
            interval: 0,
            rotate: data.length > 5 ? 45 : 0,
        },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: THEME.grid } },
    };
}

function valueAxis(name: string) {
    return {
        type: "value" as const,
        name,
        nameTextStyle: { color: THEME.dim, fontSize: 13 },
        axisLabel: axisLabel(13),
        splitLine: { lineStyle: { color: THEME.grid } },
    };
}

// --- alarms ---------------------------------------------------------------------------------------

/** The newest alarms are told in full, the older ones in a word or two. */
const FULL_ALARMS = 4;
const MAX_ALARMS = 5;

export function Alarms({ alarms }: { alarms: ControlRoom["alarms"] }) {
    if (alarms.length === 0) return <Empty>No alarms</Empty>;
    return (
        <div className="flex h-full flex-col gap-1 overflow-hidden font-mono">
            {alarms.slice(0, MAX_ALARMS).map((alarm, i) => {
                const line = alarmLine(alarm);
                const full = i < FULL_ALARMS;
                return (
                    <div
                        key={`${line.when}-${line.tag}-${line.text}`}
                        className={cn(
                            "flex shrink-0 items-baseline gap-3 border-l-[6px] px-2 whitespace-nowrap",
                            full && "py-0.5",
                        )}
                        style={{
                            borderColor: THEME.alarm[line.level],
                            background: full ? THEME.row : undefined,
                        }}
                    >
                        <span
                            className="w-[70px] shrink-0 text-[19px]"
                            style={{ color: THEME.dim }}
                        >
                            {line.when}
                        </span>
                        <span
                            className="w-[112px] shrink-0 text-[19px] font-bold"
                            style={{ color: THEME.alarm[line.level] }}
                        >
                            {line.tag}
                        </span>
                        <span
                            className="min-w-0 truncate text-[17px]"
                            style={{ color: full ? THEME.ink : THEME.dim }}
                        >
                            {full ? line.text : line.short}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

// --- capacity against demand (#1287) -------------------------------------------------------------

/** The capacity bar runs a little past the peak of every demand tier. */
const CAPACITY_HEADROOM = 1.08;

export function Capacity({ outlook }: { outlook: ControlRoom["capacity"] }) {
    const { room, risk } = outlook;
    const scaleMax = outlook.all_tiers_peak * CAPACITY_HEADROOM;
    const pct = (watts: number) =>
        `${(Math.min(watts, scaleMax) / scaleMax) * 100}%`;
    const weatherDependent = room.total - room.controllable;
    const storageColor = sourceColor("storage");
    return (
        <div
            className="flex h-full flex-col gap-3 pb-2"
            style={{ color: THEME.ink }}
        >
            <div
                className={cn(
                    "rounded-sm py-1.5 text-center text-[44px] font-black tracking-[0.1em] uppercase",
                    risk === "guaranteed" && "animate-pulse",
                )}
                style={{ background: THEME.risk[risk], color: THEME.bg }}
            >
                {riskLabel(risk)}
            </div>

            {/* The two peaks, each written up to its mark on the bar. */}
            <div className="relative h-[140px] shrink-0">
                <PeakLabel
                    at={pct(outlook.must_serve_peak)}
                    label="Must-serve peak"
                    value={formatMegawatts(outlook.must_serve_peak)}
                    strong
                />
                <PeakLabel
                    at={pct(outlook.all_tiers_peak)}
                    label="All demand tiers"
                    value={formatMegawatts(outlook.all_tiers_peak)}
                />
                <div
                    className="absolute inset-x-0 bottom-0 h-14 rounded-sm"
                    style={{ background: THEME.track }}
                >
                    <div
                        className="absolute inset-y-0 left-0 transition-all duration-700"
                        style={{
                            width: pct(room.controllable),
                            background: THEME.accent,
                        }}
                    />
                    <div
                        className="absolute inset-y-0 transition-all duration-700"
                        style={{
                            left: pct(room.controllable),
                            width: pct(weatherDependent),
                            background: `repeating-linear-gradient(135deg, ${THEME.weather[0]} 0 10px, ${THEME.weather[1]} 10px 20px)`,
                        }}
                    />
                </div>
                <div
                    className="absolute top-0 -bottom-1.5"
                    style={{
                        left: pct(outlook.must_serve_peak),
                        borderLeft: `4px solid ${THEME.ink}`,
                    }}
                />
                <div
                    className="absolute top-0 -bottom-1.5"
                    style={{
                        left: pct(outlook.all_tiers_peak),
                        borderLeft: `2px dashed ${THEME.dim}`,
                    }}
                />
            </div>

            <div className="grid grid-cols-5 gap-2">
                <CapacityFigure
                    label="Controllable"
                    value={formatMegawatts(room.controllable)}
                    swatch={THEME.accent}
                />
                <CapacityFigure
                    label="Weather-dep."
                    value={formatMegawatts(weatherDependent)}
                    swatch={THEME.weather[0]}
                />
                <CapacityFigure
                    label="Total gen."
                    value={formatMegawatts(room.total)}
                />
                <CapacityFigure
                    label="Storage power"
                    value={formatMegawatts(room.storage_power)}
                    swatch={storageColor}
                />
                <CapacityFigure
                    label="Storage cap."
                    value={formatMegawattHours(room.storage_energy)}
                    swatch={storageColor}
                />
            </div>
        </div>
    );
}

function PeakLabel({
    at,
    label,
    value,
    strong,
}: {
    at: string;
    label: string;
    value: string;
    strong?: boolean;
}) {
    return (
        <div
            className="absolute top-0 pr-3 text-right whitespace-nowrap"
            style={{
                right: `calc(100% - ${at})`,
                color: strong ? THEME.ink : THEME.dim,
            }}
        >
            <div
                className={cn(
                    "tracking-wider uppercase",
                    strong ? "text-lg" : "text-base",
                )}
                style={{ color: THEME.dim }}
            >
                {label}
            </div>
            <div
                className={cn(
                    "font-mono leading-none",
                    strong ? "text-5xl font-bold" : "text-2xl",
                )}
            >
                {value}
            </div>
        </div>
    );
}

function CapacityFigure({
    label,
    value,
    swatch,
}: {
    label: string;
    value: string;
    swatch?: string;
}) {
    return (
        <div>
            <div
                className="flex items-center gap-1.5 text-[15px] tracking-wide whitespace-nowrap uppercase"
                style={{ color: THEME.dim }}
            >
                {swatch && (
                    <span
                        className="inline-block size-3 shrink-0"
                        style={{ background: swatch }}
                    />
                )}
                {label}
            </div>
            <div className="font-mono text-2xl font-semibold whitespace-nowrap">
                {value}
            </div>
        </div>
    );
}

// --- carbon ---------------------------------------------------------------------------------------

export function CarbonTaxPill({
    status,
}: {
    status: ControlRoom["carbon_tax"];
}) {
    const [label, color] =
        status.since !== null
            ? [`TAX ${taxPerTonne(status.rate)}/t`, THEME.good]
            : status.vote_open
              ? ["TAX VOTE OPEN", THEME.warn]
              : ["NO TAX", THEME.dim];
    return (
        <span
            className="rounded-sm border-2 px-2 font-mono text-base font-bold tracking-normal normal-case"
            style={{ borderColor: color, color }}
        >
            {label}
        </span>
    );
}

export function Carbon({ rounds }: { rounds: ControlRoom["emissions"] }) {
    const option = useMemo<ControlRoomChartOption>(
        () => ({
            grid: { left: 4, right: 4, top: 22, bottom: 22 },
            xAxis: {
                type: "category",
                data: rounds.map((r) => `R${r.round}`),
                axisLabel: axisLabel(13),
                axisTick: { show: false },
                axisLine: { lineStyle: { color: THEME.grid } },
            },
            yAxis: { type: "value", show: false },
            series: [
                {
                    type: "bar",
                    data: rounds.map((r) => ({
                        value: r.emissions,
                        // The current Round is still running.
                        itemStyle: {
                            color: r.complete ? THEME.bar : THEME.barPartial,
                        },
                    })),
                    barWidth: "55%",
                    barMaxWidth: 50,
                    label: {
                        show: rounds.length <= 4,
                        position: "top",
                        color: THEME.ink,
                        fontSize: 13,
                        fontFamily: MONO,
                        formatter: ({ value }) => formatCo2(Number(value)),
                    },
                },
            ],
        }),
        [rounds],
    );
    const total = rounds.reduce((sum, r) => sum + r.emissions, 0);
    if (total === 0) return <Empty>{NOTHING_SETTLED}</Empty>;
    const lastComplete = rounds.findLast((r) => r.complete);
    const recent = lastComplete ?? rounds.at(-1);
    return (
        <div className="flex h-full gap-4" style={{ color: THEME.ink }}>
            <div className="flex shrink-0 flex-col justify-center gap-3">
                <div>
                    <div
                        className="text-base tracking-wider uppercase"
                        style={{ color: THEME.dim }}
                    >
                        Session total
                    </div>
                    <div className="font-mono text-4xl font-bold">
                        {formatCo2(total)}
                        <span
                            className="text-xl font-normal"
                            style={{ color: THEME.dim }}
                        >
                            {" "}
                            CO₂
                        </span>
                    </div>
                </div>
                {recent && (
                    <div>
                        <div
                            className="text-base tracking-wider uppercase"
                            style={{ color: THEME.dim }}
                        >
                            {lastComplete
                                ? `Round ${lastComplete.round}`
                                : "This Round so far"}
                        </div>
                        <div className="font-mono text-2xl">
                            {formatCo2(recent.emissions)}
                        </div>
                    </div>
                )}
            </div>
            <div className="min-h-0 min-w-0 flex-1">
                <EChart option={option} />
            </div>
        </div>
    );
}

// --- market prices and the duration curve ---------------------------------------------------------

export function MarketPrices({ seasons }: { seasons: ControlRoom["seasons"] }) {
    const option = useMemo<ControlRoomChartOption>(
        () => ({
            grid: { left: 48, right: 10, top: 26, bottom: 40 },
            xAxis: categoryAxis(
                seasons.map((s) => periodLabel(s.round, s.season)),
            ),
            yAxis: valueAxis("per MWh"),
            series: [
                // A transparent bar up to the 10th percentile lifts the band to it.
                {
                    type: "bar",
                    stack: "band",
                    data: seasons.map((s) => s.price_low ?? 0),
                    itemStyle: { color: "transparent" },
                    silent: true,
                },
                {
                    type: "bar",
                    stack: "band",
                    data: seasons.map((s) =>
                        s.price_low === null || s.price_high === null
                            ? 0
                            : s.price_high - s.price_low,
                    ),
                    barWidth: "55%",
                    barMaxWidth: 50,
                    itemStyle: {
                        color: THEME.accentBand,
                        borderColor: THEME.accentBorder,
                    },
                },
                {
                    type: "line",
                    data: seasons.map((s) => s.average_price),
                    symbolSize: 9,
                    lineStyle: { color: THEME.accent, width: 3 },
                    itemStyle: { color: THEME.accent },
                    label: {
                        show: true,
                        position: "top",
                        color: THEME.ink,
                        fontSize: 14,
                        formatter: ({ value }) =>
                            String(Math.round(Number(value))),
                    },
                },
            ],
        }),
        [seasons],
    );
    if (seasons.length === 0) return <Empty>{NOTHING_SETTLED}</Empty>;
    return <EChart option={option} />;
}

export function DurationCurve({
    curve,
}: {
    curve: ControlRoom["duration_curve"];
}) {
    const option = useMemo<ControlRoomChartOption>(() => {
        const prices = curve?.prices ?? [];
        return {
            grid: { left: 48, right: 10, top: 22, bottom: 26 },
            xAxis: {
                type: "category",
                data: prices.map(
                    (_, i) => `${Math.round((i / prices.length) * 100)}%`,
                ),
                axisLabel: {
                    ...axisLabel(13),
                    interval: Math.max(0, Math.floor(prices.length / 4) - 1),
                },
                axisLine: { lineStyle: { color: THEME.grid } },
            },
            yAxis: {
                ...valueAxis("per MWh"),
                max: PRICE_CAP,
                min: (extent: { min: number }) => Math.min(0, extent.min),
            },
            series: [
                {
                    type: "line",
                    data: prices,
                    symbol: "none",
                    lineStyle: { color: THEME.orange, width: 3 },
                    areaStyle: { color: THEME.orange, opacity: 0.15 },
                },
            ],
        };
    }, [curve]);
    if (!curve) return <Empty>{NOTHING_SETTLED}</Empty>;
    return <EChart option={option} />;
}

// --- the room's prices ----------------------------------------------------------------------------

export function RoomPriceBoxes({ periods }: { periods: RoomPrices[] }) {
    const scales = useMemo(() => priceScales(periods), [periods]);
    if (periods.length === 0)
        return (
            <Empty>Prices show once the first price-setting window opens</Empty>
        );
    return (
        <div className="grid h-full grid-cols-4 grid-rows-2 gap-x-4 gap-y-2">
            {PRICE_GROUPS.map(({ group, name, scale }) => (
                <PriceBox
                    key={group}
                    periods={periods}
                    group={group}
                    name={name}
                    max={scales[scale]}
                />
            ))}
        </div>
    );
}

const MIN_BOX_HEIGHT = 6;
// White, so the median still shows on a flat box, or on the panel inside an open period's hollow box.
const MEDIAN_COLOR = "#ffffff";

/** The power source whose colour each price box takes. */
const GROUP_SOURCE: Record<PriceGroup, PowerSource> = {
    coal: "coal",
    gas: "gas",
    nuclear: "nuclear",
    hydro: "hydro",
    wind: "wind",
    solar: "solar",
    storage_sell: "storage",
    storage_buy: "storage",
};

function PriceBox({
    periods,
    group,
    name,
    max,
}: {
    periods: RoomPrices[];
    group: PriceGroup;
    name: string;
    max: number;
}) {
    const source = GROUP_SOURCE[group];
    const color = sourceColor(source);
    const option = useMemo<ControlRoomChartOption>(() => {
        // [index, low, q1, median, q3, high, uncapped high, live], each price capped to the scale.
        const rows = periods.flatMap((period, i) => {
            const box = period.boxes[group];
            if (!box) return [];
            const cap = (v: number) => Math.min(v, max);
            return [
                [
                    i,
                    cap(box.low),
                    cap(box.q1),
                    cap(box.median),
                    cap(box.q3),
                    cap(box.high),
                    box.high,
                    period.live ? 1 : 0,
                ],
            ];
        });
        return {
            grid: { left: 36, right: 4, top: 12, bottom: 6 },
            xAxis: {
                type: "category",
                data: periods.map((p) => periodLabel(p.round, p.season)),
                show: false,
            },
            yAxis: {
                type: "value",
                min: (extent: { min: number }) => Math.min(0, extent.min),
                max,
                interval: max / 2,
                axisLabel: axisLabel(12),
                splitLine: { lineStyle: { color: THEME.grid } },
            },
            series: [
                {
                    type: "custom",
                    data: rows,
                    renderItem: (_params, api) => {
                        const x = api.value(0) as number;
                        const y = (v: number) => api.coord([x, v])[1]!;
                        const cx = api.coord([x, 0])[0]!;
                        const yLow = y(api.value(1) as number);
                        const yQ1 = y(api.value(2) as number);
                        const yMedian = y(api.value(3) as number);
                        const yQ3 = y(api.value(4) as number);
                        const yHigh = y(api.value(5) as number);
                        const capped = (api.value(6) as number) > max;
                        // The open period's prices can still change: drawn hollow and dashed.
                        const live = api.value(7) === 1;
                        const band = (api.size!([1, 0]) as number[])[0]!;
                        const w = Math.min(band * 0.6, 28);
                        const whiskerCap = w * 0.4;
                        // Every player at one price makes a flat box: kept a few pixels tall so its colour shows.
                        const boxHeight = Math.max(yQ1 - yQ3, MIN_BOX_HEIGHT);
                        const boxTop = (yQ1 + yQ3 - boxHeight) / 2;
                        const line = { stroke: THEME.whisker, lineWidth: 1.5 };
                        return {
                            type: "group",
                            children: [
                                {
                                    type: "line",
                                    shape: {
                                        x1: cx,
                                        y1: yLow,
                                        x2: cx,
                                        y2: yHigh,
                                    },
                                    style: line,
                                },
                                {
                                    type: "line",
                                    shape: {
                                        x1: cx - whiskerCap,
                                        y1: yLow,
                                        x2: cx + whiskerCap,
                                        y2: yLow,
                                    },
                                    style: line,
                                },
                                // A whisker above the scale ends in an arrow.
                                capped
                                    ? {
                                          type: "polygon",
                                          shape: {
                                              points: [
                                                  [cx, yHigh - 8],
                                                  [cx - 6, yHigh + 3],
                                                  [cx + 6, yHigh + 3],
                                              ],
                                          },
                                          style: { fill: THEME.orange },
                                      }
                                    : {
                                          type: "line",
                                          shape: {
                                              x1: cx - whiskerCap,
                                              y1: yHigh,
                                              x2: cx + whiskerCap,
                                              y2: yHigh,
                                          },
                                          style: line,
                                      },
                                {
                                    type: "rect",
                                    shape: {
                                        x: cx - w / 2,
                                        y: boxTop,
                                        width: w,
                                        height: boxHeight,
                                    },
                                    style: live
                                        ? {
                                              fill: THEME.liveFill,
                                              stroke: color,
                                              lineWidth: 2,
                                              lineDash: [4, 3],
                                          }
                                        : {
                                              fill: color,
                                              stroke: THEME.whisker,
                                              lineWidth: 0.5,
                                          },
                                },
                                {
                                    type: "line",
                                    shape: {
                                        x1: cx - w / 2,
                                        y1: yMedian,
                                        x2: cx + w / 2,
                                        y2: yMedian,
                                    },
                                    style: {
                                        stroke: MEDIAN_COLOR,
                                        lineWidth: 2.5,
                                    },
                                },
                            ],
                        };
                    },
                },
            ],
        };
    }, [periods, group, max, color]);
    return (
        <div className="flex min-h-0 flex-col">
            <div
                className="text-[16px] leading-tight font-semibold tracking-wide uppercase"
                style={{ color: sourceTitleColor(source) }}
            >
                {name}
            </div>
            <div className="min-h-0 flex-1">
                {periods.some((period) => period.boxes[group]) ? (
                    <EChart option={option} />
                ) : (
                    <Empty>No prices</Empty>
                )}
            </div>
        </div>
    );
}

// --- generation per season ------------------------------------------------------------------------

const GENERATION_SOURCES: { source: PowerSource; name: string }[] = [
    { source: "nuclear", name: "Nuclear" },
    { source: "hydro", name: "Hydro" },
    { source: "coal", name: "Coal" },
    { source: "gas", name: "Gas" },
    { source: "wind", name: "Wind" },
    { source: "solar", name: "Solar" },
    { source: "storage", name: "Storage" },
];

export function Generation({ seasons }: { seasons: ControlRoom["seasons"] }) {
    const option = useMemo<ControlRoomChartOption>(() => {
        // Only the sources the room has generated with, so the legend stays short.
        const sources = GENERATION_SOURCES.filter(({ source }) =>
            seasons.some((s) => (s.generation[source] ?? 0) > 0),
        );
        const totals = seasons.map((s) =>
            Object.values(s.generation).reduce((sum, v) => sum + v, 0),
        );
        const { unit, divisor } = energyScale(Math.max(0, ...totals));
        return {
            grid: { left: 44, right: 8, top: 62, bottom: 40 },
            legend: {
                top: 0,
                textStyle: { color: THEME.ink, fontSize: 14 },
                itemWidth: 12,
                itemHeight: 12,
                itemGap: 10,
                icon: "rect",
            },
            xAxis: categoryAxis(
                seasons.map((s) => periodLabel(s.round, s.season)),
            ),
            yAxis: valueAxis(unit),
            series: sources.map(({ source, name }) => ({
                type: "bar",
                name,
                stack: "generation",
                data: seasons.map((s) => (s.generation[source] ?? 0) / divisor),
                barWidth: "62%",
                barMaxWidth: 50,
                itemStyle: { color: sourceColor(source) },
            })),
        };
    }, [seasons]);
    if (seasons.length === 0) return <Empty>{NOTHING_SETTLED}</Empty>;
    return <EChart option={option} />;
}

// --- fuel prices ----------------------------------------------------------------------------------

const FUEL_SOURCES: Record<ApiSchema<"Fuel">, PowerSource> = {
    coal: "coal",
    gas: "gas",
    uranium: "nuclear",
};

export function Fuels({ fuels }: { fuels: ControlRoom["fuels"] }) {
    return (
        <div className="flex h-full flex-col">
            {fuels.map((fuel) => (
                <FuelRow key={fuel.fuel} fuel={fuel} />
            ))}
        </div>
    );
}

/** A fuel's price and change, beside a chart of its last prices. */
function FuelRow({ fuel }: { fuel: ControlRoom["fuels"][number] }) {
    const source = FUEL_SOURCES[fuel.fuel];
    const color = sourceColor(source);
    const { value, unit } = fuelPrice(fuel.fuel, fuel.price);
    const change = fuel.change;
    const option = useMemo<ControlRoomChartOption>(() => {
        const prices = fuel.history.map(
            (price) => fuelPrice(fuel.fuel, price).value,
        );
        return {
            grid: { left: 4, right: 10, top: 10, bottom: 8 },
            xAxis: {
                type: "category",
                data: prices.map(String),
                show: false,
                boundaryGap: false,
            },
            yAxis: { type: "value", show: false, scale: true },
            series: [
                {
                    type: "line",
                    data: prices.map((price, i) => ({
                        value: price,
                        // A dot on this season's price.
                        symbol: i === prices.length - 1 ? "circle" : "none",
                        symbolSize: 10,
                    })),
                    lineStyle: { color, width: 3 },
                    itemStyle: { color },
                    areaStyle: { color, opacity: 0.15 },
                },
            ],
        };
    }, [fuel, color]);
    return (
        <div
            className="flex min-h-0 flex-1 items-center gap-2 border-b px-1 last:border-b-0"
            style={{ borderColor: THEME.grid }}
        >
            <div className="w-[48%] shrink-0">
                <div
                    className="flex items-baseline gap-3 text-lg leading-tight font-semibold tracking-wider uppercase"
                    style={{ color: sourceTitleColor(source) }}
                >
                    {fuel.name}
                    {change !== null && (
                        <span
                            className="font-mono font-normal tracking-normal"
                            style={{
                                color: change >= 0 ? THEME.up : THEME.down,
                            }}
                        >
                            {change >= 0 ? "▲" : "▼"}{" "}
                            {formatFixed(Math.abs(change) * 100, 1)}%
                        </span>
                    )}
                    {fuel.shocked && (
                        <span
                            className="rounded-sm border-2 px-1.5 font-mono text-sm font-bold tracking-normal"
                            style={{
                                borderColor: THEME.orange,
                                color: THEME.orange,
                            }}
                        >
                            SHOCK
                        </span>
                    )}
                </div>
                <div
                    className="flex items-center gap-1 font-mono text-[34px] leading-tight font-bold"
                    style={{ color: THEME.ink }}
                >
                    <CoinIcon className="size-7" />
                    {formatFixed(value, 0)}
                    <span
                        className="text-lg font-normal"
                        style={{ color: THEME.dim }}
                    >
                        {unit}
                    </span>
                </div>
            </div>
            <div className="min-h-0 min-w-0 flex-1 self-stretch">
                <EChart option={option} />
            </div>
        </div>
    );
}
