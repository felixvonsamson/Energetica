/**
 * PROTOTYPE (#1289) — throwaway. The control room's panels, shared by the
 * layout variants. Each variant arranges and sizes them its own way.
 */

import { type ReactNode, useEffect, useMemo, useState } from "react";

import { CoinIcon } from "@energetica/ui/components/coin-icon";
import { cn } from "@energetica/ui/lib/utils";

import {
    DIM,
    EChart,
    INK,
    durationCurveOption,
    emissionsOption,
    fuelSparkline,
    generationMixOption,
    marketPricesOption,
    playerPriceBoxes,
} from "./charts";
import {
    ALARM_COLOR,
    ALARMS,
    ALL_TIERS_PEAK,
    BASE_CAPACITY,
    CARBON_TAX,
    EMISSIONS,
    FUELS,
    MUST_SERVE_PEAK,
    PRICE_TYPES,
    RISK_STYLE,
    type RoomCapacity,
    SESSION,
    blackoutRisk,
} from "./mock-data";

// Live mock behaviour

/** The phase countdown, which starts again when it reaches zero. */
export function useCountdown() {
    const [left, setLeft] = useState(SESSION.phaseSeconds);
    useEffect(() => {
        const id = setInterval(
            () => setLeft((s) => (s <= 0 ? SESSION.phaseSeconds : s - 1)),
            1000,
        );
        return () => clearInterval(id);
    }, []);
    return left;
}

/**
 * The room's capacity as players change their selection. It steps through a
 * scene for each risk level, so every label can be seen on the projector.
 */
const SCENES: Partial<RoomCapacity>[] = [
    {},
    { storagePower: 900, storageEnergy: 9000 },
    { fossil: 1700 },
    { fossil: 300, nuclear: 0, hydro: 300, wind: 500, solar: 400 },
];
export function useLiveCapacity() {
    const [scene, setScene] = useState(0);
    useEffect(() => {
        const id = setInterval(
            () => setScene((s) => (s + 1) % SCENES.length),
            6000,
        );
        return () => clearInterval(id);
    }, []);
    return { ...BASE_CAPACITY, ...SCENES[scene] };
}

// Formatting

export const gw = (mw: number) => `${(mw / 1000).toFixed(2)} GW`;
export const fmt = (n: number, digits = 0) =>
    n.toLocaleString("en-GB", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
export const clock = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

// Frame

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
                "flex min-h-0 min-w-0 flex-col rounded-sm border bg-[#0a1220]",
                className,
            )}
            style={{ borderColor: "#1d2b40" }}
        >
            <header
                className="flex items-center justify-between border-b px-3 py-1.5 text-[15px] font-semibold tracking-[0.14em] uppercase"
                style={{ borderColor: "#1d2b40", color: DIM }}
            >
                <span>{title}</span>
                {right}
            </header>
            <div className="min-h-0 flex-1 p-2">{children}</div>
        </section>
    );
}

// Header pieces

export function SessionStatus({ size = "md" }: { size?: "md" | "lg" }) {
    return (
        <div className="flex items-baseline gap-5" style={{ color: INK }}>
            <span
                className={cn(
                    "font-bold tracking-wider",
                    size === "lg" ? "text-5xl" : "text-4xl",
                )}
            >
                ROUND {SESSION.round}
                <span style={{ color: DIM }}> / {SESSION.roundCount}</span>
            </span>
            <span
                className={cn(
                    "tracking-wide",
                    size === "lg" ? "text-3xl" : "text-2xl",
                )}
                style={{ color: "#4fc3ff" }}
            >
                {SESSION.phase.toUpperCase()}
            </span>
            <span className="text-xl" style={{ color: DIM }}>
                next: {SESSION.nextSeason} · {SESSION.players} players
            </span>
        </div>
    );
}

export function Countdown({
    seconds,
    className,
}: {
    seconds: number;
    className?: string;
}) {
    const urgent = seconds < 60;
    return (
        <div
            className={cn(
                "font-mono leading-none font-bold tabular-nums",
                urgent && "animate-pulse",
                className,
            )}
            style={{ color: urgent ? "#ff3b3b" : INK }}
        >
            {clock(seconds)}
        </div>
    );
}

// Capacity against demand (#1287)

export function CapacityPanel({
    capacity,
    size,
    narrow,
}: {
    capacity: RoomCapacity;
    size: "compact" | "large";
    narrow?: boolean;
}) {
    const r = blackoutRisk(capacity);
    const style = RISK_STYLE[r.risk];
    const scaleMax = ALL_TIERS_PEAK * 1.08;
    const pct = (mw: number) => `${(Math.min(mw, scaleMax) / scaleMax) * 100}%`;
    const other = r.total - r.controllable;
    const big = size === "large";
    const label = (
        <div
            className={cn(
                "flex items-center justify-center rounded-sm py-2 text-center font-black tracking-[0.12em]",
                big ? "text-5xl" : "flex-1 text-3xl leading-tight",
                r.risk === "guaranteed" && "animate-pulse",
            )}
            style={{ background: style.color, color: "#05080d" }}
        >
            {style.label}
        </div>
    );
    const peaks = (
        <>
            <div className="shrink-0">
                <div
                    className="text-lg tracking-wider uppercase"
                    style={{ color: DIM }}
                >
                    Must-serve peak
                </div>
                <div
                    className={cn(
                        "font-mono font-bold",
                        big ? "text-6xl" : "text-4xl",
                    )}
                >
                    {gw(MUST_SERVE_PEAK)}
                </div>
            </div>
            <div className="shrink-0 text-right">
                <div
                    className="text-base tracking-wider uppercase"
                    style={{ color: DIM }}
                >
                    All demand tiers
                </div>
                <div
                    className={cn("font-mono", big ? "text-3xl" : "text-2xl")}
                    style={{ color: DIM }}
                >
                    {gw(ALL_TIERS_PEAK)}
                </div>
            </div>
        </>
    );
    return (
        <div
            className={cn("flex h-full flex-col", big ? "gap-3" : "gap-2")}
            style={{ color: INK }}
        >
            {big ? (
                <>
                    {label}
                    <div className="flex items-end justify-between">
                        {peaks}
                    </div>
                </>
            ) : (
                <div className="flex items-stretch gap-5">
                    {label}
                    {peaks}
                </div>
            )}

            {/* Generation bar against the two peaks */}
            <div
                className={cn(
                    "relative w-full shrink-0 rounded-sm bg-[#111b2c]",
                    big ? "h-20" : "h-10",
                )}
            >
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
                <Marker at={pct(MUST_SERVE_PEAK)} color="#ffffff" width={4} />
                <Marker at={pct(ALL_TIERS_PEAK)} color={DIM} width={2} dashed />
            </div>
            <div
                className={cn(
                    "grid gap-2",
                    big || narrow ? "grid-cols-3" : "grid-cols-5",
                )}
            >
                <Figure
                    label="Controllable"
                    value={gw(r.controllable)}
                    swatch="#4fc3ff"
                    big={big}
                />
                <Figure
                    label="Weather-dep."
                    value={gw(other)}
                    swatch="#2b6e8f"
                    big={big}
                />
                <Figure label="Total gen." value={gw(r.total)} big={big} />
                {!big && <StorageFigures capacity={capacity} big={big} />}
            </div>

            {big && (
                <div
                    className="mt-auto grid grid-cols-2 gap-2 border-t pt-2"
                    style={{ borderColor: "#1d2b40" }}
                >
                    <StorageFigures capacity={capacity} big={big} />
                </div>
            )}
        </div>
    );
}

function StorageFigures({
    capacity,
    big,
}: {
    capacity: RoomCapacity;
    big: boolean;
}) {
    return (
        <>
            <Figure
                label="Storage power"
                value={gw(capacity.storagePower)}
                swatch="rgb(199,162,133)"
                big={big}
            />
            <Figure
                label="Storage cap."
                value={`${fmt(capacity.storageEnergy / 1000, 1)} GWh`}
                swatch="rgb(199,162,133)"
                big={big}
            />
        </>
    );
}

function Marker({
    at,
    color,
    width,
    dashed,
}: {
    at: string;
    color: string;
    width: number;
    dashed?: boolean;
}) {
    return (
        <div
            className="absolute -inset-y-2"
            style={{
                left: at,
                borderLeft: `${width}px ${dashed ? "dashed" : "solid"} ${color}`,
            }}
        />
    );
}

function Figure({
    label,
    value,
    swatch,
    big,
}: {
    label: string;
    value: string;
    swatch?: string;
    big?: boolean;
}) {
    return (
        <div>
            <div
                className="flex items-center gap-2 text-base tracking-wide uppercase"
                style={{ color: DIM }}
            >
                {swatch && (
                    <span
                        className="inline-block size-3"
                        style={{ background: swatch }}
                    />
                )}
                {label}
            </div>
            <div
                className={cn(
                    "font-mono font-semibold",
                    big ? "text-3xl" : "text-2xl",
                )}
            >
                {value}
            </div>
        </div>
    );
}

// Fuel prices

export function FuelTile({
    index,
    direction,
}: {
    index: number;
    direction: "row" | "column";
}) {
    const fuel = FUELS[index]!;
    const option = useMemo(
        () => fuelSparkline(fuel.prices, fuel.color),
        [fuel],
    );
    const now = fuel.prices[fuel.prices.length - 1]!;
    const before = fuel.prices[fuel.prices.length - 2]!;
    const change = (now / before - 1) * 100;
    return (
        <div
            className={cn(
                "flex h-full min-h-0 gap-2",
                direction === "column" ? "flex-col" : "flex-row items-center",
            )}
        >
            <div className={cn(direction === "row" && "w-[44%] shrink-0")}>
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
                <div
                    className="font-mono text-xl"
                    style={{ color: change >= 0 ? "#ff8a1f" : "#2fd67b" }}
                >
                    {change >= 0 ? "▲" : "▼"} {fmt(Math.abs(change), 1)}%
                </div>
            </div>
            <div className="min-h-0 min-w-0 flex-1 self-stretch">
                <EChart option={option} />
            </div>
        </div>
    );
}

// Alarms

export function AlarmList({
    rows,
    compact,
}: {
    rows?: number;
    compact?: boolean;
}) {
    return (
        <div className="flex h-full flex-col gap-1 overflow-hidden font-mono">
            {ALARMS.slice(0, rows).map((alarm, i) => (
                <div
                    key={i}
                    className={cn(
                        "flex items-baseline gap-3 border-l-[6px] bg-[#0e1828] px-2",
                        compact ? "py-0.5 text-[17px]" : "py-1 text-[19px]",
                        alarm.level === "critical" && i < 6 && "animate-pulse",
                    )}
                    style={{
                        borderColor: ALARM_COLOR[alarm.level],
                        color: INK,
                    }}
                >
                    <span className="w-[72px] shrink-0" style={{ color: DIM }}>
                        {alarm.when}
                    </span>
                    <span
                        className="w-[100px] shrink-0 font-bold"
                        style={{ color: ALARM_COLOR[alarm.level] }}
                    >
                        {alarm.tag}
                    </span>
                    <span className="truncate">{alarm.text}</span>
                </div>
            ))}
        </div>
    );
}

/** The alarms as a band that scrolls sideways, like a news ticker. */
export function AlarmTicker() {
    const items = [...ALARMS, ...ALARMS];
    return (
        <div className="relative h-full overflow-hidden">
            <style>{`@keyframes cr-ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }`}</style>
            <div
                className="flex h-full w-max items-center gap-10 font-mono text-2xl whitespace-nowrap"
                style={{
                    animation: "cr-ticker 70s linear infinite",
                    color: INK,
                }}
            >
                {items.map((alarm, i) => (
                    <span key={i} className="flex items-center gap-3">
                        <span
                            className="size-3 rounded-full"
                            style={{ background: ALARM_COLOR[alarm.level] }}
                        />
                        <span style={{ color: DIM }}>{alarm.when}</span>
                        <span
                            className="font-bold"
                            style={{ color: ALARM_COLOR[alarm.level] }}
                        >
                            {alarm.tag}
                        </span>
                        {alarm.text}
                    </span>
                ))}
            </div>
        </div>
    );
}

// Carbon

export function CarbonStatus() {
    const label =
        CARBON_TAX.status === "in-force"
            ? `IN FORCE · ${CARBON_TAX.rate}/t`
            : CARBON_TAX.status === "vote-open"
              ? "VOTE OPEN"
              : "OFF";
    const color =
        CARBON_TAX.status === "in-force"
            ? "#2fd67b"
            : CARBON_TAX.status === "vote-open"
              ? "#ffd21f"
              : DIM;
    return (
        <div className="flex items-center gap-3">
            <span
                className="text-lg tracking-wider uppercase"
                style={{ color: DIM }}
            >
                Carbon tax
            </span>
            <span
                className="rounded-sm border-2 px-2 font-mono text-xl font-bold"
                style={{ borderColor: color, color }}
            >
                {label}
            </span>
        </div>
    );
}

export function Co2Meter({ chart = true }: { chart?: boolean }) {
    const last = EMISSIONS[EMISSIONS.length - 1]!;
    const before = EMISSIONS[EMISSIONS.length - 5]!;
    const total = EMISSIONS.reduce((a, b) => a + b, 0);
    const change = (last / before - 1) * 100;
    const option = useMemo(() => emissionsOption(13, false), []);
    return (
        <div className="flex h-full flex-col gap-1" style={{ color: INK }}>
            <div className="flex items-end justify-between">
                <div>
                    <div
                        className="text-base tracking-wider uppercase"
                        style={{ color: DIM }}
                    >
                        Last season
                    </div>
                    <div className="font-mono text-4xl font-bold">
                        {fmt(last / 1000)}k
                        <span
                            className="text-xl font-normal"
                            style={{ color: DIM }}
                        >
                            {" "}
                            t CO₂
                        </span>
                    </div>
                    <div
                        className="font-mono text-lg"
                        style={{ color: change > 0 ? "#ff8a1f" : "#2fd67b" }}
                    >
                        {change > 0 ? "▲" : "▼"} {fmt(Math.abs(change), 1)}% vs
                        a year before
                    </div>
                </div>
                <div className="text-right">
                    <div
                        className="text-base tracking-wider uppercase"
                        style={{ color: DIM }}
                    >
                        Session total
                    </div>
                    <div className="font-mono text-2xl">
                        {fmt(total / 1e6, 2)} Mt
                    </div>
                </div>
            </div>
            {chart && (
                <div className="min-h-0 flex-1">
                    <EChart option={option} />
                </div>
            )}
        </div>
    );
}

// Chart panels

export function MarketPricesChart({ fontSize }: { fontSize?: number }) {
    const option = useMemo(() => marketPricesOption(fontSize), [fontSize]);
    return <EChart option={option} />;
}

export function GenerationMixChart({ fontSize }: { fontSize?: number }) {
    const option = useMemo(() => generationMixOption(fontSize), [fontSize]);
    return <EChart option={option} />;
}

export function DurationCurveChart({ fontSize }: { fontSize?: number }) {
    const option = useMemo(() => durationCurveOption(fontSize), [fontSize]);
    return <EChart option={option} />;
}

export function PlayerPriceBox({
    index,
    fontSize,
    labels,
}: {
    index: number;
    fontSize?: number;
    labels?: boolean;
}) {
    const option = useMemo(
        () => playerPriceBoxes(index, fontSize, labels),
        [index, fontSize, labels],
    );
    const type = PRICE_TYPES[index]!;
    return (
        <div className="flex h-full min-h-0 flex-col">
            <div
                className="text-[17px] font-semibold tracking-wide uppercase"
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

export function PlayerPricesGrid({
    cols,
    fontSize,
    labels,
}: {
    cols: number;
    fontSize?: number;
    labels?: boolean;
}) {
    return (
        <div
            className="grid h-full gap-x-3 gap-y-1"
            style={{
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                gridAutoRows: "minmax(0, 1fr)",
            }}
        >
            {PRICE_TYPES.map((_, i) => (
                <PlayerPriceBox
                    key={i}
                    index={i}
                    fontSize={fontSize}
                    labels={labels}
                />
            ))}
        </div>
    );
}

/** A legend for the price boxes: what the box and whiskers mean. */
export function BoxLegend() {
    return (
        <span
            className="text-[13px] normal-case tracking-normal"
            style={{ color: DIM }}
        >
            box: middle half of the room · line: median · whiskers: min–max
        </span>
    );
}
