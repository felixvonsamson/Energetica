/**
 * A settled Trading period's review (#1007). Everyone explores the finished
 * period on the persistent world's charts:
 *
 * - The player's own power, generation or consumption (not for the facilitator,
 *   who has no fleet);
 * - The whole market's power, by facility type or by player;
 * - The market price;
 * - The merit order at one settlement point, picked with the scrubber, which the
 *   three charts above mark. Clicking a chart moves the scrubber there.
 *
 * The three charts span the whole week and share one zoom window: zooming or
 * resetting one does the same to the others, so they can be compared. When the
 * grid went down, they shade the rest of the week red from that point (#1273).
 *
 * A period is reviewed one simulated week at a time: a representative week has
 * one, a full season 13. The week is picked in the scrubber's sticky bar, so it
 * can be changed without scrolling back up (#1273). Every player's prices for
 * the period are in their own tab (#1299), which is the only one open before
 * the period is simulated.
 */

import { Activity, BarChart2, Layers, TrendingUp, Zap } from "lucide-react";
import { type ReactNode, useCallback, useMemo, useState } from "react";

import {
    type EChartsTimeSeriesConfig,
    FULL_ZOOM,
    type TimeAxis,
    TimeSeriesChart,
    type ZoomRange,
} from "@/components/charts/echarts-time-series";
import { MeritOrderView } from "@/components/charts/merit-order-view";
import {
    PowerChart,
    type PowerChartViewMode,
} from "@/components/charts/power-chart";
import { MarketPricesBoard } from "@/components/workshop/market-prices-board";
import { PeriodScrubber } from "@/components/workshop/period-scrubber";
import { PeriodSeriesTable } from "@/components/workshop/period-series-table";
import { useAssetColorGetter } from "@/hooks/use-asset-color-getter";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { usePlayerColors } from "@/hooks/use-player-color-getter";
import { useToggleSet } from "@/hooks/use-toggle-set";
import {
    useWorkshopEntry,
    useWorkshopFacilities,
    useWorkshopMeritOrder,
    useWorkshopPeriod,
    useWorkshopPeriodWeek,
    useWorkshopSession,
} from "@/hooks/use-workshop";
import {
    CONSUMERS,
    type ChartRow,
    DUMPING,
    EXPORTS,
    type NetworkGrouping,
    type PowerView,
    TIER_NAMES,
    WEEK_DAYS,
    isPointOfWeek,
    meritOrderData,
    networkPowerRows,
    orderedKeys,
    playerPowerRows,
    pointAxisLabel,
    pointTime,
    priceRows,
    reviewableWeeks,
} from "@/lib/workshop-review";
import type { ApiSchema } from "@/types/api-helpers";
import { ApiClientError } from "@energetica/core/api-client";
import { formatMoney } from "@energetica/core/format-utils";
import { ChartCard } from "@energetica/ui/components/chart-card";
import { Label } from "@energetica/ui/components/label";
import {
    SegmentedPicker,
    SegmentedPickerOption,
} from "@energetica/ui/components/segmented-picker";
import { Spinner } from "@energetica/ui/components/spinner";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@energetica/ui/components/tabs";
import { TypographyMuted } from "@energetica/ui/components/typography";

type Season = ApiSchema<"TradingPeriod">["season"];
type Period = ApiSchema<"WorkshopPeriodOut">;
type PeriodWeek = ApiSchema<"WorkshopPeriodWeekOut">;

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
    // Held here rather than in the review tab, which unmounts while the prices
    // tab is open, so the week, point and zoom survive a look at the prices.
    const [weekIndex, setWeekIndex] = useState(0);
    const [point, setPoint] = useState(0);
    const [zoom, setZoom] = useState<ZoomRange>(FULL_ZOOM);

    // Before the period is simulated it has nothing to review, but its prices
    // are on show: live while the price-setting window is open (#1299).
    const notSettled =
        period.isError &&
        period.error instanceof ApiClientError &&
        period.error.status === 404;
    const [tab, setTab] = useState<"review" | "prices" | null>(null);

    // Until then, it is not known which tab to open.
    if (period.isPending) return <Spinner />;

    return (
        <Tabs
            value={tab ?? (period.isError ? "prices" : "review")}
            onValueChange={(value) => setTab(value as "review" | "prices")}
        >
            <TabsList>
                <TabsTrigger value="review" disabled={period.isError}>
                    Review
                </TabsTrigger>
                <TabsTrigger value="prices">Prices</TabsTrigger>
            </TabsList>
            <TabsContent value="review">
                {period.isError ? (
                    <TypographyMuted>
                        {notSettled
                            ? "This Trading period has not been simulated yet."
                            : "The Trading period could not be loaded."}
                    </TypographyMuted>
                ) : (
                    <Review
                        period={period.data}
                        weekIndex={weekIndex}
                        onWeekIndexChange={setWeekIndex}
                        point={point}
                        onPointChange={setPoint}
                        zoom={zoom}
                        onZoomChange={setZoom}
                    />
                )}
            </TabsContent>
            <TabsContent value="prices">
                <MarketPricesBoard round={round} season={season} />
            </TabsContent>
        </Tabs>
    );
}

function Review({
    period,
    weekIndex,
    onWeekIndexChange: setWeekIndex,
    point,
    onPointChange: setPoint,
    zoom,
    onZoomChange: setZoom,
}: {
    period: Period;
    weekIndex: number;
    onWeekIndexChange: (index: number) => void;
    point: number;
    onPointChange: (point: number) => void;
    zoom: ZoomRange;
    onZoomChange: (zoom: ZoomRange) => void;
}) {
    const cpd = period.clearings_per_day;
    const labels = useLabels();
    const pointsPerWeek = WEEK_DAYS * cpd;
    const week = useWorkshopPeriodWeek(period.round, period.season, weekIndex);

    const chooseWeek = (index: number) => {
        setWeekIndex(index);
        setPoint(index * pointsPerWeek);
    };

    // Points after a blackout never cleared, so the scrubber stops at it.
    const lastPoint = period.blackout_at ?? period.days.length * cpd - 1;

    const timeAxis = useMemo(
        (): TimeAxis => ({
            formatTick: (tick) => pointAxisLabel(tick, period.days, cpd),
            formatTooltipTitle: (tick) => pointTime(tick, period.days, cpd),
            secondsPerTick: (24 * 3600) / cpd,
            anchor: "left",
        }),
        [cpd, period.days],
    );

    // While another week loads, the charts still show the last one. A click on
    // it would pick a point outside the chosen week, so it is ignored.
    const onTickClick = useCallback(
        (tick: number) => {
            if (!isPointOfWeek(tick, weekIndex, cpd)) return;
            setPoint(Math.min(tick, lastPoint));
        },
        [weekIndex, cpd, lastPoint, setPoint],
    );

    // The week shown, which may still be the previous one while the next loads.
    const shown = week.data;
    const chart = {
        timeAxis,
        markerTick: point,
        blackoutTick: period.blackout_at ?? undefined,
        onTickClick,
        isLoading: week.isPending,
        isError: week.isError,
        zoom,
        onZoomChange: setZoom,
    };

    return (
        <div className="space-y-6 pt-4">
            {period.blackout_at !== null && (
                <TypographyMuted>
                    The grid went down on{" "}
                    {pointTime(period.blackout_at, period.days, cpd)}. Nothing
                    was produced or sold after that.
                </TypographyMuted>
            )}
            {labels.me !== null && (
                <PlayerPowerCard
                    week={shown}
                    labels={labels}
                    cpd={cpd}
                    {...chart}
                />
            )}
            <NetworkPowerCard
                week={shown}
                labels={labels}
                cpd={cpd}
                {...chart}
            />
            <PriceCard week={shown} {...chart} />
            <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface-card p-3 shadow-lg">
                {period.weeks > 1 && (
                    <WeekPicker
                        // Weeks after a blackout never cleared, so the list ends at it.
                        weeks={reviewableWeeks(
                            period.days,
                            period.blackout_at,
                            cpd,
                        )}
                        value={weekIndex}
                        onChange={chooseWeek}
                    />
                )}
                <div className="min-w-0 flex-1">
                    <PeriodScrubber
                        first={weekIndex * pointsPerWeek}
                        count={pointsPerWeek}
                        last={lastPoint}
                        days={period.days}
                        clearingsPerDay={cpd}
                        point={point}
                        onPointChange={setPoint}
                    />
                </div>
            </div>
            <MeritOrderCard period={period} point={point} labels={labels} />
        </div>
    );
}

function WeekPicker({
    weeks,
    value,
    onChange,
}: {
    weeks: number[][];
    value: number;
    onChange: (index: number) => void;
}) {
    return (
        <select
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            aria-label="Simulated week"
            className="h-9 px-3 border border-input rounded-lg bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
            {weeks.map((days, index) => (
                <option key={days[0]} value={index}>
                    Week {index + 1}
                </option>
            ))}
        </select>
    );
}

// ── Power charts ──────────────────────────────────────────────────────────────

interface ChartProps {
    timeAxis: TimeAxis;
    markerTick: number;
    blackoutTick: number | undefined;
    onTickClick: (tick: number) => void;
    isLoading: boolean;
    isError: boolean;
    zoom: ZoomRange;
    onZoomChange: (zoom: ZoomRange) => void;
}

interface PowerCardProps extends ChartProps {
    week: PeriodWeek | undefined;
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
    // The series whose table row the player hovers, highlighted on the chart.
    const [highlightedKey, setHighlightedKey] = useState<string | null>(null);
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
                highlightedKey={highlightedKey}
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
                onHoverRow={setHighlightedKey}
            />
        </>
    );
}

function PlayerPowerCard({ week, labels, cpd, ...chart }: PowerCardProps) {
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
            week && labels.me !== null
                ? playerPowerRows(week, labels.me, view)
                : [],
        [week, labels.me, view],
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

function NetworkPowerCard({ week, labels, cpd, ...chart }: PowerCardProps) {
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
        () => (week ? networkPowerRows(week, view, grouping) : []),
        [week, view, grouping],
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
    week,
    ...chart
}: ChartProps & { week: PeriodWeek | undefined }) {
    const rows = useMemo(() => (week ? priceRows(week) : []), [week]);
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
        <>Merit order on {pointTime(point, period.days, cpd)}</>
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
