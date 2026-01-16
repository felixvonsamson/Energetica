/**
 * Networks overview page - Electricity market price and clearing volume
 * visualization.
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
    TrendingUp,
    Activity,
    Network as NetworkIcon,
    Users,
    Layers,
} from "lucide-react";
import { useMemo, useState, useCallback } from "react";

import {
    TimeSeriesChart,
    ResolutionPicker,
    filterNonZeroSeries,
    createExcludeKeysFilter,
    type TimeSeriesChartConfig,
} from "@/components/charts";
import { GameLayout } from "@/components/layout/game-layout";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Money,
} from "@/components/ui";
import { FacilityName } from "@/components/ui/asset-name";
import { Label } from "@/components/ui/label";
import { useTimeMode } from "@/contexts/time-mode-context";
import { useAssetColorGetter } from "@/hooks/useAssetColorGetter";
import { useCurrentChartData, useLatestChartData } from "@/hooks/useCharts";
import { useCurrentPlayer } from "@/hooks/useCurrentPlayer";
import {
    useElectricityMarkets,
    useElectricityMarketForPlayer,
} from "@/hooks/useElectricityMarkets";
import { useGameEngine } from "@/hooks/useGame";
import { useGameTick } from "@/hooks/useGameTick";
import { usePlayerMap } from "@/hooks/usePlayers";
import { formatPower, formatEnergy } from "@/lib/format-utils";
import type { ChartType } from "@/types/charts";
import type { Player } from "@/types/players";

interface NetworksSearchParams {
    networkId?: number;
}

export const Route = createFileRoute("/app/overviews/networks")({
    component: NetworksOverviewPage,
    staticData: {
        title: "Networks Overview",
        routeConfig: {
            requiredRole: "player",
            requiresSettledTile: true,
            isUnlocked: (cap) => cap.has_network,
        },
        infoModal: {
            contents: <NetworksOverviewHelp />,
        },
    },
    validateSearch: (
        search: Record<string, unknown>,
    ): NetworksSearchParams => ({
        networkId: search.networkId ? Number(search.networkId) : undefined,
    }),
});

function NetworksOverviewHelp() {
    return (
        <div className="space-y-3">
            <p>
                This page shows electricity market price and clearing volume
                over time for a selected network.
            </p>
            <ul className="list-none space-y-1 ml-4">
                <li className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 shrink-0" />
                    <span>
                        <b>Market Price:</b> The clearing price at which
                        electricity trades in the market ($/Wh)
                    </span>
                </li>
                <li className="flex items-center gap-2">
                    <Activity className="w-4 h-4 shrink-0" />
                    <span>
                        <b>Clearing Volume:</b> The total quantity of
                        electricity traded at the clearing price (W)
                    </span>
                </li>
                <li className="flex items-center gap-2">
                    <NetworkIcon className="w-4 h-4 shrink-0" />
                    <span>
                        Use the network selector to view different electricity
                        markets
                    </span>
                </li>
            </ul>
            <p>Use different time resolutions to analyze market trends.</p>
        </div>
    );
}

function NetworksOverviewPage() {
    return (
        <GameLayout>
            <NetworksOverviewContent />
        </GameLayout>
    );
}

function NetworksOverviewContent() {
    const { currentTick } = useGameTick();
    const { playerId } = useCurrentPlayer();
    const navigate = useNavigate();
    const { networkId: searchNetworkId } = Route.useSearch();

    // Get player's network as fallback
    const playerMarket = useElectricityMarketForPlayer(playerId);
    const { data: marketsData } = useElectricityMarkets();
    const playerMap = usePlayerMap();

    // Determine which network to show
    const selectedNetworkId = searchNetworkId ?? playerMarket?.id;

    // Find the selected network name
    const selectedNetwork = useMemo(() => {
        if (!marketsData || !selectedNetworkId) return null;
        return marketsData.electricity_markets.find(
            (m) => m.id === selectedNetworkId,
        );
    }, [marketsData, selectedNetworkId]);

    const { selectedResolution } = useTimeMode();

    // Fetch chart data for network-data
    const {
        chartData,
        isLoading: isChartLoading,
        isError,
    } = useCurrentChartData({
        chartType: "network-data",
        currentTick,
        resolution: selectedResolution.resolution,
        maxDatapoints: selectedResolution.datapoints,
        networkId: selectedNetworkId,
    });

    // Fetch latest data for real-time display
    const { data: latestData, isLoading: isLatestLoading } = useLatestChartData(
        {
            chartType: "network-data",
            networkId: selectedNetworkId,
        },
    );

    const latestPrice = latestData.price ?? 0;
    const latestQuantity = latestData.quantity ?? 0;

    // Breakdown state
    const [breakdownType, setBreakdownType] = useState<
        "production" | "consumption"
    >("production");
    const [breakdownMode, setBreakdownMode] = useState<"player" | "type">(
        "player",
    );
    const [hiddenBreakdownItems, setHiddenBreakdownItems] = useState<
        Set<string>
    >(new Set());

    // Determine which chart type to use for breakdown
    const breakdownChartType: ChartType = useMemo(() => {
        if (breakdownType === "production") {
            return breakdownMode === "player"
                ? "network-exports"
                : "network-generation";
        } else {
            return breakdownMode === "player"
                ? "network-imports"
                : "network-consumption";
        }
    }, [breakdownType, breakdownMode]);

    // Fetch breakdown chart data
    const {
        chartData: breakdownChartData,
        isLoading: isBreakdownLoading,
        isError: isBreakdownError,
    } = useCurrentChartData({
        chartType: breakdownChartType,
        currentTick,
        resolution: selectedResolution.resolution,
        maxDatapoints: selectedResolution.datapoints,
        networkId: selectedNetworkId,
    });

    // Handle network selection change
    const handleNetworkChange = (networkId: number) => {
        navigate({
            to: "/app/overviews/networks",
            search: { networkId },
        });
    };

    // Toggle breakdown item visibility
    const handleToggleBreakdownItem = useCallback((item: string) => {
        setHiddenBreakdownItems((prev) => {
            const next = new Set(prev);
            if (next.has(item)) {
                next.delete(item);
            } else {
                next.add(item);
            }
            return next;
        });
    }, []);

    // Show message if player is not in a network and none selected
    if (!selectedNetworkId) {
        return (
            <div className="p-4 md:p-8">
                <Card>
                    <CardContent>
                        <p className="text-muted">
                            You are not currently in an electricity market. Join
                            or create a market to view network data.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8">
            <Card className="mb-6">
                <CardContent>
                    <div className="space-y-4">
                        <NetworkSelector
                            markets={marketsData?.electricity_markets ?? []}
                            selectedNetworkId={selectedNetworkId}
                            onNetworkChange={handleNetworkChange}
                        />
                        <ResolutionPicker currentTick={currentTick} />
                    </div>
                </CardContent>
            </Card>

            {/* Latest Values Display */}
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <NetworkIcon className="w-6 h-6 text-blue-500" />
                        {selectedNetwork?.name ?? "Network"} - Current Values
                    </CardTitle>
                </CardHeader>

                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <div className="text-sm text-gray-600 mb-1">
                                Market Price
                            </div>
                            <div className="text-2xl font-bold">
                                {isLatestLoading ? (
                                    "Loading..."
                                ) : (
                                    <Money amount={latestPrice} />
                                )}
                                <span className="text-sm font-normal text-gray-600 ml-1">
                                    /Wh
                                </span>
                            </div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <div className="text-sm text-gray-600 mb-1">
                                Clearing Volume
                            </div>
                            <div className="text-2xl font-bold">
                                {isLatestLoading
                                    ? "Loading..."
                                    : formatPower(latestQuantity)}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Price Chart */}
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 mb-4">
                        <TrendingUp className="w-6 h-6 text-green-500" />
                        Market Price
                    </CardTitle>
                </CardHeader>

                <CardContent>
                    <PriceChart
                        chartData={chartData}
                        isLoading={isChartLoading}
                        isError={isError}
                    />
                </CardContent>
            </Card>

            {/* Clearing Volume Chart */}
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Activity className="w-6 h-6 text-purple-500" />
                        Clearing Volume
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <ClearingVolumeChart
                        chartData={chartData}
                        isLoading={isChartLoading}
                        isError={isError}
                    />
                </CardContent>
            </Card>

            {/* Breakdown Section */}
            <Card className="mb-6">
                <CardContent>
                    <div className="space-y-4">
                        <BreakdownTypePicker
                            breakdownType={breakdownType}
                            onBreakdownTypeChange={setBreakdownType}
                        />
                        <BreakdownModePicker
                            breakdownMode={breakdownMode}
                            onBreakdownModeChange={setBreakdownMode}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>
                        <div className="flex items-center gap-2 mb-4">
                            {breakdownMode === "player" ? (
                                <Users className="w-6 h-6 text-blue-500" />
                            ) : (
                                <Layers className="w-6 h-6 text-orange-500" />
                            )}
                            {breakdownType === "production"
                                ? "Production"
                                : "Consumption"}{" "}
                            by {breakdownMode === "player" ? "Player" : "Type"}
                        </div>
                    </CardTitle>
                </CardHeader>

                <CardContent>
                    <BreakdownChart
                        chartData={breakdownChartData}
                        isLoading={isBreakdownLoading}
                        isError={isBreakdownError}
                        hiddenItems={hiddenBreakdownItems}
                        breakdownMode={breakdownMode}
                        playerMap={playerMap}
                    />

                    <div className="mt-6">
                        <NetworkBreakdownTable
                            chartData={breakdownChartData}
                            resolution={selectedResolution.resolution}
                            hiddenItems={hiddenBreakdownItems}
                            onToggleItem={handleToggleBreakdownItem}
                            breakdownMode={breakdownMode}
                            breakdownType={breakdownType}
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

interface NetworkSelectorProps {
    markets: Array<{ id: number; name: string }>;
    selectedNetworkId: number;
    onNetworkChange: (networkId: number) => void;
}

function NetworkSelector({
    markets,
    selectedNetworkId,
    onNetworkChange,
}: NetworkSelectorProps) {
    return (
        <div>
            <Label className="mb-2">Network</Label>
            <select
                value={selectedNetworkId}
                onChange={(e) => onNetworkChange(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                {markets.map((market) => (
                    <option key={market.id} value={market.id}>
                        {market.name}
                    </option>
                ))}
            </select>
        </div>
    );
}

interface PriceChartProps {
    chartData: Array<Record<string, unknown>>;
    isLoading: boolean;
    isError: boolean;
}

function PriceChart({ chartData, isLoading, isError }: PriceChartProps) {
    // Extract only price data
    const priceData = useMemo(() => {
        return chartData.map((dataPoint) => ({
            tick: dataPoint.tick as number,
            price: dataPoint.price as number,
        }));
    }, [chartData]);

    const chartConfig: TimeSeriesChartConfig = useMemo(
        () => ({
            chartVariant: "line",
            stacked: false,
            showBrush: true,
            getColor: () => "#10b981", // green-500
            filterDataKeys: [],
            formatValue: (value: number) => `$${value.toFixed(6)}`,
            formatYAxis: (value: number) => `$${value.toFixed(6)}`,
        }),
        [],
    );

    return (
        <TimeSeriesChart
            data={priceData}
            config={chartConfig}
            isLoading={isLoading}
            isError={isError}
        />
    );
}

interface ClearingVolumeChartProps {
    chartData: Array<Record<string, unknown>>;
    isLoading: boolean;
    isError: boolean;
}

function ClearingVolumeChart({
    chartData,
    isLoading,
    isError,
}: ClearingVolumeChartProps) {
    // Extract only quantity data
    const volumeData = useMemo(() => {
        return chartData.map((dataPoint) => ({
            tick: dataPoint.tick as number,
            quantity: dataPoint.quantity as number,
        }));
    }, [chartData]);

    const chartConfig: TimeSeriesChartConfig = useMemo(
        () => ({
            chartVariant: "bar",
            stacked: false,
            showBrush: true,
            getColor: () => "#8b5cf6", // purple-500
            filterDataKeys: [],
            formatValue: (value: number) => formatPower(value),
            formatYAxis: (value: number) => formatPower(value),
        }),
        [],
    );

    return (
        <TimeSeriesChart
            data={volumeData}
            config={chartConfig}
            isLoading={isLoading}
            isError={isError}
        />
    );
}

interface BreakdownTypePickerProps {
    breakdownType: "production" | "consumption";
    onBreakdownTypeChange: (type: "production" | "consumption") => void;
}

function BreakdownTypePicker({
    breakdownType,
    onBreakdownTypeChange,
}: BreakdownTypePickerProps) {
    return (
        <div>
            <Label className="mb-2">Breakdown Type</Label>
            <div className="flex gap-2">
                <button
                    onClick={() => onBreakdownTypeChange("production")}
                    className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                        breakdownType === "production"
                            ? "bg-blue-600 text-white"
                            : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                    }`}
                >
                    Production
                </button>
                <button
                    onClick={() => onBreakdownTypeChange("consumption")}
                    className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                        breakdownType === "consumption"
                            ? "bg-blue-600 text-white"
                            : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                    }`}
                >
                    Consumption
                </button>
            </div>
        </div>
    );
}

interface BreakdownModePickerProps {
    breakdownMode: "player" | "type";
    onBreakdownModeChange: (mode: "player" | "type") => void;
}

function BreakdownModePicker({
    breakdownMode,
    onBreakdownModeChange,
}: BreakdownModePickerProps) {
    return (
        <div>
            <Label className="mb-2">Breakdown Mode</Label>
            <div className="flex gap-2">
                <button
                    onClick={() => onBreakdownModeChange("player")}
                    className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                        breakdownMode === "player"
                            ? "bg-blue-600 text-white"
                            : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                    }`}
                >
                    By Player
                </button>
                <button
                    onClick={() => onBreakdownModeChange("type")}
                    className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                        breakdownMode === "type"
                            ? "bg-blue-600 text-white"
                            : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                    }`}
                >
                    By Type
                </button>
            </div>
        </div>
    );
}

interface BreakdownChartProps {
    chartData: Array<Record<string, unknown>>;
    isLoading: boolean;
    isError: boolean;
    hiddenItems: Set<string>;
    breakdownMode: "player" | "type";
    playerMap?: Record<number, Player>;
}

function BreakdownChart({
    chartData,
    isLoading,
    isError,
    hiddenItems,
    breakdownMode,
    playerMap,
}: BreakdownChartProps) {
    const getColor = useAssetColorGetter();

    // Create a composite filter
    const filterDataKeys = useMemo(() => {
        return [
            filterNonZeroSeries,
            createExcludeKeysFilter(Array.from(hiddenItems)),
        ];
    }, [hiddenItems]);

    const chartConfig: TimeSeriesChartConfig = useMemo(
        () => ({
            chartVariant: "bar",
            stacked: true,
            showBrush: true,
            getColor:
                breakdownMode === "type"
                    ? getColor
                    : (key: string) => {
                          // For player mode, use a hash-based color
                          const colors = [
                              "#3b82f6", // blue-500
                              "#10b981", // green-500
                              "#f59e0b", // amber-500
                              "#ef4444", // red-500
                              "#8b5cf6", // purple-500
                              "#ec4899", // pink-500
                              "#06b6d4", // cyan-500
                              "#84cc16", // lime-500
                          ];
                          let hash = 0;
                          for (let i = 0; i < key.length; i++) {
                              hash = key.charCodeAt(i) + ((hash << 5) - hash);
                          }
                          return (
                              colors[Math.abs(hash) % colors.length] ??
                              "#3b82f6"
                          );
                      },
            filterDataKeys,
            formatValue: (value: number) => formatPower(value),
            formatYAxis: (value: number) => formatPower(value),
            formatLabel:
                breakdownMode === "player"
                    ? (key: string) =>
                          playerMap?.[parseInt(key)]?.username ?? key
                    : undefined,
        }),
        [getColor, filterDataKeys, breakdownMode, playerMap],
    );

    return (
        <TimeSeriesChart
            data={chartData}
            config={chartConfig}
            isLoading={isLoading}
            isError={isError}
        />
    );
}

interface NetworkBreakdownTableProps {
    chartData: Array<Record<string, unknown>>;
    resolution: number;
    hiddenItems: Set<string>;
    onToggleItem: (item: string) => void;
    breakdownMode: "player" | "type";
    breakdownType: "production" | "consumption";
}

function NetworkBreakdownTable({
    chartData,
    resolution,
    hiddenItems,
    onToggleItem,
    breakdownMode,
    breakdownType,
}: NetworkBreakdownTableProps) {
    const [sortKey, setSortKey] = useState<"name" | "energy">("energy");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
    const { data: gameEngine } = useGameEngine();
    const playerMap = usePlayerMap();

    // Calculate aggregated data for each item
    const rows = useMemo(() => {
        if (!chartData || chartData.length === 0 || !gameEngine) return [];

        // Get all items from the chart data
        const items = new Set<string>();
        chartData.forEach((dataPoint) => {
            Object.keys(dataPoint).forEach((key) => {
                if (key !== "tick") {
                    items.add(key);
                }
            });
        });

        // Calculate totals for each item
        const result = Array.from(items).map((item) => {
            const totalEnergy = chartData.reduce((sum, dataPoint) => {
                const power = (dataPoint[item] as number) || 0;
                const timeInHours =
                    (resolution * gameEngine.game_seconds_per_tick) / 3600;
                return sum + power * timeInHours;
            }, 0);

            return { name: item, totalEnergy };
        });

        // Filter out rows with zero energy
        return result.filter((row) => row.totalEnergy > 0);
    }, [chartData, resolution, gameEngine]);

    // Sort rows
    const sortedRows = useMemo(() => {
        const sorted = [...rows];
        sorted.sort((a, b) => {
            const aVal = sortKey === "name" ? a.name : a.totalEnergy;
            const bVal = sortKey === "name" ? b.name : b.totalEnergy;

            if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
            if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
            return 0;
        });
        return sorted;
    }, [rows, sortKey, sortDirection]);

    const handleSort = (key: "name" | "energy") => {
        if (sortKey === key) {
            setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
        } else {
            setSortKey(key);
            setSortDirection("desc");
        }
    };

    const getSortIndicator = (key: "name" | "energy") => {
        if (sortKey !== key) return null;
        return sortDirection === "asc" ? " ▲" : " ▼";
    };

    const allHidden = useMemo(() => {
        return (
            rows.length > 0 && rows.every((row) => hiddenItems.has(row.name))
        );
    }, [rows, hiddenItems]);

    const handleToggleAll = () => {
        if (allHidden) {
            // Show all
            rows.forEach((row) => {
                if (hiddenItems.has(row.name)) {
                    onToggleItem(row.name);
                }
            });
        } else {
            // Hide all
            rows.forEach((row) => {
                if (!hiddenItems.has(row.name)) {
                    onToggleItem(row.name);
                }
            });
        }
    };

    if (sortedRows.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500">
                No data available for this period
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-secondary">
                        <th
                            className="py-3 px-4 text-left font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                            onClick={() => handleSort("name")}
                        >
                            {breakdownMode === "player" ? "Player" : "Type"}
                            {getSortIndicator("name")}
                        </th>
                        <th
                            className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                            onClick={() => handleSort("energy")}
                        >
                            {breakdownType === "production"
                                ? "Exported"
                                : "Imported"}
                            {getSortIndicator("energy")}
                        </th>
                        <th className="py-3 px-4 text-center font-semibold">
                            <button
                                onClick={handleToggleAll}
                                className="px-3 py-1 text-xs font-semibold bg-brand-green hover:bg-brand-green/80 text-white rounded transition-colors"
                            >
                                {allHidden ? "Show All" : "Hide All"}
                            </button>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {sortedRows.map((row) => {
                        const isVisible = !hiddenItems.has(row.name);
                        return (
                            <tr
                                key={row.name}
                                className="border-b border-border/30 hover:bg-tan-green/20 dark:hover:bg-muted/30 transition-colors"
                            >
                                <td className="py-3 px-4">
                                    {breakdownMode === "type" ? (
                                        <FacilityName
                                            facility={row.name}
                                            mode="long"
                                        />
                                    ) : (
                                        (playerMap?.[parseInt(row.name)]
                                            ?.username ?? row.name)
                                    )}
                                </td>
                                <td className="py-3 px-4 text-right font-mono">
                                    {formatEnergy(row.totalEnergy)}
                                </td>
                                <td className="py-3 px-4 text-center">
                                    <button
                                        onClick={() => onToggleItem(row.name)}
                                        className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                                            isVisible
                                                ? "bg-brand-green hover:bg-brand-green/80 text-white"
                                                : "bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300"
                                        }`}
                                    >
                                        {isVisible ? "Hide" : "Show"}
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
