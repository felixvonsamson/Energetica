/**
 * PROTOTYPE (#1289) — throwaway. Variant D: variant B reworked after the first
 * review.
 *
 * - Left: alarms, market price per season and the price duration curve, a third
 *   of the height each.
 * - Centre: capacity against demand, then the room's prices per facility type
 *   beside the room's generation per season.
 * - Right: Round, phase and the countdown together, then fuel prices and carbon.
 *
 * `?periods=0` to `8` sets how many Trading periods have settled.
 */

import * as echarts from "echarts";
import { useMemo } from "react";

import { CoinIcon } from "@energetica/ui/components/coin-icon";
import { cn } from "@energetica/ui/lib/utils";

import { DIM, EChart, GRID_LINE, INK } from "./charts";
import { GENERATION_SOURCES, PRICE_TYPES, type Scene } from "./history";
import {
    ALARM_COLOR,
    ALL_TIERS_PEAK,
    CARBON_TAX,
    MUST_SERVE_PEAK,
    RISK_STYLE,
    type RoomCapacity,
    blackoutRisk,
} from "./mock-data";
import {
    Countdown,
    Panel,
    fmt,
    gw,
    useCountdown,
    useLiveCapacity,
} from "./panels";

const MONO = "ui-monospace, monospace";
const axisLabel = (fontSize: number) => ({
    color: DIM,
    fontSize,
    fontFamily: MONO,
});

function Empty({ children }: { children: string }) {
    return (
        <div
            className="flex h-full items-center justify-center text-xl italic"
            style={{ color: DIM }}
        >
            {children}
        </div>
    );
}

export function VariantD({ scene }: { scene: Scene }) {
    const seconds = useCountdown();
    const capacity = useLiveCapacity();
    return (
        <div className="grid h-full grid-cols-[470px_1fr_600px] gap-2 p-3">
            <div className="grid min-h-0 grid-rows-3 gap-2">
                <Panel title="Alarms">
                    <Alarms scene={scene} />
                </Panel>
                <Panel title="Market price per season">
                    <MarketPrices scene={scene} />
                </Panel>
                <Panel title="Price duration · last season">
                    <DurationCurve scene={scene} />
                </Panel>
            </div>

            <div className="flex min-h-0 flex-col gap-2">
                <Panel
                    title="Capacity vs must-serve demand"
                    className="h-[390px] shrink-0"
                >
                    <CapacityD capacity={capacity} />
                </Panel>
                <div className="grid min-h-0 flex-1 grid-cols-[1.2fr_1fr] gap-2">
                    <Panel title="Room prices per facility type">
                        <PriceBoxes scene={scene} />
                    </Panel>
                    <Panel title="Room generation per season">
                        <Generation scene={scene} />
                    </Panel>
                </div>
            </div>

            <div className="flex min-h-0 flex-col gap-2">
                <div
                    className="flex h-[170px] shrink-0 items-center justify-between px-2"
                    style={{ color: INK }}
                >
                    <div>
                        <div className="text-4xl font-bold tracking-wider whitespace-nowrap">
                            ROUND {scene.round}
                            <span style={{ color: DIM }}>
                                {" "}
                                / {scene.roundCount}
                            </span>
                        </div>
                        <div
                            className="mt-1 text-[28px] tracking-wide whitespace-nowrap uppercase"
                            style={{ color: "#4fc3ff" }}
                        >
                            {scene.phase}
                        </div>
                        <div className="mt-1 text-2xl" style={{ color: INK }}>
                            {scene.next}
                        </div>
                    </div>
                    <Countdown seconds={seconds} className="text-[96px]" />
                </div>
                <Panel title="Fuel prices" className="min-h-0 flex-[1.6]">
                    <Fuels scene={scene} />
                </Panel>
                <Panel
                    title="Carbon"
                    className="min-h-0 flex-1"
                    right={<CarbonTaxPill scene={scene} />}
                >
                    <Carbon scene={scene} />
                </Panel>
            </div>
        </div>
    );
}

// Alarms: the newest in full, on as many lines as they need; older ones on one short line.

const FULL_ALARMS = 4;

function Alarms({ scene }: { scene: Scene }) {
    if (scene.alarms.length === 0) return <Empty>No alarms</Empty>;
    return (
        <div className="flex h-full flex-col gap-1 overflow-hidden font-mono">
            {scene.alarms.map((alarm, i) =>
                i < FULL_ALARMS ? (
                    <div
                        key={`${alarm.when}-${alarm.tag}-${alarm.short}`}
                        className="border-l-[6px] bg-[#0e1828] px-2 py-0.5 text-[16px] leading-snug"
                        style={{
                            borderColor: ALARM_COLOR[alarm.level],
                            color: INK,
                        }}
                    >
                        <span style={{ color: DIM }}>{alarm.when}</span>{" "}
                        <span
                            className="font-bold"
                            style={{ color: ALARM_COLOR[alarm.level] }}
                        >
                            {alarm.tag}
                        </span>{" "}
                        {alarm.text}
                    </div>
                ) : (
                    <div
                        key={`${alarm.when}-${alarm.tag}-${alarm.short}`}
                        className="flex gap-2 border-l-[6px] px-2 text-[15px] leading-tight"
                        style={{
                            borderColor: ALARM_COLOR[alarm.level],
                            color: DIM,
                        }}
                    >
                        <span>{alarm.when}</span>
                        <span
                            className="font-bold"
                            style={{ color: ALARM_COLOR[alarm.level] }}
                        >
                            {alarm.tag}
                        </span>
                        <span className="truncate">{alarm.short}</span>
                    </div>
                ),
            )}
        </div>
    );
}

// Market prices and the duration curve

function MarketPrices({ scene }: { scene: Scene }) {
    const option = useMemo<echarts.EChartsOption>(() => {
        const low = scene.marketPrices.map((p) => p.p10);
        return {
            grid: { left: 48, right: 10, top: 26, bottom: 40 },
            xAxis: {
                type: "category",
                data: scene.periods,
                axisLabel: {
                    ...axisLabel(12),
                    interval: 0,
                    rotate: scene.periods.length > 5 ? 45 : 0,
                },
                axisTick: { show: false },
                axisLine: { lineStyle: { color: GRID_LINE } },
            },
            yAxis: {
                type: "value",
                name: "per MWh",
                nameTextStyle: { color: DIM, fontSize: 13 },
                axisLabel: axisLabel(13),
                splitLine: { lineStyle: { color: GRID_LINE } },
            },
            series: [
                {
                    type: "bar",
                    stack: "band",
                    data: low,
                    itemStyle: { color: "transparent" },
                    silent: true,
                },
                {
                    type: "bar",
                    stack: "band",
                    data: scene.marketPrices.map((p) => p.p90 - p.p10),
                    barWidth: "55%",
                    itemStyle: {
                        color: "rgba(79, 195, 255, 0.22)",
                        borderColor: "rgba(79,195,255,0.5)",
                    },
                },
                {
                    type: "line",
                    data: scene.marketPrices.map((p) => p.mean),
                    symbolSize: 9,
                    lineStyle: { color: "#4fc3ff", width: 3 },
                    itemStyle: { color: "#4fc3ff" },
                    label: {
                        show: true,
                        position: "top",
                        color: INK,
                        fontSize: 14,
                        formatter: ({ value }) =>
                            String(Math.round(Number(value))),
                    },
                },
            ],
        };
    }, [scene]);
    if (scene.settled === 0) return <Empty>No season settled yet</Empty>;
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
                axisLine: { lineStyle: { color: GRID_LINE } },
            },
            yAxis: {
                type: "value",
                name: "per MWh",
                max: 300,
                nameTextStyle: { color: DIM, fontSize: 13 },
                axisLabel: axisLabel(13),
                splitLine: { lineStyle: { color: GRID_LINE } },
            },
            series: [
                {
                    type: "line",
                    data: scene.durationCurve,
                    symbol: "none",
                    lineStyle: { color: "#ff8a1f", width: 3 },
                    areaStyle: { color: "rgba(255,138,31,0.15)" },
                },
            ],
        }),
        [scene],
    );
    if (scene.durationCurve.length === 0)
        return <Empty>No season settled yet</Empty>;
    return <EChart option={option} />;
}

// Capacity against demand (#1287)

function CapacityD({ capacity }: { capacity: RoomCapacity }) {
    const r = blackoutRisk(capacity);
    const style = RISK_STYLE[r.risk];
    const scaleMax = ALL_TIERS_PEAK * 1.08;
    const pct = (mw: number) => `${(Math.min(mw, scaleMax) / scaleMax) * 100}%`;
    const other = r.total - r.controllable;
    return (
        <div className="flex h-full flex-col gap-3" style={{ color: INK }}>
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
            <div className="relative h-[150px] shrink-0">
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
                <div className="absolute inset-x-0 bottom-0 h-14 rounded-sm bg-[#111b2c]">
                    <div
                        className="absolute inset-y-0 left-0 transition-all duration-700"
                        style={{
                            width: pct(r.controllable),
                            background: "#4fc3ff",
                        }}
                    />
                    <div
                        className="absolute inset-y-0 transition-all duration-700"
                        style={{
                            left: pct(r.controllable),
                            width: pct(other),
                            background:
                                "repeating-linear-gradient(135deg, #2b6e8f 0 10px, #1f5470 10px 20px)",
                        }}
                    />
                </div>
                <div
                    className="absolute top-0 -bottom-1.5"
                    style={{
                        left: pct(MUST_SERVE_PEAK),
                        borderLeft: "4px solid #fff",
                    }}
                />
                <div
                    className="absolute top-0 -bottom-1.5"
                    style={{
                        left: pct(ALL_TIERS_PEAK),
                        borderLeft: `2px dashed ${DIM}`,
                    }}
                />
            </div>

            <div className="grid grid-cols-5 gap-2">
                <Figure
                    label="Controllable"
                    value={gw(r.controllable)}
                    swatch="#4fc3ff"
                />
                <Figure
                    label="Weather-dep."
                    value={gw(other)}
                    swatch="#2b6e8f"
                />
                <Figure label="Total gen." value={gw(r.total)} />
                <Figure
                    label="Storage power"
                    value={gw(capacity.storagePower)}
                    swatch="rgb(199,162,133)"
                />
                <Figure
                    label="Storage cap."
                    value={`${fmt(capacity.storageEnergy / 1000, 1)} GWh`}
                    swatch="rgb(199,162,133)"
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
            style={{ right: `calc(100% - ${at})`, color: strong ? INK : DIM }}
        >
            <div
                className={cn(
                    "tracking-wider uppercase",
                    strong ? "text-lg" : "text-base",
                )}
                style={{ color: DIM }}
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
                style={{ color: DIM }}
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

// Room prices: one small chart per type, all on the same price scale

const WHISKER = "#8193ad";
const MEDIAN = "#05080d";

function niceMax(value: number) {
    const step = value > 200 ? 50 : 25;
    return Math.ceil(value / step) * step;
}

function PriceBoxes({ scene }: { scene: Scene }) {
    const max = useMemo(
        () =>
            niceMax(
                Math.max(1, ...scene.playerPrices.flat().map((box) => box[4]!)),
            ),
        [scene],
    );
    if (scene.priceLabels.length === 0) return <Empty>No prices set yet</Empty>;
    return (
        <div className="grid h-full grid-cols-2 grid-rows-4 gap-x-3 gap-y-1">
            {PRICE_TYPES.map((type, i) => (
                <PriceBox key={type.name} scene={scene} index={i} max={max} />
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
    const option = useMemo<echarts.EChartsOption>(() => {
        const rows = scene.playerPrices[index]!.map((box, i) => [i, ...box]);
        const last = rows.length - 1;
        return {
            grid: { left: 34, right: 4, top: 4, bottom: 4 },
            xAxis: { type: "category", data: scene.priceLabels, show: false },
            yAxis: {
                type: "value",
                min: 0,
                max,
                interval: max / 2,
                axisLabel: axisLabel(11),
                splitLine: { lineStyle: { color: GRID_LINE } },
            },
            series: [
                {
                    type: "custom",
                    data: rows,
                    renderItem: (params, api) => {
                        const x = api.value(0) as number;
                        const at = (v: number) => api.coord([x, v]);
                        const [cx, yMin] = at(api.value(1) as number) as [
                            number,
                            number,
                        ];
                        const yQ1 = at(api.value(2) as number)[1]!;
                        const yMed = at(api.value(3) as number)[1]!;
                        const yQ3 = at(api.value(4) as number)[1]!;
                        const yMax = at(api.value(5) as number)[1]!;
                        const band = (api.size!([1, 0]) as number[])[0]!;
                        const w = Math.min(band * 0.6, 28);
                        const cap = w * 0.4;
                        // The open period's prices are live: drawn hollow.
                        const live =
                            scene.livePeriod && params.dataIndex === last;
                        const line = { stroke: WHISKER, lineWidth: 1.5 };
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
                                {
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
                                              fill: "#0a1220",
                                              stroke: type.color,
                                              lineWidth: 2,
                                              lineDash: [4, 3],
                                          }
                                        : { fill: type.color },
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
                                        stroke: live ? type.color : MEDIAN,
                                        lineWidth: 2.5,
                                    },
                                },
                            ],
                        };
                    },
                },
            ],
        };
    }, [scene, index, max, type.color]);
    return (
        <div className="flex min-h-0 flex-col">
            <div
                className="text-[15px] leading-tight font-semibold tracking-wide uppercase"
                style={{ color: type.color }}
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
            grid: { left: 52, right: 8, top: 74, bottom: 26 },
            legend: {
                top: 0,
                textStyle: { color: INK, fontSize: 13 },
                itemWidth: 12,
                itemHeight: 12,
                itemGap: 8,
                icon: "rect",
            },
            xAxis: {
                type: "category",
                data: scene.periods,
                axisLabel: {
                    ...axisLabel(12),
                    interval: 0,
                    rotate: scene.periods.length > 5 ? 45 : 0,
                },
                axisTick: { show: false },
                axisLine: { lineStyle: { color: GRID_LINE } },
            },
            yAxis: {
                type: "value",
                name: "TWh",
                nameTextStyle: { color: DIM, fontSize: 13 },
                axisLabel: {
                    ...axisLabel(12),
                    formatter: (v: number) => fmt(v / 1000, 0),
                },
                splitLine: { lineStyle: { color: GRID_LINE } },
            },
            series: GENERATION_SOURCES.map((source, i) => ({
                type: "bar",
                name: source.name,
                stack: "generation",
                data: scene.generation[i],
                barWidth: "62%",
                barMaxWidth: 60,
                itemStyle: { color: source.color },
            })),
        }),
        [scene],
    );
    if (scene.settled === 0) return <Empty>No season settled yet</Empty>;
    return <EChart option={option} />;
}

// Fuel prices

function Fuels({ scene }: { scene: Scene }) {
    return (
        <div className="flex h-full flex-col gap-2">
            {scene.fuels.map((fuel) => (
                <div
                    key={fuel.name}
                    className="min-h-0 flex-1 border-b last:border-b-0"
                    style={{ borderColor: GRID_LINE }}
                >
                    <FuelRow fuel={fuel} />
                </div>
            ))}
        </div>
    );
}

function FuelRow({ fuel }: { fuel: Scene["fuels"][number] }) {
    const option = useMemo<echarts.EChartsOption>(
        () => ({
            grid: { left: 4, right: 8, top: 8, bottom: 6 },
            xAxis: {
                type: "category",
                data: fuel.labels,
                show: false,
                boundaryGap: false,
            },
            yAxis: { type: "value", show: false, scale: true },
            series: [
                {
                    type: "line",
                    data: fuel.prices,
                    symbol: "none",
                    lineStyle: { color: fuel.color, width: 3 },
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            {
                                offset: 0,
                                color: fuel.color
                                    .replace("rgb", "rgba")
                                    .replace(")", ", 0.35)"),
                            },
                            { offset: 1, color: "rgba(0,0,0,0)" },
                        ]),
                    },
                    markPoint: {
                        symbol: "circle",
                        symbolSize: 10,
                        itemStyle: { color: fuel.color },
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
        [fuel],
    );
    const now = fuel.prices[fuel.prices.length - 1]!;
    const before = fuel.prices[fuel.prices.length - 2];
    const change = before === undefined ? undefined : (now / before - 1) * 100;
    return (
        <div className="flex h-full min-h-0 items-center gap-2">
            <div className="w-[45%] shrink-0">
                <div
                    className="text-lg font-semibold tracking-wider uppercase"
                    style={{ color: fuel.color }}
                >
                    {fuel.name}
                </div>
                <div
                    className="flex items-center gap-1 font-mono text-4xl font-bold"
                    style={{ color: INK }}
                >
                    <CoinIcon className="size-7" />
                    {fmt(now, fuel.digits)}
                    <span
                        className="text-lg font-normal"
                        style={{ color: DIM }}
                    >
                        {fuel.unit}
                    </span>
                </div>
                {change !== undefined && (
                    <div
                        className="font-mono text-xl"
                        style={{ color: change >= 0 ? "#ff8a1f" : "#2fd67b" }}
                    >
                        {change >= 0 ? "▲" : "▼"} {fmt(Math.abs(change), 1)}%
                    </div>
                )}
            </div>
            <div className="min-h-0 min-w-0 flex-1 self-stretch">
                {fuel.prices.length > 1 ? (
                    <EChart option={option} />
                ) : (
                    <Empty>History starts next season</Empty>
                )}
            </div>
        </div>
    );
}

// Carbon

function CarbonTaxPill({ scene }: { scene: Scene }) {
    // The mock vote opens in Round 3, the first Round that holds one.
    const status = scene.settled >= 8 ? CARBON_TAX.status : "off";
    const label =
        status === "in-force"
            ? `TAX ${CARBON_TAX.rate}/t`
            : status === "vote-open"
              ? "TAX VOTE OPEN"
              : "NO TAX";
    const color =
        status === "in-force"
            ? "#2fd67b"
            : status === "vote-open"
              ? "#ffd21f"
              : DIM;
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
                data: scene.roundEmissions.map((_, i) => `R${i + 1}`),
                axisLabel: axisLabel(13),
                axisTick: { show: false },
                axisLine: { lineStyle: { color: GRID_LINE } },
            },
            yAxis: { type: "value", show: false },
            series: [
                {
                    type: "bar",
                    data: scene.roundEmissions.map((v, i) => ({
                        value: v,
                        // The current Round is still running.
                        itemStyle: {
                            color:
                                i * 4 + 4 > scene.settled
                                    ? "#4a5568"
                                    : "#9aa7b8",
                        },
                    })),
                    barWidth: "50%",
                    label: {
                        show: true,
                        position: "top",
                        color: INK,
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
    return (
        <div className="flex h-full gap-4" style={{ color: INK }}>
            <div className="flex shrink-0 flex-col justify-center gap-3">
                <div>
                    <div
                        className="text-base tracking-wider uppercase"
                        style={{ color: DIM }}
                    >
                        Last Round
                    </div>
                    <div className="font-mono text-4xl font-bold">
                        {scene.lastRoundEmissions === undefined
                            ? "—"
                            : `${fmt(scene.lastRoundEmissions / 1e6, 2)} Mt`}
                        <span
                            className="text-xl font-normal"
                            style={{ color: DIM }}
                        >
                            {" "}
                            CO₂
                        </span>
                    </div>
                </div>
                <div>
                    <div
                        className="text-base tracking-wider uppercase"
                        style={{ color: DIM }}
                    >
                        Session total
                    </div>
                    <div className="font-mono text-2xl">
                        {fmt(scene.totalEmissions / 1e6, 2)} Mt
                    </div>
                </div>
            </div>
            <div className="min-h-0 min-w-0 flex-1">
                {scene.roundEmissions.length > 0 && <EChart option={option} />}
            </div>
        </div>
    );
}
