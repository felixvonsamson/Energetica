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
import { useMemo, useState } from "react";

import {
    MarketClearingTable,
    MarketClearingVolumeChart,
} from "@/components/charts/market-clearing-volume-chart";
import { MarketPriceChart } from "@/components/charts/market-price-chart";
import { GameLayout } from "@/components/layout/game-layout";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Money,
} from "@/components/ui";
import { ChartCard } from "@/components/ui/chart-card";
import { Label } from "@/components/ui/label";
import { ResolutionPicker } from "@/components/ui/resolution-picker";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTimeMode } from "@/contexts/time-mode-context";
import { useCurrentChartData, useLatestChartData } from "@/hooks/useCharts";
import { useCurrentPlayer } from "@/hooks/useCurrentPlayer";
import {
    useElectricityMarkets,
    useElectricityMarketForPlayer,
} from "@/hooks/useElectricityMarkets";
import { useGameTick } from "@/hooks/useGameTick";
import { usePlayerMap } from "@/hooks/usePlayers";
import { useToggleSet } from "@/hooks/useToggleSet";
import { formatPower } from "@/lib/format-utils";
import type { ChartType } from "@/types/charts";

interface MarketsSearchParams {
    marketId?: number;
}

export const Route = createFileRoute("/app/overviews/electricity-markets")({
    component: MarketsOverviewPage,
    staticData: {
        title: "Markets Overview",
        routeConfig: {
            requiredRole: "player",
            requiresSettledTile: true,
            isUnlocked: (cap) => cap.has_network,
        },
        infoModal: {
            contents: <MarketsOverviewHelp />,
        },
    },
    validateSearch: (search: Record<string, unknown>): MarketsSearchParams => ({
        marketId: search.marketId ? Number(search.marketId) : undefined,
    }),
});

function MarketsOverviewHelp() {
    return (
        <div className="space-y-3">
            <p>
                This page shows electricity market price and clearing volume
                over time for a selected market.
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
                        Use the market selector to view different electricity
                        markets
                    </span>
                </li>
            </ul>
            <p>Use different time resolutions to analyze market trends.</p>
        </div>
    );
}

function MarketsOverviewPage() {
    return (
        <GameLayout>
            <MarketsOverviewContent />
        </GameLayout>
    );
}

const BREAKDOWN_TYPE_OPTIONS = [
    { value: "clearing", label: "Clearing Volume" },
    { value: "production", label: "Production" },
    { value: "consumption", label: "Consumption" },
] as const;

const BREAKDOWN_MODE_OPTIONS = [
    { value: "player", label: "By Player" },
    { value: "type", label: "By Type" },
] as const;

function MarketsOverviewContent() {
    const { currentTick } = useGameTick();
    const { playerId } = useCurrentPlayer();
    const navigate = useNavigate();
    const { marketId: searchMarketId } = Route.useSearch();

    // Get player's market as fallback
    const playerMarket = useElectricityMarketForPlayer(playerId);
    const { data: marketsData } = useElectricityMarkets();
    const playerMap = usePlayerMap();

    // Determine which market to show
    const selectedMarketId = searchMarketId ?? playerMarket?.id;

    // Find the selected market name
    const selectedMarket = useMemo(() => {
        if (!marketsData || !selectedMarketId) return null;
        return marketsData.electricity_markets.find(
            (m) => m.id === selectedMarketId,
        );
    }, [marketsData, selectedMarketId]);

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
        marketId: selectedMarketId,
    });

    // Fetch latest data for real-time display
    const { data: latestData, isLoading: isLatestLoading } = useLatestChartData(
        {
            chartType: "network-data",
            marketId: selectedMarketId,
        },
    );

    const latestPrice = latestData.price ?? 0;
    const latestQuantity = latestData.quantity ?? 0;

    // Breakdown state
    const [breakdownType, setBreakdownType] = useState<
        "clearing" | "production" | "consumption"
    >("clearing");
    const [breakdownMode, setBreakdownMode] = useState<"player" | "type">(
        "player",
    );
    const [hiddenBreakdownItems, toggleBreakdownItem] = useToggleSet<string>();

    // Determine which chart type to use for breakdown
    const breakdownChartType: ChartType = useMemo(() => {
        if (breakdownType === "clearing") {
            return "network-data"; // Use network-data for clearing volume
        } else if (breakdownType === "production") {
            return breakdownMode === "player"
                ? "network-exports"
                : "network-generation";
        } else {
            return breakdownMode === "player"
                ? "network-imports"
                : "network-consumption";
        }
    }, [breakdownType, breakdownMode]);

    // Fetch breakdown chart data (use existing data for clearing type)
    const {
        chartData: breakdownChartData,
        isLoading: isBreakdownLoading,
        isError: isBreakdownError,
    } = useCurrentChartData({
        chartType: breakdownChartType,
        currentTick,
        resolution: selectedResolution.resolution,
        maxDatapoints: selectedResolution.datapoints,
        marketId: selectedMarketId,
    });

    // For clearing type, use the chartData directly
    const finalBreakdownData =
        breakdownType === "clearing" ? chartData : breakdownChartData;

    // Handle market selection change
    const handleMarketChange = (marketId: number) => {
        navigate({
            to: "/app/overviews/electricity-markets",
            search: { marketId: marketId },
        });
    };

    // Show message if player is not in a market and none selected
    if (!selectedMarketId) {
        return (
            <div className="p-4 md:p-8">
                <Card>
                    <CardContent>
                        <p className="text-muted">
                            You are not currently in an electricity market. Join
                            or create a market to view market data.
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
                        <MarketSelector
                            markets={marketsData?.electricity_markets ?? []}
                            selectedMarketId={selectedMarketId}
                            onMarketChange={handleMarketChange}
                        />
                        <ResolutionPicker currentTick={currentTick} />
                    </div>
                </CardContent>
            </Card>

            {/* Latest Values Display */}
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <NetworkIcon className="w-6 h-6 text-primary" />
                        {selectedMarket?.name ?? "Market"} - Current Values
                    </CardTitle>
                </CardHeader>

                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-muted text-muted-foreground p-4 rounded-lg border border-border">
                            <div className="text-sm mb-1">Market Price</div>
                            <div className="text-2xl font-bold">
                                {isLatestLoading ? (
                                    "Loading..."
                                ) : (
                                    <Money amount={latestPrice} />
                                )}
                                <span className="text-sm font-normal ml-1">
                                    /Wh
                                </span>
                            </div>
                        </div>
                        <div className="bg-muted text-muted-foreground p-4 rounded-lg border border-border">
                            <div className="text-sm mb-1">Clearing Volume</div>
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
            <ChartCard
                icon={TrendingUp}
                iconClassName="text-primary"
                title="Market Price"
                className="mb-6"
            >
                <MarketPriceChart
                    chartData={chartData}
                    isLoading={isChartLoading}
                    isError={isError}
                />
            </ChartCard>

            {/* Breakdown Section */}
            <Card className="mb-6">
                <CardContent>
                    <div className="space-y-4">
                        <div>
                            <Label className="mb-2">Breakdown Type</Label>
                            <Tabs
                                value={breakdownType}
                                onValueChange={(value) =>
                                    setBreakdownType(
                                        value as
                                            | "clearing"
                                            | "production"
                                            | "consumption",
                                    )
                                }
                            >
                                <TabsList>
                                    {BREAKDOWN_TYPE_OPTIONS.map((option) => (
                                        <TabsTrigger
                                            key={option.value}
                                            value={option.value}
                                        >
                                            {option.label}
                                        </TabsTrigger>
                                    ))}
                                </TabsList>
                            </Tabs>
                        </div>
                        {breakdownType !== "clearing" && (
                            <div>
                                <Label className="mb-2">Breakdown Mode</Label>
                                <Tabs
                                    value={breakdownMode}
                                    onValueChange={(value) =>
                                        setBreakdownMode(
                                            value as "player" | "type",
                                        )
                                    }
                                >
                                    <TabsList>
                                        {BREAKDOWN_MODE_OPTIONS.map(
                                            (option) => (
                                                <TabsTrigger
                                                    key={option.value}
                                                    value={option.value}
                                                >
                                                    {option.label}
                                                </TabsTrigger>
                                            ),
                                        )}
                                    </TabsList>
                                </Tabs>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <ChartCard
                icon={
                    breakdownType === "clearing"
                        ? Activity
                        : breakdownMode === "player"
                          ? Users
                          : Layers
                }
                iconClassName="text-primary"
                title={
                    breakdownType === "clearing"
                        ? "Clearing Volume"
                        : `${breakdownType === "production" ? "Production" : "Consumption"} by ${breakdownMode === "player" ? "Player" : "Type"}`
                }
                className="mb-6"
            >
                <MarketClearingVolumeChart
                    chartType={breakdownChartType}
                    chartData={finalBreakdownData}
                    isLoading={
                        breakdownType === "clearing"
                            ? isChartLoading
                            : isBreakdownLoading
                    }
                    isError={
                        breakdownType === "clearing"
                            ? isError
                            : isBreakdownError
                    }
                    hiddenItems={hiddenBreakdownItems}
                    breakdownMode={breakdownMode}
                    breakdownType={breakdownType}
                    playerMap={playerMap}
                />

                {breakdownType !== "clearing" && (
                    <div className="mt-6">
                        <MarketClearingTable
                            chartData={finalBreakdownData}
                            resolution={selectedResolution.resolution}
                            hiddenItems={hiddenBreakdownItems}
                            onToggleItem={toggleBreakdownItem}
                            breakdownMode={breakdownMode}
                            breakdownType={breakdownType}
                        />
                    </div>
                )}
            </ChartCard>
        </div>
    );
}

interface MarketSelectorProps {
    markets: Array<{ id: number; name: string }>;
    selectedMarketId: number;
    onMarketChange: (marketId: number) => void;
}

function MarketSelector({
    markets,
    selectedMarketId: selectedMarketId,
    onMarketChange: onMarketChange,
}: MarketSelectorProps) {
    return (
        <div>
            <Label className="mb-2">Market</Label>
            <select
                value={selectedMarketId}
                onChange={(e) => onMarketChange(Number(e.target.value))}
                className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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
