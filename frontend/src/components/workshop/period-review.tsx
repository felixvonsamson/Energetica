/**
 * A settled Trading period's review (#1007). Everyone explores the finished
 * period on the persistent world's charts:
 *
 * - The player's own power, generation or consumption (not for the moderator, who
 *   has no fleet);
 * - The whole market's power, by facility type or by player;
 * - The market price;
 * - The merit order at one settlement point, picked with the scrubber, which the
 *   three charts above mark. Clicking a chart moves the scrubber there.
 *
 * A full-season period is reviewed one simulated day at a time. The prices the
 * player set for the period are in their own tab.
 */

import { Activity, BarChart2, Layers, TrendingUp, Zap } from "lucide-react";
import { type ReactNode, useCallback, useMemo, useState } from "react";

import {
    type EChartsTimeSeriesConfig,
    type TimeAxis,
    TimeSeriesChart,
} from "@/components/charts/echarts-time-series";
import { MeritOrderView } from "@/components/charts/merit-order-view";
import {
    PowerChart,
    type PowerChartViewMode,
} from "@/components/charts/power-chart";
import { ChartCard } from "@/components/ui/chart-card";
import { Label } from "@/components/ui/label";
import {
    SegmentedPicker,
    SegmentedPickerOption,
} from "@/components/ui/segmented-picker";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TypographyMuted } from "@/components/ui/typography";
import { PeriodScrubber } from "@/components/workshop/period-scrubber";
import { PeriodSeriesTable } from "@/components/workshop/period-series-table";
import { useAssetColorGetter } from "@/hooks/use-asset-color-getter";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { usePlayerColors } from "@/hooks/use-player-color-getter";
import { useToggleSet } from "@/hooks/use-toggle-set";
import {
    useLockedPrices,
    useWorkshopEntry,
    useWorkshopFacilities,
    useWorkshopMeritOrder,
    useWorkshopPeriod,
    useWorkshopPeriodDay,
    useWorkshopSession,
} from "@/hooks/use-workshop";
import { ApiClientError } from "@/lib/api-client";
import { formatMoney } from "@/lib/format-utils";
import {
    CONSUMERS,
    type ChartRow,
    DUMPING,
    EXPORTS,
    type NetworkGrouping,
    type PowerView,
    TIER_NAMES,
    dateOfDay,
    isPointOfDay,
    meritOrderData,
    networkPowerRows,
    orderedKeys,
    playerPowerRows,
    priceRows,
    reviewableDays,
    timeOfDay,
} from "@/lib/workshop-review";
import type { ApiSchema } from "@/types/api-helpers";

type Season = ApiSchema<"TradingPeriod">["season"];
type Period = ApiSchema<"WorkshopPeriodOut">;
type PeriodDay = ApiSchema<"WorkshopPeriodDayOut">;

const STORAGE_PREFIX = "energetica:workshop:review";

/** "onshore_wind_turbine" → "Onshore wind turbine", for a name not known. */
function humanize(id: string): string {
    const words = id.replace(/_/g, " ");
    return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Everything the charts need to name and color their series. */
interface Labels {
    me: number | null;
    facilityName: (facility: string) => string;
    playerName: (playerId: number) => string;
    playerColor: (playerId: number) => string;
    assetColor: (key: string) => string;
    /** Facility types in catalog order, for stacking. */
    facilityOrder: readonly string[];
}

function useLabels(): Labels {
    const { data: entry } = useWorkshopEntry();
    const { data: session } = useWorkshopSession();
    const { data: facilities } = useWorkshopFacilities();
    const assetColor = useAssetColorGetter();

    const me = entry?.player?.account_id ?? null;
    const players = session?.players;
    const playerIds = useMemo(
        () => (players ?? []).map((player) => player.account_id),
        [players],
    );
    const baseColor = usePlayerColors(me, playerIds);

    return useMemo(() => {
        const names = new Map(
            (facilities ?? []).map((facility) => [facility.id, facility.name]),
        );
        const usernames = new Map(
            (players ?? []).map((player) => [
                player.account_id,
                player.username,
            ]),
        );
        return {
            me,
            facilityName: (facility) =>
                TIER_NAMES[facility] ??
                names.get(facility as never) ??
                humanize(facility),
            // The demand tiers bid under negative ids: the country's consumers.
            playerName: (playerId) =>
                playerId < 0
                    ? "Consumers"
                    : (usernames.get(playerId) ?? `Player ${playerId}`),
            playerColor: (playerId) =>
                playerId < 0 ? assetColor(CONSUMERS) : baseColor(playerId),
            assetColor,
            facilityOrder: (facilities ?? []).map((facility) => facility.id),
        };
    }, [me, players, facilities, assetColor, baseColor]);
}

// ── Page body ─────────────────────────────────────────────────────────────────

export function PeriodReview({
    round,
    season,
}: {
    round: number;
    season: Season;
}) {
    const period = useWorkshopPeriod(round, season);
    const { data: entry } = useWorkshopEntry();
    const isPlayer = entry?.role === "player";
    // Held here rather than in the review tab, which unmounts while the prices
    // tab is open, so the day and point survive a look at the prices.
    const [dayIndex, setDayIndex] = useState(0);
    const [point, setPoint] = useState(0);

    if (period.isPending) return <Spinner />;
    if (period.isError) {
        const notSettled =
            period.error instanceof ApiClientError &&
            period.error.status === 404;
        return (
            <TypographyMuted>
                {notSettled
                    ? "This Trading period has not been simulated yet."
                    : "The Trading period could not be loaded."}
            </TypographyMuted>
        );
    }

    return (
        <Tabs defaultValue="review">
            <TabsList>
                <TabsTrigger value="review">Review</TabsTrigger>
                <TabsTrigger value="prices">Your prices</TabsTrigger>
            </TabsList>
            <TabsContent value="review">
                <Review
                    period={period.data}
                    dayIndex={dayIndex}
                    onDayIndexChange={setDayIndex}
                    point={point}
                    onPointChange={setPoint}
                />
            </TabsContent>
            <TabsContent value="prices">
                {isPlayer ? (
                    <LockedPricesTab round={round} season={season} />
                ) : (
                    <TypographyMuted>
                        The moderator sets no prices.
                    </TypographyMuted>
                )}
            </TabsContent>
        </Tabs>
    );
}

function Review({
    period,
    dayIndex,
    onDayIndexChange: setDayIndex,
    point,
    onPointChange: setPoint,
}: {
    period: Period;
    dayIndex: number;
    onDayIndexChange: (index: number) => void;
    point: number;
    onPointChange: (point: number) => void;
}) {
    const cpd = period.clearings_per_day;
    const labels = useLabels();
    const day = useWorkshopPeriodDay(period.round, period.season, dayIndex);

    const chooseDay = (index: number) => {
        setDayIndex(index);
        setPoint(index * cpd);
    };

    // Points after a blackout never cleared, so the scrubber stops at it.
    const lastPoint = period.blackout_at ?? period.days.length * cpd - 1;

    const timeAxis = useMemo(
        (): TimeAxis => ({
            formatTick: (tick) => timeOfDay(tick, cpd),
            formatTooltipTitle: (tick) => {
                const dayOfYear = period.days[Math.floor(tick / cpd)];
                const date =
                    dayOfYear === undefined ? "" : `${dateOfDay(dayOfYear)}, `;
                return `${date}${timeOfDay(tick, cpd)}`;
            },
            secondsPerTick: (24 * 3600) / cpd,
            anchor: "left",
        }),
        [cpd, period.days],
    );

    // While another day loads, the charts still show the last one. A click on
    // it would pick a point outside the chosen day, so it is ignored.
    const onTickClick = useCallback(
        (tick: number) => {
            if (!isPointOfDay(tick, dayIndex, cpd)) return;
            setPoint(Math.min(tick, lastPoint));
        },
        [dayIndex, cpd, lastPoint, setPoint],
    );

    // The day shown, which may still be the previous one while the next loads.
    const shown = day.data;
    const chart = {
        timeAxis,
        markerTick: point,
        onTickClick,
        isLoading: day.isPending,
        isError: day.isError,
    };

    return (
        <div className="space-y-6 pt-4">
            {period.blackout_at !== null && (
                <TypographyMuted>
                    The grid went down at {timeOfDay(period.blackout_at, cpd)}
                    {period.days.length > 1 &&
                        ` on day ${Math.floor(period.blackout_at / cpd) + 1}`}
                    . Nothing was produced or sold after that.
                </TypographyMuted>
            )}
            {period.days.length > 1 && (
                <DayPicker
                    // Days after a blackout never cleared, so the list ends at it.
                    days={reviewableDays(period.days, period.blackout_at, cpd)}
                    value={dayIndex}
                    onChange={chooseDay}
                />
            )}
            {labels.me !== null && (
                <PlayerPowerCard
                    day={shown}
                    labels={labels}
                    cpd={cpd}
                    {...chart}
                />
            )}
            <NetworkPowerCard
                day={shown}
                labels={labels}
                cpd={cpd}
                {...chart}
            />
            <PriceCard day={shown} {...chart} />
            <div className="sticky bottom-0 z-10 rounded-lg border border-border bg-background/95 p-3 backdrop-blur">
                <PeriodScrubber
                    first={dayIndex * cpd}
                    count={cpd}
                    last={lastPoint}
                    clearingsPerDay={cpd}
                    point={point}
                    onPointChange={setPoint}
                />
            </div>
            <MeritOrderCard period={period} point={point} labels={labels} />
        </div>
    );
}

function DayPicker({
    days,
    value,
    onChange,
}: {
    days: number[];
    value: number;
    onChange: (index: number) => void;
}) {
    return (
        <div className="max-w-xs">
            <Label className="mb-2" htmlFor="review-day">
                Simulated day
            </Label>
            <select
                id="review-day"
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
                {days.map((dayOfYear, index) => (
                    <option key={dayOfYear} value={index}>
                        Day {index + 1} · {dateOfDay(dayOfYear)}
                    </option>
                ))}
            </select>
        </div>
    );
}

// ── Power charts ──────────────────────────────────────────────────────────────

interface ChartProps {
    timeAxis: TimeAxis;
    markerTick: number;
    onTickClick: (tick: number) => void;
    isLoading: boolean;
    isError: boolean;
}

interface PowerCardProps extends ChartProps {
    day: PeriodDay | undefined;
    labels: Labels;
    cpd: number;
}

function Picker<T extends string>({
    label,
    value,
    onChange,
    options,
}: {
    label: string;
    value: T;
    onChange: (value: T) => void;
    options: readonly { value: T; label: string }[];
}) {
    return (
        <div className="flex items-center gap-3">
            <Label className="shrink-0">{label}</Label>
            <SegmentedPicker
                value={value}
                onValueChange={(v) => onChange(v as T)}
            >
                {options.map((option) => (
                    <SegmentedPickerOption
                        key={option.value}
                        value={option.value}
                    >
                        {option.label}
                    </SegmentedPickerOption>
                ))}
            </SegmentedPicker>
        </div>
    );
}

const VIEW_OPTIONS = [
    { value: "generation", label: "Generation" },
    { value: "consumption", label: "Consumption" },
] as const;

const MODE_OPTIONS = [
    { value: "absolute", label: "Absolute" },
    { value: "percent", label: "Percentage" },
] as const;

const GROUPING_OPTIONS = [
    { value: "type", label: "Type" },
    { value: "player", label: "Player" },
] as const;

/** The stack order of a chart's series, bottom first. */
function preferredOrder(
    labels: Labels,
    view: PowerView,
    grouping: NetworkGrouping,
): string[] {
    if (grouping === "player") {
        return [CONSUMERS, ...(labels.me === null ? [] : [String(labels.me)])];
    }
    if (view === "generation") return [...labels.facilityOrder];
    return [
        ...Object.keys(TIER_NAMES),
        EXPORTS,
        ...labels.facilityOrder,
        DUMPING,
    ];
}

/** A series' name: a facility type, a demand tier, a player, or a sink. */
function seriesLabel(
    labels: Labels,
    view: PowerView,
    grouping: NetworkGrouping,
    key: string,
): string {
    if (key === EXPORTS) return "Sold to the market";
    if (key === DUMPING) return "Dumped";
    if (key === CONSUMERS) return "Consumers";
    if (grouping === "player") return labels.playerName(Number(key));
    const name = labels.facilityName(key);
    // On the consumption side, a storage type's series is what it charged.
    return view === "consumption" && !(key in TIER_NAMES)
        ? `${name} (charging)`
        : name;
}

function seriesColor(
    labels: Labels,
    grouping: NetworkGrouping,
    key: string,
): string {
    return grouping === "player" && key !== CONSUMERS
        ? labels.playerColor(Number(key))
        : labels.assetColor(key);
}

function PowerSeries({
    rows,
    labels,
    view,
    grouping,
    viewMode,
    hidden,
    onToggle,
    cpd,
    ...chart
}: ChartProps & {
    rows: ChartRow[];
    labels: Labels;
    view: PowerView;
    grouping: NetworkGrouping;
    viewMode: PowerChartViewMode;
    hidden: Set<string>;
    onToggle: (key: string) => void;
    cpd: number;
}) {
    const keys = useMemo(
        () => orderedKeys(rows, preferredOrder(labels, view, grouping)),
        [rows, labels, view, grouping],
    );
    const label = useCallback(
        (key: string) => seriesLabel(labels, view, grouping, key),
        [labels, view, grouping],
    );
    const color = useCallback(
        (key: string) => seriesColor(labels, grouping, key),
        [labels, grouping],
    );
    return (
        <>
            <PowerChart
                chartData={rows}
                hiddenFacilities={hidden}
                viewMode={viewMode}
                keyOrder={keys}
                getColor={color}
                formatLabel={label}
                height={360}
                {...chart}
            />
            <PeriodSeriesTable
                rows={rows}
                keys={keys}
                hoursPerPoint={24 / cpd}
                hidden={hidden}
                onToggle={onToggle}
                label={label}
                color={color}
                energyHeading={view === "generation" ? "Generated" : "Consumed"}
            />
        </>
    );
}

function PlayerPowerCard({ day, labels, cpd, ...chart }: PowerCardProps) {
    const [view, setView] = useLocalStorage<PowerView>(
        `${STORAGE_PREFIX}:player:view`,
        "generation",
    );
    const [viewMode, setViewMode] = useLocalStorage<PowerChartViewMode>(
        `${STORAGE_PREFIX}:player:mode`,
        "absolute",
    );
    const [hidden, toggle] = useToggleSet<string>(
        undefined,
        `${STORAGE_PREFIX}:player:hidden`,
    );
    const rows = useMemo(
        () =>
            day && labels.me !== null
                ? playerPowerRows(day, labels.me, view)
                : [],
        [day, labels.me, view],
    );

    return (
        <ChartCard
            icon={Zap}
            iconClassName="text-primary"
            title={
                view === "generation" ? "Your generation" : "Your consumption"
            }
            headerContent={
                <div className="flex flex-wrap gap-6">
                    <Picker
                        label="Show"
                        value={view}
                        onChange={setView}
                        options={VIEW_OPTIONS}
                    />
                    <Picker
                        label="Display"
                        value={viewMode}
                        onChange={setViewMode}
                        options={MODE_OPTIONS}
                    />
                </div>
            }
        >
            <PowerSeries
                rows={rows}
                labels={labels}
                view={view}
                grouping="type"
                viewMode={viewMode}
                hidden={hidden}
                onToggle={toggle}
                cpd={cpd}
                {...chart}
            />
        </ChartCard>
    );
}

function NetworkPowerCard({ day, labels, cpd, ...chart }: PowerCardProps) {
    const [view, setView] = useLocalStorage<PowerView>(
        `${STORAGE_PREFIX}:network:view`,
        "generation",
    );
    const [grouping, setGrouping] = useLocalStorage<NetworkGrouping>(
        `${STORAGE_PREFIX}:network:grouping`,
        "type",
    );
    const [viewMode, setViewMode] = useLocalStorage<PowerChartViewMode>(
        `${STORAGE_PREFIX}:network:mode`,
        "absolute",
    );
    const [hidden, toggle] = useToggleSet<string>(
        undefined,
        `${STORAGE_PREFIX}:network:hidden`,
    );
    const rows = useMemo(
        () => (day ? networkPowerRows(day, view, grouping) : []),
        [day, view, grouping],
    );
    const what = view === "generation" ? "generation" : "consumption";

    return (
        <ChartCard
            icon={grouping === "player" ? Activity : Layers}
            iconClassName="text-primary"
            title={`Market ${what} by ${grouping === "player" ? "player" : "type"}`}
            headerContent={
                <div className="flex flex-wrap gap-6">
                    <Picker
                        label="Show"
                        value={view}
                        onChange={setView}
                        options={VIEW_OPTIONS}
                    />
                    <Picker
                        label="Group by"
                        value={grouping}
                        onChange={setGrouping}
                        options={GROUPING_OPTIONS}
                    />
                    <Picker
                        label="Display"
                        value={viewMode}
                        onChange={setViewMode}
                        options={MODE_OPTIONS}
                    />
                </div>
            }
        >
            <PowerSeries
                rows={rows}
                labels={labels}
                view={view}
                grouping={grouping}
                viewMode={viewMode}
                hidden={hidden}
                onToggle={toggle}
                cpd={cpd}
                {...chart}
            />
        </ChartCard>
    );
}

// ── Price chart ───────────────────────────────────────────────────────────────

const PRICE_CONFIG: EChartsTimeSeriesConfig = {
    chartVariant: "steppedLine",
    height: 220,
    getColor: () => "var(--chart-1)",
    formatLabel: () => "Market price",
    formatValue: (value) =>
        Number.isNaN(value) ? "None" : `${formatMoney(value)}/MWh`,
    formatYAxis: (value) => formatMoney(value),
    hideZeroValues: false,
    yAxisLabel: "Price (coins/MWh)",
};

function PriceCard({
    day,
    ...chart
}: ChartProps & { day: PeriodDay | undefined }) {
    const rows = useMemo(() => (day ? priceRows(day) : []), [day]);
    return (
        <ChartCard
            icon={TrendingUp}
            iconClassName="text-primary"
            title="Market price"
        >
            <TimeSeriesChart data={rows} config={PRICE_CONFIG} {...chart} />
        </ChartCard>
    );
}

// ── Merit order ───────────────────────────────────────────────────────────────

function MeritOrderCard({
    period,
    point,
    labels,
}: {
    period: Period;
    point: number;
    labels: Labels;
}) {
    const order = useWorkshopMeritOrder(period.round, period.season, point);
    const data = useMemo(
        () => (order.data ? meritOrderData(order.data) : undefined),
        [order.data],
    );
    const cpd = period.clearings_per_day;
    const title: ReactNode = (
        <>
            Merit order at {timeOfDay(point, cpd)}
            {period.days.length > 1 && `, day ${Math.floor(point / cpd) + 1}`}
        </>
    );

    return (
        <ChartCard icon={BarChart2} iconClassName="text-primary" title={title}>
            <MeritOrderView
                data={data}
                isLoading={order.isPending}
                isError={order.isError}
                getFacilityColor={labels.assetColor}
                getPlayerColor={labels.playerColor}
                playerName={labels.playerName}
                facilityName={labels.facilityName}
                emptyMessage="No bids at this settlement point"
            />
        </ChartCard>
    );
}

// ── Prices tab ────────────────────────────────────────────────────────────────

function LockedPricesTab({ round, season }: { round: number; season: Season }) {
    const { data: locked, isPending } = useLockedPrices();
    const labels = useLabels();
    if (isPending) return <Spinner />;
    const prices = locked?.find(
        (entry) => entry.round === round && entry.season === season,
    )?.prices;
    if (!prices) {
        return (
            <TypographyMuted className="pt-4">
                You had nothing operating in this Trading period, so you set no
                prices.
            </TypographyMuted>
        );
    }
    const facilities = Object.keys(prices.sell);

    return (
        <div className="overflow-x-auto pt-4">
            <table className="w-full max-w-xl text-sm">
                <thead>
                    <tr className="bg-secondary">
                        <th className="py-2 px-4 text-left font-semibold">
                            Facility
                        </th>
                        <th className="py-2 px-4 text-right font-semibold">
                            Sell price
                        </th>
                        <th className="py-2 px-4 text-right font-semibold">
                            Buy price
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {facilities.map((facility) => {
                        const sell = prices.sell[facility as never];
                        const buy = prices.buy[facility as never];
                        return (
                            <tr
                                key={facility}
                                className="border-b border-border/30"
                            >
                                <td className="py-2 px-4">
                                    {labels.facilityName(facility)}
                                </td>
                                <td className="py-2 px-4 text-right font-mono">
                                    {sell === undefined
                                        ? "–"
                                        : `${formatMoney(sell)}/MWh`}
                                </td>
                                <td className="py-2 px-4 text-right font-mono">
                                    {buy === undefined
                                        ? "–"
                                        : `${formatMoney(buy)}/MWh`}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
