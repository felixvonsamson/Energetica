/**
 * A settled Trading period's review (#1007). Everyone explores the finished
 * period on the persistent world's charts:
 *
 * - The player's own power, generation or consumption (not for the facilitator,
 *   who has no fleet);
 * - The player's storage, as a state of charge or stored energy, if they had any
 *   (#1297);
 * - The whole market's power, by facility type or by player;
 * - The market price;
 * - The merit order at one settlement point, picked with the scrubber, which the
 *   charts above mark. Clicking a chart moves the scrubber there.
 *
 * The charts above it span the whole week and share one zoom window: zooming or
 * resetting one does the same to the others, so they can be compared. When the
 * grid went down, they shade the rest of the week red from that point (#1273).
 *
 * A period is reviewed one simulated week at a time: a representative week has
 * one, a full season 13. The week is picked in the scrubber's sticky bar, so it
 * can be changed without scrolling back up (#1273). Every player's prices for
 * the period are in their own tab (#1299), which is the only one open before
 * the period is simulated.
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
import {
    type ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

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
import { PrototypeSwitcher } from "@/components/prototype-switcher";
import { MarketPricesBoard } from "@/components/workshop/market-prices-board";
import { PeriodScrubber } from "@/components/workshop/period-scrubber";
import { PeriodSeriesTable } from "@/components/workshop/period-series-table";
import { playerLabel } from "@/components/workshop/player-name";
// PROTOTYPE (#1399), throwaway.
import {
    CardDockBar,
    CardDockProvider,
    type DockItem,
    DockedCard,
    MinimizeButton,
    useCardDock,
} from "@/components/workshop/prototype-card-dock";
// PROTOTYPE (#1399), throwaway.
import {
    type DayWindow,
    centredOn,
    SeasonNavigator,
    SeasonPriceChart,
    VARIANTS,
    middleWindow,
    setVariant,
    useSeasonDays,
    useSeasonOverview,
    usePrototypeVariant,
} from "@/components/workshop/prototype-season-navigator";
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
    isPointOfWeek,
    meritOrderData,
    networkPowerRows,
    orderedKeys,
    playerPowerRows,
    playerStorageRows,
    pointAxisLabel,
    pointTime,
    priceRows,
    reviewableWeeks,
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
    // PROTOTYPE (#1399): a full season is reviewed through a window of days
    // picked on a season overview, instead of one week at a time.
    const fullSeason = period.weeks > 1;
    const variant = usePrototypeVariant();
    const week = useWorkshopPeriodWeek(period.round, period.season, weekIndex, {
        enabled: !fullSeason,
    });
    const [dayWindow, setDayWindow] = useState<DayWindow>(() =>
        middleWindow(period.days.length),
    );
    const overview = useSeasonOverview(period.round, period.season, fullSeason);
    const windowDays = useSeasonDays(
        period.round,
        period.season,
        fullSeason ? dayWindow : null,
    );
    const windowFirst = dayWindow.first * cpd;
    const windowEnd = (dayWindow.first + dayWindow.count) * cpd;
    const chooseWindow = useCallback(
        (next: DayWindow) => {
            setDayWindow(next);
            setZoom(FULL_ZOOM);
            const first = next.first * cpd;
            const end = (next.first + next.count) * cpd;
            if (point < first || point >= end) setPoint(first);
        },
        [cpd, point, setPoint, setZoom],
    );
    // In a full season, the merit order starts at the default window's first
    // point.
    useEffect(() => {
        if (fullSeason) setPoint(middleWindow(period.days.length).first * cpd);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const chooseWeek = (index: number) => {
        setWeekIndex(index);
        setPoint(index * pointsPerWeek);
    };

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

    // While another week loads, the charts still show the last one. A click on
    // it would pick a point outside the chosen week, so it is ignored.
    const onTickClick = useCallback(
        (tick: number) => {
            if (fullSeason) {
                if (tick < windowFirst || tick >= windowEnd) return;
            } else if (!isPointOfWeek(tick, weekIndex, cpd)) return;
            setPoint(Math.min(tick, lastPoint));
        },
        [fullSeason, windowFirst, windowEnd, weekIndex, cpd, lastPoint, setPoint],
    );

    // The week shown, which may still be the previous one while the next loads.
    const shown = fullSeason ? windowDays.data : week.data;
    const days = fullSeason ? windowDays : week;
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

    // PROTOTYPE (#1399): every card can be minimized into the sticky bar.
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
                {fullSeason && (
                    <PrototypeSwitcher
                        variants={VARIANTS}
                        current={variant}
                        onChange={setVariant}
                    />
                )}
                {/* PROTOTYPE (#1399): the sticky bar is the first card. */}
                <div
                    ref={stickyRef}
                    className="sticky top-0 z-10 space-y-1.5 rounded-lg border border-border bg-surface-card px-3 py-1.5 shadow-lg"
                >
                    {fullSeason ? (
                        overview.data ? (
                            <SeasonNavigator
                                key={variant}
                                variant={variant}
                                round={period.round}
                                season={period.season}
                                overview={overview.data}
                                labels={labels}
                                window={dayWindow}
                                onWindowChange={chooseWindow}
                            />
                        ) : (
                            <Spinner />
                        )
                    ) : (
                        <div className="flex flex-wrap items-center gap-3 py-1.5">
                            {period.weeks > 1 && (
                                <WeekPicker
                                    weeks={reviewableWeeks(period.days)}
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
                            window={dayWindow}
                            onWindowChange={chooseWindow}
                        />
                    </DockedCard>
                )}
                {labels.me !== null && (
                    <DockedCard id="player">
                        <PlayerPowerCard
                            week={shown}
                            labels={labels}
                            cpd={cpd}
                            {...chart}
                        />
                    </DockedCard>
                )}
                {hadStorage && (
                    <DockedCard id="storage">
                        <PlayerStorageCard
                            week={shown}
                            labels={labels}
                            {...chart}
                        />
                    </DockedCard>
                )}
                <DockedCard id="network">
                    <NetworkPowerCard
                        week={shown}
                        labels={labels}
                        cpd={cpd}
                        {...chart}
                    />
                </DockedCard>
                <DockedCard id="price">
                    <PriceCard week={shown} {...chart} />
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

interface ChartProps extends ChartSyncProps {
    timeAxis: TimeAxis;
    isLoading: boolean;
    isError: boolean;
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
    barGap,
    span,
    above,
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
    /** PROTOTYPE (#1399). */
    barGap?: number;
    span?: string;
    /** Shown above the chart. */
    above?: ReactNode;
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

// ── Season overview (PROTOTYPE, #1399) ────────────────────────────────────────

/**
 * The whole market's generation over a full season, one bar per day at the
 * day's average power. The days shown in detail below are shaded, and clicking
 * a day shows the days around it.
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
    overview: ApiSchema<"PrototypeSeasonOverviewOut"> | undefined;
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
            (overview?.days ?? []).map((_, day) => {
                const row = { tick: day } as ChartRow;
                for (const facility of overview?.facilities ?? []) {
                    row[facility.facility] =
                        (row[facility.facility] ?? 0) +
                        (facility.energy[day] ?? 0) / 24;
                }
                return row;
            }),
        [overview],
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
            title="Daily energy mix"
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
                            window={window}
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
    week,
    labels,
    ...chart
}: ChartProps & { week: PeriodWeek | undefined; labels: Labels }) {
    const [view, setView] = useLocalStorage<StorageView>(
        `${STORAGE_PREFIX}:storage:view`,
        "soc",
    );
    const rows = useMemo(
        () =>
            week && labels.me !== null
                ? playerStorageRows(week, labels.me, view)
                : [],
        [week, labels.me, view],
    );
    const hadStorage = week?.pools.some(
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
                // empty all week.
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
    week,
    ...chart
}: ChartProps & { week: PeriodWeek | undefined }) {
    const rows = useMemo(() => (week ? priceRows(week) : []), [week]);
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
        <ChartCard actions={<MinimizeButton />} icon={BarChart2} iconClassName="text-primary" title={title}>
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
