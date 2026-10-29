/**
 * A settled Trading period's review (#1007). Everyone explores the finished
 * period on the persistent world's charts:
 *
 * - For a full season, the whole season's daily energy mix and price trend
 *   (#1399);
 * - The player's own power, generation or consumption (not for the facilitator,
 *   who has no fleet);
 * - The player's storage, as a state of charge or stored energy, if they had any
 *   (#1297);
 * - The whole market's power, by facility type or by player;
 * - The market price;
 * - The merit order at one settlement point, which the charts above mark.
 *   Clicking a chart moves it there.
 *
 * The charts from the player's power down show some days at every settlement
 * point: a representative week whole, or a window of a full season's 91 days.
 * They share one zoom window: zooming or resetting one does the same to the
 * others, so they can be compared. When the grid went down, they shade the rest
 * of the day red from that point (#1273).
 *
 * A sticky bar at the top holds a scrubber to pick the merit order's point in a
 * representative week, or, for a full season, a strip of the season to pick the
 * window of days on (#1399). It also has a button for each card, which the
 * player can minimize to keep the page short. Every player's prices for the
 * period are in their own tab (#1299), which is the only one open before the
 * period is simulated.
 */

import {
    Activity,
    BarChart2,
    Battery,
    Layers,
    CalendarRange,
    TrendingUp,
    Zap,
} from "lucide-react";
import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";

import {
    type ChartSyncProps,
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
import {
    STORAGE_VIEW_OPTIONS,
    StorageChart,
    type StorageView,
} from "@/components/charts/storage-chart";
import {
    CardDockBar,
    CardDockProvider,
    type DockItem,
    DockedCard,
    MinimizeButton,
    useCardDock,
} from "@/components/workshop/card-dock";
import { MarketPricesBoard } from "@/components/workshop/market-prices-board";
import { PeriodScrubber } from "@/components/workshop/period-scrubber";
import { PeriodSeriesTable } from "@/components/workshop/period-series-table";
import { playerLabel } from "@/components/workshop/player-name";
import {
    SeasonNavigator,
    SeasonPriceChart,
} from "@/components/workshop/season-navigator";
import { useAssetColorGetter } from "@/hooks/use-asset-color-getter";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { usePlayerColors } from "@/hooks/use-player-color-getter";
import { useToggleSet } from "@/hooks/use-toggle-set";
import {
    useWorkshopEntry,
    useWorkshopFacilities,
    useWorkshopMeritOrder,
    useWorkshopPeriod,
    useWorkshopPeriodDays,
    useWorkshopSeasonOverview,
    useWorkshopSession,
    useWorkshopTeams,
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
    centredOn,
    type DayWindow,
    isPointOfWindow,
    middleWeek,
    wholePeriod,
    meritOrderData,
    networkPowerRows,
    orderedKeys,
    playerPowerRows,
    playerStorageRows,
    pointAxisLabel,
    pointTime,
    priceRows,
    outages,
    dateOfDay,
    weekdayOfDay,
    isGridDown,
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
type PeriodDays = ApiSchema<"WorkshopPeriodDaysOut">;

const STORAGE_PREFIX = "energetica:workshop:review";

/** "onshore_wind_turbine" → "Onshore wind turbine", for a name not known. */
function humanize(id: string): string {
    const words = id.replace(/_/g, " ");
    return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Facility types bottom first, in the order the persistent world's charts stack
 * them (`POWER_GENERATION_KEYS`): steady hydro and nuclear at the bottom, then
 * fossil, wind, solar, and storage on top.
 */
const STACKING_ORDER = [
    "small_water_dam",
    "large_water_dam",
    "nuclear_reactor",
    "nuclear_reactor_gen4",
    "coal_burner",
    "modern_coal_plant",
    "gas_burner",
    "combined_cycle",
    "onshore_wind_turbine",
    "offshore_wind_turbine",
    "csp_solar",
    "pv_solar",
    "multi_layer_pv",
    "pumped_hydro",
    "lithium_ion_batteries",
    "solid_state_batteries",
    "hydrogen_storage",
];

/** The catalog's facility types in {@link STACKING_ORDER}, any others on top. */
function stackingOrder(catalog: readonly string[]): string[] {
    const rank = (id: string) => {
        const index = STACKING_ORDER.indexOf(id);
        return index === -1 ? STACKING_ORDER.length : index;
    };
    return [...catalog].sort((a, b) => rank(a) - rank(b));
}

/** Everything the charts need to name and color their series. */
interface Labels {
    me: number | null;
    facilityName: (facility: string) => string;
    playerName: (playerId: number) => string;
    playerColor: (playerId: number) => string;
    assetColor: (key: string) => string;
    /** Facility types in stacking order, bottom first. */
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
    const { teammateIds } = useWorkshopTeams();
    const baseColor = usePlayerColors(me, playerIds, teammateIds);

    return useMemo(() => {
        const names = new Map(
            (facilities ?? []).map((facility) => [facility.id, facility.name]),
        );
        const usernames = new Map(
            (players ?? []).map((player) => [
                player.account_id,
                playerLabel(player.username, player.team),
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
            facilityOrder: stackingOrder(
                (facilities ?? []).map((facility) => facility.id),
            ),
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
    // tab is open, so the days, point and zoom survive a look at the prices.
    // Until a player picks them, the days and point are the defaults.
    const [window, setWindow] = useState<DayWindow | null>(null);
    const [point, setPoint] = useState<number | null>(null);
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
                        window={window ?? defaultWindow(period.data)}
                        onWindowChange={setWindow}
                        point={
                            point ??
                            (window ?? defaultWindow(period.data)).first *
                                period.data.clearings_per_day
                        }
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

/** Whether a period simulated a full season, rather than a representative week. */
function isFullSeason(period: Period): boolean {
    return period.days.length > WEEK_DAYS;
}

/**
 * The days the charts show in detail at first: all of a representative week, or
 * a week in the middle of a full season.
 */
function defaultWindow(period: Period): DayWindow {
    return isFullSeason(period)
        ? middleWeek(period.days.length)
        : wholePeriod(period.days.length);
}

function Review({
    period,
    window,
    onWindowChange: setWindow,
    point,
    onPointChange: setPoint,
    zoom,
    onZoomChange: setZoom,
}: {
    period: Period;
    window: DayWindow;
    onWindowChange: (window: DayWindow) => void;
    point: number;
    onPointChange: (point: number) => void;
    zoom: ZoomRange;
    onZoomChange: (zoom: ZoomRange) => void;
}) {
    const cpd = period.clearings_per_day;
    const labels = useLabels();
    const fullSeason = isFullSeason(period);
    const days = useWorkshopPeriodDays(
        period.round,
        period.season,
        window,
        period.days.length,
        cpd,
    );
    const overview = useWorkshopSeasonOverview(period.round, period.season, {
        enabled: fullSeason,
    });

    // Other days are charted from the start, and the merit order follows if
    // its point is not among them.
    const chooseWindow = useCallback(
        (next: DayWindow) => {
            setWindow(next);
            setZoom(FULL_ZOOM);
            if (!isPointOfWindow(point, next, cpd)) setPoint(next.first * cpd);
        },
        [cpd, point, setWindow, setPoint, setZoom],
    );

    const pointCount = period.days.length * cpd;
    const lastPoint = pointCount - 1;
    const blackouts = useMemo(
        () => outages(period.blackouts, pointCount, cpd),
        [period.blackouts, pointCount, cpd],
    );

    const timeAxis = useMemo(
        (): TimeAxis => ({
            formatTick: (tick) => pointAxisLabel(tick, period.days, cpd),
            formatTooltipTitle: (tick) => pointTime(tick, period.days, cpd),
            secondsPerTick: (24 * 3600) / cpd,
            anchor: "left",
        }),
        [cpd, period.days],
    );

    const stickyRef = useRef<HTMLDivElement>(null);
    const dock = useCardDock(`${STORAGE_PREFIX}:minimized`, stickyRef);

    // While other days load, the charts still show the last ones. A click on
    // them would pick a point outside the chosen days, so it is ignored.
    const onTickClick = useCallback(
        (tick: number) => {
            if (!isPointOfWindow(tick, window, cpd)) return;
            setPoint(Math.min(tick, lastPoint));
        },
        [window, cpd, lastPoint, setPoint],
    );

    // The days shown, which may still be the previous ones while the next load.
    const shown = days.data;
    const chart = {
        timeAxis,
        markerTick: point,
        blackouts,
        onTickClick,
        isLoading: days.isPending,
        isError: days.isError,
        zoom,
        onZoomChange: setZoom,
    };

    const hadStorage =
        labels.me !== null &&
        (shown?.pools.some(
            (pool) => pool.player_id === labels.me && pool.storage_capacity > 0,
        ) ??
            false);
    const dockItems: DockItem[] = [
        ...(fullSeason
            ? [{ id: "season", label: "Season", icon: CalendarRange }]
            : []),
        ...(labels.me !== null
            ? [{ id: "player", label: "Your power", icon: Zap }]
            : []),
        ...(hadStorage
            ? [{ id: "storage", label: "Your storage", icon: Battery }]
            : []),
        { id: "network", label: "Market power", icon: Layers },
        { id: "price", label: "Market price", icon: TrendingUp },
        { id: "merit", label: "Merit order", icon: BarChart2 },
    ];

    return (
        <CardDockProvider dock={dock}>
            <div className="space-y-6 pt-4">
                {period.blackouts.length > 0 && (
                    <TypographyMuted>
                        The grid went down on{" "}
                        {period.blackouts
                            .map((blackout) =>
                                pointTime(blackout, period.days, cpd),
                            )
                            .join("; ")}
                        . Each time, nothing was produced or sold for the next
                        24 hours, and demand was rationed after that.
                    </TypographyMuted>
                )}
                {/* Sticky, so the days or the point can be changed from
                    anywhere down the page, and every card reached. */}
                <div
                    ref={stickyRef}
                    className="sticky top-0 z-10 space-y-1 rounded-lg border border-border bg-surface-card px-3 py-1 shadow-lg"
                >
                    {fullSeason ? (
                        overview.data ? (
                            <SeasonNavigator
                                overview={overview.data}
                                days={period.days}
                                labels={labels}
                                window={window}
                                onWindowChange={chooseWindow}
                            />
                        ) : (
                            <Spinner />
                        )
                    ) : (
                        <div className="py-1.5">
                            <PeriodScrubber
                                first={0}
                                count={pointCount}
                                last={lastPoint}
                                days={period.days}
                                clearingsPerDay={cpd}
                                point={point}
                                onPointChange={setPoint}
                            />
                        </div>
                    )}
                    <CardDockBar items={dockItems} />
                </div>
                {fullSeason && (
                    <DockedCard id="season">
                        <SeasonMixCard
                            overview={overview.data}
                            isLoading={overview.isPending}
                            isError={overview.isError}
                            labels={labels}
                            days={period.days}
                            window={window}
                            onWindowChange={chooseWindow}
                        />
                    </DockedCard>
                )}
                {labels.me !== null && (
                    <DockedCard id="player">
                        <PlayerPowerCard
                            days={shown}
                            labels={labels}
                            cpd={cpd}
                            {...chart}
                        />
                    </DockedCard>
                )}
                {hadStorage && (
                    <DockedCard id="storage">
                        <PlayerStorageCard
                            days={shown}
                            labels={labels}
                            {...chart}
                        />
                    </DockedCard>
                )}
                <DockedCard id="network">
                    <NetworkPowerCard
                        days={shown}
                        labels={labels}
                        cpd={cpd}
                        {...chart}
                    />
                </DockedCard>
                <DockedCard id="price">
                    <PriceCard days={shown} {...chart} />
                </DockedCard>
                <DockedCard id="merit">
                    <MeritOrderCard
                        period={period}
                        point={point}
                        labels={labels}
                    />
                </DockedCard>
            </div>
        </CardDockProvider>
    );
}

// ── Power charts ──────────────────────────────────────────────────────────────

interface ChartProps extends ChartSyncProps {
    timeAxis: TimeAxis;
    isLoading: boolean;
    isError: boolean;
}

interface PowerCardProps extends ChartProps {
    days: PeriodDays | undefined;
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
    barGap,
    span,
    above,
    power,
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
    /** The share of each bar's slot left empty, for bars a day wide. */
    barGap?: number;
    /** What the table's energy is summed over. "the day" by default. */
    span?: string;
    /** Shown above the chart. */
    above?: ReactNode;
    /** The power of each series' facilities, for the capacity factor column. */
    power?: (key: string) => number | undefined;
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
            {/* The chart above shares this one's date labels, so no gap. */}
            <div>
                {above}
                <PowerChart
                    chartData={rows}
                    hiddenFacilities={hidden}
                    viewMode={viewMode}
                    keyOrder={keys}
                    getColor={color}
                    formatLabel={label}
                    height={360}
                    highlightedKey={highlightedKey}
                    barGap={barGap}
                    {...chart}
                />
            </div>
            <PeriodSeriesTable
                rows={rows}
                keys={keys}
                hoursPerPoint={24 / cpd}
                hidden={hidden}
                onToggle={onToggle}
                label={label}
                color={color}
                energyHeading={view === "generation" ? "Generated" : "Consumed"}
                span={span}
                onHoverRow={setHighlightedKey}
                power={power}
            />
        </>
    );
}

function PlayerPowerCard({ days, labels, cpd, ...chart }: PowerCardProps) {
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
            days && labels.me !== null
                ? playerPowerRows(days, labels.me, view)
                : [],
        [days, labels.me, view],
    );
    const power = useMemo(() => {
        if (!days || view !== "generation") return undefined;
        const byFacility = new Map(
            days.pools
                .filter((pool) => pool.player_id === labels.me)
                .map((pool) => [pool.facility as string, pool.power]),
        );
        return (key: string) => byFacility.get(key);
    }, [days, labels.me, view]);

    return (
        <ChartCard
            actions={<MinimizeButton />}
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
                power={power}
                {...chart}
            />
        </ChartCard>
    );
}

function NetworkPowerCard({ days, labels, cpd, ...chart }: PowerCardProps) {
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
        () => (days ? networkPowerRows(days, view, grouping) : []),
        [days, view, grouping],
    );
    const what = view === "generation" ? "generation" : "consumption";

    return (
        <ChartCard
            actions={<MinimizeButton />}
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

// ── Season overview ───────────────────────────────────────────────────────────

/**
 * The whole market's generation over a full season, one bar per day at the
 * day's average power, under the trend of the price (#1399). The days shown in
 * detail below are shaded, and clicking a day shows the days around it.
 */
function SeasonMixCard({
    overview,
    isLoading,
    isError,
    labels,
    days,
    window,
    onWindowChange,
}: {
    overview: ApiSchema<"WorkshopSeasonOverviewOut"> | undefined;
    isLoading: boolean;
    isError: boolean;
    labels: Labels;
    days: readonly number[];
    window: DayWindow;
    onWindowChange: (window: DayWindow) => void;
}) {
    const [viewMode, setViewMode] = useLocalStorage<PowerChartViewMode>(
        `${STORAGE_PREFIX}:season:mode`,
        "absolute",
    );
    const [hidden, toggle] = useToggleSet<string>(
        undefined,
        `${STORAGE_PREFIX}:season:hidden`,
    );
    const [zoom, setZoom] = useState<ZoomRange>(FULL_ZOOM);
    const rows = useMemo(
        () =>
            overview
                ? days.map((_, day) => {
                      const row = { tick: day } as ChartRow;
                      for (const series of overview.daily_energy) {
                          row[series.facility] = (series.values[day] ?? 0) / 24;
                      }
                      return row;
                  })
                : [],
        [overview, days],
    );
    const timeAxis = useMemo(
        (): TimeAxis => ({
            formatTick: (tick) => dateOfDay(days[tick] ?? 0),
            formatTooltipTitle: (tick) =>
                `${weekdayOfDay(days[tick] ?? 0)} ${dateOfDay(days[tick] ?? 0)}, average over the day`,
            secondsPerTick: 24 * 3600,
            anchor: "left",
        }),
        [days],
    );
    const highlight = useMemo(
        () => ({ start: window.first, end: window.first + window.count }),
        [window],
    );
    const onTickClick = useCallback(
        (day: number) =>
            onWindowChange(centredOn(day, window.count, days.length)),
        [onWindowChange, window.count, days.length],
    );

    return (
        <ChartCard
            actions={<MinimizeButton />}
            icon={CalendarRange}
            iconClassName="text-primary"
            title="Daily energy mix and market prices"
            subtitle="Shaded: the days shown in detail below. Click a day to show it."
            headerContent={
                <Picker
                    label="Display"
                    value={viewMode}
                    onChange={setViewMode}
                    options={MODE_OPTIONS}
                />
            }
        >
            <PowerSeries
                rows={rows}
                labels={labels}
                view="generation"
                grouping="type"
                viewMode={viewMode}
                hidden={hidden}
                onToggle={toggle}
                cpd={1}
                barGap={0.3}
                span="the season"
                above={
                    overview && (
                        <SeasonPriceChart
                            overview={overview}
                            days={days}
                            window={window}
                            zoom={zoom}
                            onDayClick={onTickClick}
                        />
                    )
                }
                timeAxis={timeAxis}
                isLoading={isLoading}
                isError={isError}
                highlight={highlight}
                onTickClick={onTickClick}
                zoom={zoom}
                onZoomChange={setZoom}
            />
        </ChartCard>
    );
}

// ── Storage chart ─────────────────────────────────────────────────────────────

const NO_HIDDEN_SERIES = new Set<string>();

function PlayerStorageCard({
    days,
    labels,
    ...chart
}: ChartProps & { days: PeriodDays | undefined; labels: Labels }) {
    const [view, setView] = useLocalStorage<StorageView>(
        `${STORAGE_PREFIX}:storage:view`,
        "soc",
    );
    const rows = useMemo(
        () =>
            days && labels.me !== null
                ? playerStorageRows(days, labels.me, view)
                : [],
        [days, labels.me, view],
    );
    const hadStorage = days?.pools.some(
        (pool) => pool.player_id === labels.me && pool.storage_capacity > 0,
    );
    if (!hadStorage) return null;

    return (
        <ChartCard
            actions={<MinimizeButton />}
            icon={Battery}
            iconClassName="text-primary"
            title="Your storage"
            headerContent={
                <Picker
                    label="Display"
                    value={view}
                    onChange={setView}
                    options={STORAGE_VIEW_OPTIONS}
                />
            }
        >
            <StorageChart
                chartData={rows}
                hiddenFacilities={NO_HIDDEN_SERIES}
                // Every storage type the player had shows, even if it stayed
                // empty all along.
                showEmpty
                view={view}
                formatLabel={labels.facilityName}
                height={300}
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
    days,
    ...chart
}: ChartProps & { days: PeriodDays | undefined }) {
    const rows = useMemo(() => (days ? priceRows(days) : []), [days]);
    return (
        <ChartCard
            actions={<MinimizeButton />}
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
    const cpd = period.clearings_per_day;
    // The market never cleared while the grid was down, so there is nothing to ask for.
    const down = isGridDown(point, period.blackouts, cpd);
    const order = useWorkshopMeritOrder(
        period.round,
        period.season,
        down ? null : point,
    );
    const data = useMemo(
        () => (order.data ? meritOrderData(order.data) : undefined),
        [order.data],
    );
    const title: ReactNode = (
        <>Merit order on {pointTime(point, period.days, cpd)}</>
    );

    return (
        <ChartCard
            actions={<MinimizeButton />}
            icon={BarChart2}
            iconClassName="text-primary"
            title={title}
        >
            {down ? (
                <TypographyMuted className="py-6 text-center">
                    The grid was down at this point, so the market did not
                    clear.
                </TypographyMuted>
            ) : (
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
            )}
        </ChartCard>
    );
}
