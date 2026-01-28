import { useMemo, useState } from "react";

import {
    TimeSeriesChart,
    TimeSeriesChartConfig,
} from "@/components/charts/time-series-chart";
import { FacilityName } from "@/components/ui/asset-name";
import { Button } from "@/components/ui/button";
import { useAssetColorGetter } from "@/hooks/useAssetColorGetter";
import { useChartFilters } from "@/hooks/useChartFilters";
import { useCurrentChartData } from "@/hooks/useCharts";
import { useGameEngine } from "@/hooks/useGame";
import { useGameTick } from "@/hooks/useGameTick";
import { usePlayerMap } from "@/hooks/usePlayers";
import {
    createIncludeKeysFilter,
    getHashBasedChartColor,
} from "@/lib/charts/chart-utils";
import { formatEnergy, formatPower } from "@/lib/format-utils";
import { ChartType, ResolutionOption } from "@/types/charts";

export type BreakdownType = "supply" | "demand";
export type BreakdownMode = "player" | "type";

function useMarketClearingData(
    resolution: ResolutionOption,
    marketId: number,
    breakdownEnabled: boolean,
    breakdownType: BreakdownType,
    breakdownMode: BreakdownMode,
) {
    const { currentTick } = useGameTick();

    // Determine which chart type to use for breakdown
    const chartType: ChartType = useMemo(() => {
        if (!breakdownEnabled) {
            return "market-clearing"; // Use market-clearing for clearing volume
        } else if (breakdownType === "supply") {
            return breakdownMode === "player"
                ? "market-exports"
                : "market-generation";
        } else {
            return breakdownMode === "player"
                ? "market-imports"
                : "market-consumption";
        }
    }, [breakdownEnabled, breakdownType, breakdownMode]);

    // Fetch breakdown chart data (use existing data for clearing type)
    const { chartData, isLoading, isError } = useCurrentChartData({
        config: { chartType, resolution: resolution.resolution, marketId },
        currentTick,
        maxDatapoints: resolution.datapoints,
    });

    return { chartType, chartData, isLoading, isError };
}

interface MarketClearingChartProps {
    resolution: ResolutionOption;
    marketId: number;
    hiddenItems: Set<string>;
    breakdownEnabled: boolean;
    breakdownMode: BreakdownMode;
    breakdownType: BreakdownType;
    minTick?: number;
}

export function MarketClearingVolumeChart({
    resolution,
    marketId,
    hiddenItems,
    breakdownEnabled,
    breakdownMode,
    breakdownType,
}: MarketClearingChartProps) {
    const getColor = useAssetColorGetter();
    const playerMap = usePlayerMap();

    // filters
    const breakdownFilter = useChartFilters(hiddenItems);
    const quantityFilter = createIncludeKeysFilter(["quantity"]);

    const { chartType, chartData, isLoading, isError } = useMarketClearingData(
        resolution,
        marketId,
        breakdownEnabled,
        breakdownType,
        breakdownMode,
    );

    const chartConfig: TimeSeriesChartConfig = useMemo(
        () => ({
            chartType,
            chartVariant: "area",
            stacked: breakdownEnabled,
            showBrush: true,
            getColor: !breakdownEnabled
                ? () => "var(--chart-2)"
                : breakdownMode === "type"
                  ? getColor
                  : getHashBasedChartColor,
            filterDataKeys: breakdownEnabled
                ? breakdownFilter
                : [quantityFilter],
            formatValue: (value: number) => formatPower(value),
            formatYAxis: (value: number) => formatPower(value),
            formatLabel:
                breakdownMode === "player"
                    ? (key: string) =>
                          playerMap?.[parseInt(key)]?.username ?? key
                    : undefined,
            hideZeroValues: false,
        }),
        [
            chartType,
            breakdownEnabled,
            breakdownMode,
            getColor,
            breakdownFilter,
            quantityFilter,
            playerMap,
        ],
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

interface MarketClearingVolumeTableProps {
    resolution: ResolutionOption;
    marketId: number;
    hiddenItems: Set<string>;
    onToggleItem: (item: string) => void;
    breakdownEnabled: boolean;
    breakdownMode: BreakdownMode;
    breakdownType: BreakdownType;
    minTick?: number;
}

export function MarketClearingTable({
    resolution,
    marketId,
    hiddenItems,
    onToggleItem,
    breakdownEnabled,
    breakdownMode,
    breakdownType,
}: MarketClearingVolumeTableProps) {
    const { chartData } = useMarketClearingData(
        resolution,
        marketId,
        breakdownEnabled,
        breakdownType,
        breakdownMode,
    );

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
                    (resolution.resolution * gameEngine.game_seconds_per_tick) /
                    3600;
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
            <div className="text-center py-8 text-muted-foreground">
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
                            className="py-3 px-4 text-left font-semibold cursor-pointer hover:bg-secondary/80 transition-colors"
                            onClick={() => handleSort("name")}
                        >
                            {breakdownMode === "player" ? "Player" : "Type"}
                            {getSortIndicator("name")}
                        </th>
                        <th
                            className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-secondary/80 transition-colors"
                            onClick={() => handleSort("energy")}
                        >
                            {breakdownType === "supply"
                                ? "Exported"
                                : "Imported"}
                            {getSortIndicator("energy")}
                        </th>
                        <th className="py-3 px-4 text-center font-semibold">
                            <Button
                                onClick={handleToggleAll}
                                size="sm"
                                variant="default"
                            >
                                {allHidden ? "Show All" : "Hide All"}
                            </Button>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {sortedRows.map((row) => {
                        const isVisible = !hiddenItems.has(row.name);
                        return (
                            <tr
                                key={row.name}
                                className="border-b border-border hover:bg-muted/50 transition-colors"
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
                                    <Button
                                        onClick={() => onToggleItem(row.name)}
                                        size="sm"
                                        variant={
                                            isVisible ? "default" : "ghost"
                                        }
                                    >
                                        {isVisible ? "Hide" : "Show"}
                                    </Button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
