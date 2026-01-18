import { useMemo, useState } from "react";

import {
    TimeSeriesChart,
    TimeSeriesChartConfig,
} from "@/components/charts/time-series-chart";
import { FacilityName } from "@/components/ui/asset-name";
import { Button } from "@/components/ui/button";
import { useAssetColorGetter } from "@/hooks/useAssetColorGetter";
import { useChartFilters } from "@/hooks/useChartFilters";
import { useGameEngine } from "@/hooks/useGame";
import { usePlayerMap } from "@/hooks/usePlayers";
import { formatEnergy, formatPower } from "@/lib/format-utils";
import { ChartType } from "@/types/charts";
import { Player } from "@/types/players";

interface MarketClearingChartProps {
    chartType: ChartType;
    chartData: Array<Record<string, unknown>>;
    isLoading: boolean;
    isError: boolean;
    hiddenItems: Set<string>;
    breakdownMode: "player" | "type";
    breakdownType: "clearing" | "production" | "consumption";
    playerMap?: Record<number, Player>;
}

export function MarketClearingVolumeChart({
    chartType,
    chartData,
    isLoading,
    isError,
    hiddenItems,
    breakdownMode,
    breakdownType,
    playerMap,
}: MarketClearingChartProps) {
    const getColor = useAssetColorGetter();
    const filterDataKeys = useChartFilters(hiddenItems);

    // For clearing type, extract only quantity data
    const processedData = useMemo(() => {
        if (breakdownType === "clearing") {
            return chartData.map((dataPoint) => ({
                tick: dataPoint.tick as number,
                quantity: dataPoint.quantity as number,
            }));
        }
        return chartData;
    }, [chartData, breakdownType]);

    const chartConfig: TimeSeriesChartConfig = useMemo(
        () => ({
            chartType,
            chartVariant: "bar",
            stacked: breakdownType !== "clearing",
            showBrush: true,
            getColor:
                breakdownType === "clearing"
                    ? () => "var(--chart-1)"
                    : breakdownMode === "type"
                      ? getColor
                      : (key: string) => {
                            // For player mode, use a hash-based color from chart palette
                            const colors = [
                                "var(--chart-1)",
                                "var(--chart-2)",
                                "var(--chart-3)",
                                "var(--chart-4)",
                                "var(--chart-5)",
                                "var(--chart-6)",
                                "var(--chart-7)",
                                "var(--chart-8)",
                            ];
                            let hash = 0;
                            for (let i = 0; i < key.length; i++) {
                                hash = key.charCodeAt(i) + ((hash << 5) - hash);
                            }
                            return (
                                colors[Math.abs(hash) % colors.length] ??
                                "var(--chart-1)"
                            );
                        },
            filterDataKeys: breakdownType === "clearing" ? [] : filterDataKeys,
            formatValue: (value: number) => formatPower(value),
            formatYAxis: (value: number) => formatPower(value),
            formatLabel:
                breakdownMode === "player"
                    ? (key: string) =>
                          playerMap?.[parseInt(key)]?.username ?? key
                    : undefined,
        }),
        [
            chartType,
            getColor,
            filterDataKeys,
            breakdownMode,
            breakdownType,
            playerMap,
        ],
    );

    return (
        <TimeSeriesChart
            data={processedData}
            config={chartConfig}
            isLoading={isLoading}
            isError={isError}
        />
    );
}

interface MarketClearingVolumeTableProps {
    chartData: Array<Record<string, unknown>>;
    resolution: number;
    hiddenItems: Set<string>;
    onToggleItem: (item: string) => void;
    breakdownMode: "player" | "type";
    breakdownType: "production" | "consumption";
}

export function MarketClearingTable({
    chartData,
    resolution,
    hiddenItems,
    onToggleItem,
    breakdownMode,
    breakdownType,
}: MarketClearingVolumeTableProps) {
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
                            {breakdownType === "production"
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
