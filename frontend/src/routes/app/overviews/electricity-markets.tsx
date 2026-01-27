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
import React, { useMemo, useState } from "react";

import {
    BreakdownMode,
    BreakdownType,
    MarketClearingTable,
    MarketClearingVolumeChart,
} from "@/components/charts/market-clearing-volume-chart";
import { MarketPriceChart } from "@/components/charts/market-price-chart";
import { SupplyDemandChart } from "@/components/charts/supply-demand-chart";
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
import {
    SegmentedPicker,
    SegmentedPickerOption,
} from "@/components/ui/segmented-picker";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useTimeMode } from "@/contexts/time-mode-context";
import { useLatestChartData } from "@/hooks/useCharts";
import { useCurrentPlayer } from "@/hooks/useCurrentPlayer";
import {
    useElectricityMarkets,
    useElectricityMarketForPlayer,
    useElectricityMarket,
} from "@/hooks/useElectricityMarkets";
import { useGameTick } from "@/hooks/useGameTick";
import { useToggleSet } from "@/hooks/useToggleSet";
import { formatPower } from "@/lib/format-utils";

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

    // Get market details for tick bounds
    const marketDetails = useElectricityMarket(selectedMarketId ?? 0);

    // Fetch latest data for real-time display
    const { data: latestData, isLoading: isLatestLoading } = useLatestChartData(
        {
            chartType: "market-clearing",
            marketId: selectedMarketId,
            minTick: marketDetails?.created_tick,
        },
    );

    const latestPrice = latestData.price ?? 0;
    const latestQuantity = latestData.quantity ?? 0;

    // Historical tick selection state
    // Initialize to current tick - 1 (most recent market clearing)
    const [selectedTick, setSelectedTick] = useState<number>(
        currentTick !== undefined ? currentTick - 1 : 0,
    );

    // Update selectedTick when currentTick changes (keep it at the latest by default)
    React.useEffect(() => {
        if (currentTick !== undefined) {
            setSelectedTick(currentTick - 1);
        }
    }, [currentTick]);

    // Calculate tick bounds for the slider
    // Lower bound: max of market creation tick and (currentTick - 1440) to respect 1440 tick data retention
    // Upper bound: currentTick - 1 (most recent market clearing)
    const minTick =
        currentTick !== undefined && marketDetails
            ? Math.max(marketDetails.created_tick, currentTick - 1440)
            : 0;
    const maxTick = currentTick !== undefined ? currentTick - 1 : 0;

    // Breakdown state
    const [breakdownEnabled, setBreakdownEnabled] = useState<boolean>(false);
    const [breakdownType, setBreakdownType] = useState<BreakdownType>("supply");
    const [breakdownMode, setBreakdownMode] = useState<BreakdownMode>("player");
    const [hiddenBreakdownItems, toggleBreakdownItem] = useToggleSet<string>();

    // Handle market selection change
    const handleMarketChange = (marketId: number) => {
        navigate({
            to: "/app/overviews/electricity-markets",
            search: { marketId: marketId },
        });
    };

    const clearingChartTitle = `Clearing Volume ${
        !breakdownEnabled
            ? ""
            : `by ${
                  breakdownMode === "player"
                      ? `Player ${breakdownType === "demand" ? "Imports" : "Exports"}`
                      : `${breakdownType === "demand" ? "Consumption" : "Production"} Type`
              }`
    }`;

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
        <div className="p-4 md:p-8 flex flex-col gap-6">
            <Card>
                <CardContent>
                    <div className="space-y-4">
                        <MarketSelector
                            markets={marketsData?.electricity_markets ?? []}
                            marketId={selectedMarketId}
                            onMarketIdChange={handleMarketChange}
                        />
                        <ResolutionPicker
                            currentTick={currentTick}
                            minTick={marketDetails?.created_tick}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Latest Values Display */}
            <Card>
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
                                    <span className="text-foreground">
                                        <Money amount={latestPrice} />
                                        /Wh
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="bg-muted text-muted-foreground p-4 rounded-lg border border-border">
                            <div className="text-sm mb-1">Clearing Volume</div>
                            <div className="text-2xl font-bold">
                                {isLatestLoading ? (
                                    "Loading..."
                                ) : (
                                    <span className="font-mono text-foreground">
                                        {formatPower(latestQuantity)}
                                    </span>
                                )}
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
            >
                <MarketPriceChart
                    selectedResolution={selectedResolution}
                    marketId={selectedMarketId}
                    minTick={marketDetails?.created_tick}
                />
            </ChartCard>

            {/* Breakdown Section */}
            <Card>
                <CardContent>
                    <div className="flex flex-row gap-10 justify-between">
                        <div className="flex flex-row gap-4 items-center">
                            <Label className="mb-2" htmlFor="breakdown-switch">
                                Breakdown
                            </Label>
                            <Switch
                                id="breakdown-switch"
                                checked={breakdownEnabled}
                                onCheckedChange={setBreakdownEnabled}
                            />
                        </div>
                        {breakdownEnabled && (
                            <>
                                <div className="flex flex-row gap-4 items-center">
                                    <Label className="mb-2">Breakdown</Label>
                                    <SegmentedPicker
                                        value={breakdownMode}
                                        onValueChange={(value) =>
                                            setBreakdownMode(
                                                value as BreakdownMode,
                                            )
                                        }
                                    >
                                        {BREAKDOWN_MODE_OPTIONS.map(
                                            (option) => (
                                                <SegmentedPickerOption
                                                    key={option.value}
                                                    value={option.value}
                                                >
                                                    {option.label}
                                                </SegmentedPickerOption>
                                            ),
                                        )}
                                    </SegmentedPicker>
                                </div>
                                <div className="flex flex-row gap-4 items-center">
                                    <Label className="mb-2">Show</Label>
                                    <SegmentedPicker
                                        value={breakdownType}
                                        onValueChange={(value) =>
                                            setBreakdownType(
                                                value as BreakdownType,
                                            )
                                        }
                                    >
                                        <SegmentedPickerOption
                                            key={"supply"}
                                            value={"supply"}
                                        >
                                            {breakdownMode === "player"
                                                ? "Exports"
                                                : "Production"}
                                        </SegmentedPickerOption>
                                        <SegmentedPickerOption
                                            key={"demand"}
                                            value={"demand"}
                                        >
                                            {breakdownMode === "player"
                                                ? "Imports"
                                                : "Consumption"}
                                        </SegmentedPickerOption>
                                    </SegmentedPicker>
                                </div>
                            </>
                        )}
                    </div>
                </CardContent>
            </Card>

            <ChartCard
                icon={
                    !breakdownEnabled
                        ? Activity
                        : breakdownMode === "player"
                          ? Users
                          : Layers
                }
                iconClassName="text-primary"
                title={clearingChartTitle}
            >
                <MarketClearingVolumeChart
                    resolution={selectedResolution}
                    marketId={selectedMarketId}
                    hiddenItems={hiddenBreakdownItems}
                    breakdownEnabled={breakdownEnabled}
                    breakdownMode={breakdownMode}
                    breakdownType={breakdownType}
                    minTick={marketDetails?.created_tick}
                />

                {breakdownEnabled && (
                    <MarketClearingTable
                        resolution={selectedResolution}
                        marketId={selectedMarketId}
                        hiddenItems={hiddenBreakdownItems}
                        onToggleItem={toggleBreakdownItem}
                        breakdownEnabled={breakdownEnabled}
                        breakdownMode={breakdownMode}
                        breakdownType={breakdownType}
                        minTick={marketDetails?.created_tick}
                    />
                )}
            </ChartCard>

            {/* Supply/Demand Curves */}
            {currentTick !== undefined && (
                <ChartCard
                    icon={TrendingUp}
                    iconClassName="text-primary"
                    title="Supply & Demand Curves"
                >
                    <div className="space-y-4 mb-4">
                        <div className="flex items-center justify-between gap-4">
                            <Label className="text-sm font-medium shrink-0">
                                Historical Tick: {selectedTick}
                            </Label>
                            <div className="flex-1">
                                <Slider
                                    min={minTick}
                                    max={maxTick}
                                    step={1}
                                    value={[selectedTick]}
                                    onValueChange={(values) =>
                                        setSelectedTick(values[0] ?? minTick)
                                    }
                                    disabled={minTick >= maxTick}
                                />
                            </div>
                            <div className="text-sm text-muted-foreground shrink-0">
                                {minTick} - {maxTick}
                            </div>
                        </div>
                    </div>
                    <SupplyDemandChart
                        marketId={selectedMarketId}
                        tick={selectedTick}
                        breakdownEnabled={breakdownEnabled}
                        breakdownMode={breakdownMode}
                        breakdownType={breakdownType}
                    />
                </ChartCard>
            )}
        </div>
    );
}

interface MarketSelectorProps {
    markets: Array<{ id: number; name: string }>;
    marketId: number;
    onMarketIdChange: (marketId: number) => void;
}

// TODO: use shadcn selectors
function MarketSelector({
    markets,
    marketId,
    onMarketIdChange,
}: MarketSelectorProps) {
    return (
        <div>
            <Label className="mb-2">Market</Label>
            <select
                value={marketId}
                onChange={(e) => onMarketIdChange(Number(e.target.value))}
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
