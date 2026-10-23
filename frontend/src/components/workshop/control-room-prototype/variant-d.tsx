/**
 * PROTOTYPE (#1289) — throwaway. Variant D: variant B reworked after three
 * reviews, shown in three scenes (D1 to D3, see `SCENES` in `history.ts`) and
 * in a light or dark theme (`?theme=`).
 *
 * - Left: carbon, market price per season and the price duration curve, a third
 *   of the height each.
 * - Centre: alarms, capacity against demand, then the room's prices per facility
 *   type.
 * - Right: Round, phase and the countdown together, then fuel prices and the
 *   room's generation per season.
 *
 * Facility colours are the app's own, read from its `--asset-color-*` variables
 * in the page's theme.
 */

import * as echarts from "echarts";
import { type ReactNode, useMemo } from "react";

import { CoinIcon } from "@energetica/ui/components/coin-icon";
import { cn } from "@energetica/ui/lib/utils";

import { EChart } from "./charts";
import {
    GENERATION_SOURCES,
    PRICE_TYPES,
    type PriceGroup,
    type Scene,
} from "./history";
import {
    ALL_TIERS_PEAK,
    MUST_SERVE_PEAK,
    RISK_STYLE,
    type RoomCapacity,
    blackoutRisk,
} from "./mock-data";
import { clock, fmt, gw, useCountdown, useLiveCapacity } from "./panels";
import { type CrTheme, THEMES, assetColor, titleColor } from "./theme";

// The theme of the page being rendered. Set by VariantD before its children render; the route
// remounts the variant when the theme changes, so every memoised chart option picks it up.
let t: CrTheme = THEMES.dark;

const MONO = "ui-monospace, monospace";
const axisLabel = (fontSize: number) => ({
    color: t.dim,
    fontSize,
    fontFamily: MONO,
});
const withAlpha = (rgb: string, alpha: number) =>
    rgb.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);

function Empty({ children }: { children: string }) {
    return (
        <div
            className="flex h-full items-center justify-center text-center text-xl italic"
            style={{ color: t.dim }}
        >
            {children}
        </div>
    );
}

const NOTHING_SETTLED = "Fills in once the first season has settled";

function Panel({
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
            style={{ borderColor: t.border, background: t.panel }}
        >
            <header
                className="flex items-center justify-between border-b px-3 py-1.5 text-[15px] font-semibold tracking-[0.14em] uppercase"
                style={{ borderColor: t.border, color: t.dim }}
            >
                <span>{title}</span>
                {right}
            </header>
            <div className="min-h-0 flex-1 p-2">{children}</div>
        </section>
    );
}

export function VariantD({
    scene,
    theme,
}: {
    scene: Scene;
    theme: "light" | "dark";
}) {
    // eslint-disable-next-line react-hooks/globals -- prototype: see the note on `t`
    t = THEMES[theme];
    const seconds = useCountdown();
    const capacity = useLiveCapacity();
    const urgent = seconds < 60;
    return (
        <div
            className="grid h-full grid-cols-[470px_1fr_540px] gap-2 p-3"
            style={{ background: t.bg }}
        >
            <div className="grid min-h-0 grid-rows-3 gap-2">
                <Panel title="Carbon" right={<CarbonTaxPill scene={scene} />}>
                    <Carbon scene={scene} />
                </Panel>
                <Panel title="Market price per season">
                    <MarketPrices scene={scene} />
                </Panel>
                <Panel title="Price duration · last season">
                    <DurationCurve scene={scene} />
                </Panel>
            </div>

            <div className="flex min-h-0 flex-col gap-2">
                <Panel title="Alarms" className="h-[250px] shrink-0">
                    <Alarms scene={scene} />
                </Panel>
                <Panel
                    title="Capacity vs must-serve demand"
                    className="h-[352px] shrink-0"
                >
                    <CapacityD capacity={capacity} />
                </Panel>
                <Panel
                    title="Room prices per facility type"
                    className="min-h-0 flex-1"
                >
                    <PriceBoxes scene={scene} />
                </Panel>
            </div>

            <div className="flex min-h-0 flex-col gap-2">
                <div
                    className="flex h-[150px] shrink-0 items-center justify-between px-1"
                    style={{ color: t.ink }}
                >
                    <div>
                        <div className="text-4xl font-bold tracking-wider whitespace-nowrap">
                            ROUND {scene.round}
                            <span style={{ color: t.dim }}>
                                {" "}
                                / {scene.roundCount}
                            </span>
                        </div>
                        <div
                            className="mt-1 text-[24px] tracking-wide whitespace-nowrap uppercase"
                            style={{ color: t.accent }}
                        >
                            {scene.phase}
                        </div>
                        <div className="mt-1 text-2xl whitespace-nowrap">
                            {scene.next}
                        </div>
                    </div>
                    <div
                        className={cn(
                            "font-mono text-[88px] leading-none font-bold tabular-nums",
                            urgent && "animate-pulse",
                        )}
                        style={{ color: urgent ? t.alarm.critical : t.ink }}
                    >
                        {clock(seconds)}
                    </div>
                </div>
                <Panel title="Fuel prices" className="min-h-0 flex-1">
                    <Fuels scene={scene} />
                </Panel>
                <Panel
                    title="Room generation per season"
                    className="min-h-0 flex-[1.35]"
                >
                    <Generation scene={scene} />
                </Panel>
            </div>
        </div>
    );
}

// Alarms: one line each. The newest give the full text; older ones only a word or two.

const FULL_ALARMS = 4;
const MAX_ALARMS = 5;

function Alarms({ scene }: { scene: Scene }) {
    if (scene.alarms.length === 0) return <Empty>No alarms</Empty>;
    return (
        <div className="flex h-full flex-col gap-1 overflow-hidden font-mono">
            {scene.alarms.slice(0, MAX_ALARMS).map((alarm, i) => {
                const full = i < FULL_ALARMS;
                return (
                    <div
                        key={`${alarm.when}-${alarm.tag}-${alarm.short}`}
                        className={cn(
                            "flex shrink-0 items-baseline gap-3 border-l-[6px] px-2 whitespace-nowrap",
                            full && "py-0.5",
                        )}
                        style={{
                            borderColor: t.alarm[alarm.level],
                            background: full ? t.row : undefined,
                        }}
                    >
                        <span
                            className="w-[70px] shrink-0 text-[19px]"
                            style={{ color: t.dim }}
                        >
                            {alarm.when}
                        </span>
                        <span
                            className="w-[112px] shrink-0 text-[19px] font-bold"
                            style={{ color: t.alarm[alarm.level] }}
                        >
                            {alarm.tag}
                        </span>
                        <span
                            className="truncate text-[17px]"
                            style={{ color: full ? t.ink : t.dim }}
                        >
                            {full ? alarm.text : alarm.short}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

// Market prices and the duration curve

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
        axisLine: { lineStyle: { color: t.grid } },
    };
}

function valueAxis(name: string) {
    return {
        type: "value" as const,
        name,
        nameTextStyle: { color: t.dim, fontSize: 13 },
        axisLabel: axisLabel(13),
        splitLine: { lineStyle: { color: t.grid } },
    };
}

function MarketPrices({ scene }: { scene: Scene }) {
    const option = useMemo<echarts.EChartsOption>(
        () => ({
            grid: { left: 48, right: 10, top: 26, bottom: 40 },
            xAxis: categoryAxis(scene.periods),
            yAxis: valueAxis("per MWh"),
            series: [
                {
                    type: "bar",
                    stack: "band",
                    data: scene.marketPrices.map((p) => p.p10),
                    itemStyle: { color: "transparent" },
                    silent: true,
                },
                {
                    type: "bar",
                    stack: "band",
                    data: scene.marketPrices.map((p) => p.p90 - p.p10),
                    barWidth: "55%",
                    barMaxWidth: 50,
                    itemStyle: {
                        color: t.accentBand,
                        borderColor: t.accentBorder,
                    },
                },
                {
                    type: "line",
                    data: scene.marketPrices.map((p) => p.mean),
                    symbolSize: 9,
                    lineStyle: { color: t.accent, width: 3 },
                    itemStyle: { color: t.accent },
                    label: {
                        show: true,
                        position: "top",
                        color: t.ink,
                        fontSize: 14,
                        formatter: ({ value }) =>
                            String(Math.round(Number(value))),
                    },
                },
            ],
        }),
        [scene],
    );
    if (scene.marketPrices.length === 0)
        return <Empty>{NOTHING_SETTLED}</Empty>;
    return <EChart option={option} />;
}

function DurationCurve({ scene }: { scene: Scene }) {
    const option = useMemo<echarts.EChartsOption>(
        () => ({
            grid: { left: 48, right: 10, top: 22, bottom: 26 },
            xAxis: {
                type: "category",
                data: scene.durationCurve.map(
                    (_, i) =>
                        `${Math.round((i / scene.durationCurve.length) * 100)}%`,
                ),
                axisLabel: {
                    ...axisLabel(13),
                    interval: Math.floor(scene.durationCurve.length / 4),
                },
                axisLine: { lineStyle: { color: t.grid } },
            },
            yAxis: { ...valueAxis("per MWh"), max: 300 },
            series: [
                {
                    type: "line",
                    data: scene.durationCurve,
                    symbol: "none",
                    lineStyle: { color: t.orange, width: 3 },
                    areaStyle: { color: t.orange, opacity: 0.15 },
                },
            ],
        }),
        [scene],
    );
    if (scene.durationCurve.length === 0)
        return <Empty>{NOTHING_SETTLED}</Empty>;
    return <EChart option={option} />;
}

// Capacity against demand (#1287)

function CapacityD({ capacity }: { capacity: RoomCapacity }) {
    const r = blackoutRisk(capacity);
    const style = RISK_STYLE[r.risk];
    const scaleMax = ALL_TIERS_PEAK * 1.08;
    const pct = (mw: number) => `${(Math.min(mw, scaleMax) / scaleMax) * 100}%`;
    const other = r.total - r.controllable;
    const storage = assetColor("lithium-ion-batteries");
    return (
        <div
            className="flex h-full flex-col gap-3 pb-2"
            style={{ color: t.ink }}
        >
            <div
                className={cn(
                    "rounded-sm py-1.5 text-center text-[44px] font-black tracking-[0.1em]",
                    r.risk === "guaranteed" && "animate-pulse",
                )}
                style={{ background: style.color, color: "#05080d" }}
            >
                {style.label}
            </div>

            {/* The two peaks, each written up to its mark on the bar */}
            <div className="relative h-[140px] shrink-0">
                <PeakLabel
                    at={pct(MUST_SERVE_PEAK)}
                    label="Must-serve peak"
                    value={gw(MUST_SERVE_PEAK)}
                    strong
                />
                <PeakLabel
                    at={pct(ALL_TIERS_PEAK)}
                    label="All demand tiers"
                    value={gw(ALL_TIERS_PEAK)}
                />
                <div
                    className="absolute inset-x-0 bottom-0 h-14 rounded-sm"
                    style={{ background: t.track }}
                >
                    <div
                        className="absolute inset-y-0 left-0 transition-all duration-700"
                        style={{
                            width: pct(r.controllable),
                            background: t.accent,
                        }}
                    />
                    <div
                        className="absolute inset-y-0 transition-all duration-700"
                        style={{
                            left: pct(r.controllable),
                            width: pct(other),
                            background: `repeating-linear-gradient(135deg, ${t.weather[0]} 0 10px, ${t.weather[1]} 10px 20px)`,
                        }}
                    />
                </div>
                <div
                    className="absolute top-0 -bottom-1.5"
                    style={{
                        left: pct(MUST_SERVE_PEAK),
                        borderLeft: `4px solid ${t.ink}`,
                    }}
                />
                <div
                    className="absolute top-0 -bottom-1.5"
                    style={{
                        left: pct(ALL_TIERS_PEAK),
                        borderLeft: `2px dashed ${t.dim}`,
                    }}
                />
            </div>

            <div className="grid grid-cols-5 gap-2">
                <Figure
                    label="Controllable"
                    value={gw(r.controllable)}
                    swatch={t.accent}
                />
                <Figure
                    label="Weather-dep."
                    value={gw(other)}
                    swatch={t.weather[0]}
                />
                <Figure label="Total gen." value={gw(r.total)} />
                <Figure
                    label="Storage power"
                    value={gw(capacity.storagePower)}
                    swatch={storage}
                />
                <Figure
                    label="Storage cap."
                    value={`${fmt(capacity.storageEnergy / 1000, 1)} GWh`}
                    swatch={storage}
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
                color: strong ? t.ink : t.dim,
            }}
        >
            <div
                className={cn(
                    "tracking-wider uppercase",
                    strong ? "text-lg" : "text-base",
                )}
                style={{ color: t.dim }}
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

function Figure({
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
                style={{ color: t.dim }}
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

// Room prices: controllable types share a scale, as do renewables and storage. Above 300 the
// whisker stops at the top with an arrow.

const PRICE_CAP = 300;

function niceMax(value: number) {
    const step = value > 100 ? 50 : 20;
    return Math.min(PRICE_CAP, Math.ceil(value / step) * step);
}

function PriceBoxes({ scene }: { scene: Scene }) {
    const scales = useMemo(() => {
        const out = {} as Record<PriceGroup, number>;
        for (const group of ["controllable", "renewable", "storage"] as const) {
            const tops = PRICE_TYPES.flatMap((type, i) =>
                type.group === group
                    ? scene.playerPrices[i]!.map((box) => box[4]!)
                    : [],
            );
            out[group] = niceMax(Math.max(1, ...tops));
        }
        return out;
    }, [scene]);
    if (scene.priceLabels.length === 0)
        return (
            <Empty>Prices show once the first price-setting window opens</Empty>
        );
    return (
        <div className="grid h-full grid-cols-4 grid-rows-2 gap-x-4 gap-y-2">
            {PRICE_TYPES.map((type, i) => (
                <PriceBox
                    key={type.name}
                    scene={scene}
                    index={i}
                    max={scales[type.group]}
                />
            ))}
        </div>
    );
}

function PriceBox({
    scene,
    index,
    max,
}: {
    scene: Scene;
    index: number;
    max: number;
}) {
    const type = PRICE_TYPES[index]!;
    const color = assetColor(type.asset);
    const option = useMemo<echarts.EChartsOption>(() => {
        const rows = scene.playerPrices[index]!.map((box, i) => [
            i,
            ...box.map((v) => Math.min(v, max)),
            box[4]!,
        ]);
        const last = rows.length - 1;
        return {
            grid: { left: 36, right: 4, top: 12, bottom: 6 },
            xAxis: { type: "category", data: scene.priceLabels, show: false },
            yAxis: {
                type: "value",
                min: 0,
                max,
                interval: max / 2,
                axisLabel: axisLabel(12),
                splitLine: { lineStyle: { color: t.grid } },
            },
            series: [
                {
                    type: "custom",
                    data: rows,
                    renderItem: (params, api) => {
                        const x = api.value(0) as number;
                        const y = (v: number) => api.coord([x, v])[1]!;
                        const cx = api.coord([x, 0])[0]!;
                        const yMin = y(api.value(1) as number);
                        const yQ1 = y(api.value(2) as number);
                        const yMed = y(api.value(3) as number);
                        const yQ3 = y(api.value(4) as number);
                        const yMax = y(api.value(5) as number);
                        const capped = (api.value(6) as number) > max;
                        const band = (api.size!([1, 0]) as number[])[0]!;
                        const w = Math.min(band * 0.6, 28);
                        const cap = w * 0.4;
                        // The open period's prices are live: drawn hollow and dashed.
                        const live =
                            scene.livePeriod && params.dataIndex === last;
                        const line = { stroke: t.whisker, lineWidth: 1.5 };
                        return {
                            type: "group",
                            children: [
                                {
                                    type: "line",
                                    shape: {
                                        x1: cx,
                                        y1: yMin,
                                        x2: cx,
                                        y2: yMax,
                                    },
                                    style: line,
                                },
                                {
                                    type: "line",
                                    shape: {
                                        x1: cx - cap,
                                        y1: yMin,
                                        x2: cx + cap,
                                        y2: yMin,
                                    },
                                    style: line,
                                },
                                capped
                                    ? {
                                          type: "polygon",
                                          shape: {
                                              points: [
                                                  [cx, yMax - 8],
                                                  [cx - 6, yMax + 3],
                                                  [cx + 6, yMax + 3],
                                              ],
                                          },
                                          style: { fill: t.orange },
                                      }
                                    : {
                                          type: "line",
                                          shape: {
                                              x1: cx - cap,
                                              y1: yMax,
                                              x2: cx + cap,
                                              y2: yMax,
                                          },
                                          style: line,
                                      },
                                {
                                    type: "rect",
                                    shape: {
                                        x: cx - w / 2,
                                        y: yQ3,
                                        width: w,
                                        height: yQ1 - yQ3,
                                    },
                                    style: live
                                        ? {
                                              fill: t.liveFill,
                                              stroke: color,
                                              lineWidth: 2,
                                              lineDash: [4, 3],
                                          }
                                        : {
                                              fill: color,
                                              stroke: t.whisker,
                                              lineWidth: 0.5,
                                          },
                                },
                                {
                                    type: "line",
                                    shape: {
                                        x1: cx - w / 2,
                                        y1: yMed,
                                        x2: cx + w / 2,
                                        y2: yMed,
                                    },
                                    style: {
                                        stroke: live ? color : "#000000",
                                        lineWidth: 2.5,
                                    },
                                },
                            ],
                        };
                    },
                },
            ],
        };
    }, [scene, index, max, color]);
    return (
        <div className="flex min-h-0 flex-col">
            <div
                className="text-[16px] leading-tight font-semibold tracking-wide uppercase"
                style={{ color: titleColor(type.asset, t) }}
            >
                {type.name}
            </div>
            <div className="min-h-0 flex-1">
                <EChart option={option} />
            </div>
        </div>
    );
}

// Generation per season

function Generation({ scene }: { scene: Scene }) {
    const option = useMemo<echarts.EChartsOption>(
        () => ({
            grid: { left: 44, right: 8, top: 62, bottom: 40 },
            legend: {
                top: 0,
                textStyle: { color: t.ink, fontSize: 14 },
                itemWidth: 12,
                itemHeight: 12,
                itemGap: 10,
                icon: "rect",
            },
            xAxis: categoryAxis(scene.periods),
            yAxis: {
                ...valueAxis("TWh"),
                axisLabel: {
                    ...axisLabel(12),
                    formatter: (v: number) => fmt(v / 1000, 0),
                },
            },
            series: GENERATION_SOURCES.map((source, i) => ({
                type: "bar",
                name: source.name,
                stack: "generation",
                data: scene.generation[i],
                barWidth: "62%",
                barMaxWidth: 50,
                itemStyle: { color: assetColor(source.asset) },
            })),
        }),
        [scene],
    );
    if (scene.periods.length === 0) return <Empty>{NOTHING_SETTLED}</Empty>;
    return <EChart option={option} />;
}

// Fuel prices: always the last few prices, those from before the session included.

function Fuels({ scene }: { scene: Scene }) {
    return (
        <div className="flex h-full flex-col gap-1">
            {scene.fuels.map((fuel) => (
                <div
                    key={fuel.name}
                    className="min-h-0 flex-1 border-b last:border-b-0"
                    style={{ borderColor: t.grid }}
                >
                    <FuelRow fuel={fuel} />
                </div>
            ))}
        </div>
    );
}

function FuelRow({ fuel }: { fuel: Scene["fuels"][number] }) {
    const color = assetColor(fuel.asset);
    const option = useMemo<echarts.EChartsOption>(
        () => ({
            grid: { left: 4, right: 8, top: 8, bottom: 6 },
            xAxis: {
                type: "category",
                data: fuel.prices.map(String),
                show: false,
                boundaryGap: false,
            },
            yAxis: { type: "value", show: false, scale: true },
            series: [
                {
                    type: "line",
                    data: fuel.prices,
                    symbol: "none",
                    lineStyle: { color, width: 3 },
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: withAlpha(color, 0.35) },
                            { offset: 1, color: withAlpha(color, 0) },
                        ]),
                    },
                    markPoint: {
                        symbol: "circle",
                        symbolSize: 10,
                        itemStyle: { color },
                        label: { show: false },
                        data: [
                            {
                                name: "now",
                                coord: [
                                    fuel.prices.length - 1,
                                    fuel.prices[fuel.prices.length - 1]!,
                                ],
                            },
                        ],
                    },
                },
            ],
        }),
        [fuel, color],
    );
    const now = fuel.prices[fuel.prices.length - 1]!;
    const before = fuel.prices[fuel.prices.length - 2]!;
    const change = (now / before - 1) * 100;
    return (
        <div className="flex h-full min-h-0 items-center gap-2">
            <div className="w-[44%] shrink-0">
                <div
                    className="text-lg leading-tight font-semibold tracking-wider uppercase"
                    style={{ color: titleColor(fuel.asset, t) }}
                >
                    {fuel.name}
                    <span
                        className="ml-3 font-mono text-lg font-normal tracking-normal"
                        style={{ color: change >= 0 ? t.up : t.down }}
                    >
                        {change >= 0 ? "▲" : "▼"} {fmt(Math.abs(change), 1)}%
                    </span>
                </div>
                <div
                    className="flex items-center gap-1 font-mono text-[34px] leading-tight font-bold"
                    style={{ color: t.ink }}
                >
                    <CoinIcon className="size-7" />
                    {fmt(now, fuel.digits)}
                    <span
                        className="text-lg font-normal"
                        style={{ color: t.dim }}
                    >
                        {fuel.unit}
                    </span>
                </div>
            </div>
            <div className="min-h-0 min-w-0 flex-1 self-stretch">
                <EChart option={option} />
            </div>
        </div>
    );
}

// Carbon

function CarbonTaxPill({ scene }: { scene: Scene }) {
    const label =
        scene.carbonTax === "in-force"
            ? "TAX 40/t"
            : scene.carbonTax === "vote-open"
              ? "TAX VOTE OPEN"
              : "NO TAX";
    const color =
        scene.carbonTax === "in-force"
            ? t.good
            : scene.carbonTax === "vote-open"
              ? t.warn
              : t.dim;
    return (
        <span
            className="rounded-sm border-2 px-2 font-mono text-base font-bold tracking-normal normal-case"
            style={{ borderColor: color, color }}
        >
            {label}
        </span>
    );
}

function Carbon({ scene }: { scene: Scene }) {
    const option = useMemo<echarts.EChartsOption>(
        () => ({
            grid: { left: 4, right: 4, top: 22, bottom: 22 },
            xAxis: {
                type: "category",
                data: scene.roundEmissions.map((r) => r.label),
                axisLabel: axisLabel(13),
                axisTick: { show: false },
                axisLine: { lineStyle: { color: t.grid } },
            },
            yAxis: { type: "value", show: false },
            series: [
                {
                    type: "bar",
                    data: scene.roundEmissions.map((r) => ({
                        value: r.value,
                        // The current Round is still running.
                        itemStyle: { color: r.partial ? t.barPartial : t.bar },
                    })),
                    barWidth: "55%",
                    barMaxWidth: 50,
                    label: {
                        show: scene.roundEmissions.length <= 4,
                        position: "top",
                        color: t.ink,
                        fontSize: 13,
                        fontFamily: MONO,
                        formatter: ({ value }) =>
                            `${fmt(Number(value) / 1e6, 2)} Mt`,
                    },
                },
            ],
        }),
        [scene],
    );
    if (scene.settled === 0) return <Empty>{NOTHING_SETTLED}</Empty>;
    const recent =
        scene.lastRoundEmissions ?? scene.roundEmissions.at(-1)!.value;
    return (
        <div className="flex h-full gap-4" style={{ color: t.ink }}>
            <div className="flex shrink-0 flex-col justify-center gap-3">
                <div>
                    <div
                        className="text-base tracking-wider uppercase"
                        style={{ color: t.dim }}
                    >
                        Session total
                    </div>
                    <div className="font-mono text-4xl font-bold">
                        {fmt(scene.totalEmissions / 1e6, 2)} Mt
                        <span
                            className="text-xl font-normal"
                            style={{ color: t.dim }}
                        >
                            {" "}
                            CO₂
                        </span>
                    </div>
                </div>
                <div>
                    <div
                        className="text-base tracking-wider uppercase"
                        style={{ color: t.dim }}
                    >
                        {scene.lastRoundEmissions === undefined
                            ? "This Round so far"
                            : "Last Round"}
                    </div>
                    <div className="font-mono text-2xl">
                        {fmt(recent / 1e6, 2)} Mt
                    </div>
                </div>
            </div>
            <div className="min-h-0 min-w-0 flex-1">
                <EChart option={option} />
            </div>
        </div>
    );
}
