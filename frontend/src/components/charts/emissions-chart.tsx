import { useCallback, useMemo, useState } from "react";

import {
    EChartsTimeSeries,
    EChartsTimeSeriesConfig,
} from "@/components/charts/echarts-time-series";
import { AssetIcon } from "@/components/ui/asset-icon";
import { AssetName } from "@/components/ui/asset-name";
import { Label } from "@/components/ui/label";
import { useAssetColorGetter } from "@/hooks/use-asset-color-getter";
import { useChartFilters } from "@/hooks/use-chart-filters";
import { formatEmissions } from "@/lib/format-utils";

// Emissions Chart Component
interface EmissionsChartProps {
    chartData: Array<Record<string, unknown>>;
    isLoading: boolean;
    isError: boolean;
    hiddenSources: Set<string>;
    viewMode: "normal" | "percent";
    cumulativeMode: "rates" | "cumulative";
}

export function EmissionsChart({
    chartData,
    isLoading,
    isError,
    hiddenSources,
    viewMode,
    cumulativeMode,
}: EmissionsChartProps) {
    const getColor = useAssetColorGetter();
    const filterDataKeys = useChartFilters(hiddenSources);

    // Transform data for cumulative and percent view
    const transformedData: Array<Record<string, unknown>> = useMemo(() => {
        if (chartData.length === 0) {
            return chartData;
        }

        let processedData = chartData;

        // Apply cumulative transformation first if needed
        if (cumulativeMode === "cumulative") {
            // Calculate cumulative emissions by integrating rates over time
            const cumulativeData: Array<Record<string, unknown>> = [];
            const cumulative: Record<string, number> = {};

            // Process from oldest to newest (data is sorted by tick ascending)
            for (let i = 0; i < chartData.length; i++) {
                const dp = chartData[i] as Record<string, unknown>;
                const result: Record<string, unknown> = {
                    tick: typeof dp.tick === "number" ? dp.tick : 0,
                };

                Object.keys(dp).forEach((key) => {
                    if (key === "tick") return;

                    const val = typeof dp[key] === "number" ? dp[key] : 0;
                    const rate = (val as number) || 0;

                    // Add the emission for this period (rate * resolution)
                    // Resolution is already accounted for in the rate from the API
                    cumulative[key] = (cumulative[key] ?? 0) + rate;

                    result[key] = cumulative[key];
                });

                cumulativeData.push(result);
            }

            processedData = cumulativeData;
        }

        // Apply percent transformation if needed
        if (viewMode === "percent") {
            return processedData.map((dataPoint) => {
                const dp = dataPoint as Record<string, unknown>;
                const result: Record<string, unknown> = {
                    tick: typeof dp.tick === "number" ? dp.tick : 0,
                };

                // Calculate total for this datapoint (absolute values)
                let total = 0;
                Object.keys(dp).forEach((key) => {
                    if (key !== "tick") {
                        const val = typeof dp[key] === "number" ? dp[key] : 0;
                        total += Math.abs((val as number) || 0);
                    }
                });

                Object.keys(dp).forEach((key) => {
                    if (key === "tick") return;

                    const val = typeof dp[key] === "number" ? dp[key] : 0;
                    const value = (val as number) || 0;
                    if (total > 0) {
                        // Calculate percentage, preserving sign
                        result[key] =
                            (Math.abs(value) / total) * 100 * Math.sign(value);
                    } else {
                        result[key] = 0;
                    }
                });

                return result;
            });
        }

        return processedData;
    }, [chartData, viewMode, cumulativeMode]);

    const formatValue = useCallback(
        (value: number): string => {
            if (viewMode === "percent") {
                return `${value.toFixed(1)}%`;
            }
            return formatEmissions(value);
        },
        [viewMode],
    );

    const chartConfig: EChartsTimeSeriesConfig = useMemo(
        () => ({
            chartType: "emissions",
            chartVariant: "area",
            stacked: true,
            height: 400,
            getColor,
            filterDataKeys,
            formatValue,
            formatYAxis:
                viewMode === "percent"
                    ? (v: number) => `${v.toFixed(0)}%`
                    : (v: number) => formatEmissions(v),
            yAxisMax: viewMode === "percent" ? 100 : undefined,
        }),
        [getColor, filterDataKeys, formatValue, viewMode],
    );

    return (
        <EChartsTimeSeries
            data={transformedData}
            config={chartConfig}
            isLoading={isLoading}
            isError={isError}
        />
    );
}

interface EmissionsOverviewTableProps {
    /** Chart data with time series for each emissions source */
    chartData: Array<Record<string, number>>;
    /** Resolution in ticks per datapoint */
    resolution: number;
    /** Set of hidden emissions sources */
    hiddenSources: Set<string>;
    /** Callback when a source visibility is toggled */
    onToggleSource: (sourceType: string) => void;
}

interface SourceRow {
    sourceType: string;
    totalEmissions: number;
}

type SortKey = "source" | "emissions";
type SortDirection = "asc" | "desc";

/** Format mass (kg) for display with appropriate units. */
function formatMass(kg: number): string {
    const absKg = Math.abs(kg);
    if (absKg >= 1e12) {
        return `${(kg / 1e12).toFixed(2)} Tt`;
    } else if (absKg >= 1e9) {
        return `${(kg / 1e9).toFixed(2)} Gt`;
    } else if (absKg >= 1e6) {
        return `${(kg / 1e6).toFixed(2)} Mt`;
    } else if (absKg >= 1e3) {
        return `${(kg / 1e3).toFixed(2)} t`;
    } else {
        return `${kg.toFixed(2)} kg`;
    }
}

/** Emissions overview table showing aggregated CO2 emissions by source. */
export function EmissionsOverviewTable({
    chartData,
    resolution,
    hiddenSources,
    onToggleSource,
}: EmissionsOverviewTableProps) {
    const [sortKey, setSortKey] = useState<SortKey>("emissions");
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

    // Check if all sources are hidden
    const allHidden = useMemo(() => {
        if (chartData.length === 0) return false;
        const sourceTypes = new Set<string>();
        chartData.forEach((dataPoint) => {
            Object.keys(dataPoint).forEach((key) => {
                if (key !== "tick") {
                    sourceTypes.add(key);
                }
            });
        });
        return (
            sourceTypes.size > 0 &&
            Array.from(sourceTypes).every((type) => hiddenSources.has(type))
        );
    }, [chartData, hiddenSources]);

    const handleToggleAll = () => {
        if (chartData.length === 0) return;
        const sourceTypes = new Set<string>();
        chartData.forEach((dataPoint) => {
            Object.keys(dataPoint).forEach((key) => {
                if (key !== "tick") {
                    sourceTypes.add(key);
                }
            });
        });

        // If all are hidden, show all. Otherwise, hide all.
        sourceTypes.forEach((type) => {
            onToggleSource(type);
        });
    };

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection(sortDirection === "asc" ? "desc" : "asc");
        } else {
            setSortKey(key);
            setSortDirection("desc");
        }
    };

    // Aggregate emissions data
    const rows = useMemo<SourceRow[]>(() => {
        if (chartData.length === 0) return [];

        // Calculate total emissions for each source
        const totals = new Map<string, number>();

        chartData.forEach((dataPoint) => {
            Object.entries(dataPoint).forEach(([key, value]) => {
                if (key === "tick") return;

                const currentTotal = totals.get(key) || 0;
                // Multiply by resolution to get total emissions over the period
                totals.set(key, currentTotal + (value as number) * resolution);
            });
        });

        // Convert to array and filter out zero emissions
        return Array.from(totals.entries())
            .map(([sourceType, totalEmissions]) => ({
                sourceType,
                totalEmissions,
            }))
            .filter((row) => Math.abs(row.totalEmissions) > 0.01);
    }, [chartData, resolution]);

    // Sort rows
    const sortedRows = useMemo(() => {
        const sorted = [...rows];
        sorted.sort((a, b) => {
            let compareA: string | number;
            let compareB: string | number;

            if (sortKey === "source") {
                compareA = a.sourceType;
                compareB = b.sourceType;
            } else {
                compareA = Math.abs(a.totalEmissions);
                compareB = Math.abs(b.totalEmissions);
            }

            let comparison = 0;
            if (typeof compareA === "string" && typeof compareB === "string") {
                comparison = compareA.localeCompare(compareB);
            } else {
                comparison = (compareA as number) - (compareB as number);
            }

            return sortDirection === "asc" ? comparison : -comparison;
        });

        return sorted;
    }, [rows, sortKey, sortDirection]);

    const getSortIcon = (key: SortKey) => {
        if (sortKey !== key) return null;
        return sortDirection === "asc" ? "↑" : "↓";
    };

    if (chartData.length === 0) {
        return (
            <div className="text-center text-gray-500 py-4">
                No emissions data available
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse">
                <thead>
                    <tr className="border-b-2 border-gray-300">
                        <th
                            className="text-left py-2 px-4 cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort("source")}
                        >
                            Source {getSortIcon("source")}
                        </th>
                        <th
                            className="text-right py-2 px-4 cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort("emissions")}
                        >
                            CO₂ Emissions {getSortIcon("emissions")}
                        </th>
                        <th className="text-center py-2 px-4 w-32">
                            <button
                                onClick={handleToggleAll}
                                className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded transition-colors"
                            >
                                {allHidden ? "Show All" : "Hide All"}
                            </button>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {sortedRows.map((row) => (
                        <tr
                            key={row.sourceType}
                            className="border-b border-gray-200 hover:bg-gray-50"
                        >
                            <td className="py-2 px-4">
                                <div className="flex items-center gap-2">
                                    <AssetIcon
                                        size={20}
                                        assetId={row.sourceType}
                                    />
                                    <AssetName assetId={row.sourceType} />
                                </div>
                            </td>
                            <td className="py-2 px-4 text-right font-mono">
                                {formatMass(row.totalEmissions)}
                            </td>
                            <td className="py-2 px-4 text-center">
                                <Label className="inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={
                                            !hiddenSources.has(row.sourceType)
                                        }
                                        onChange={() =>
                                            onToggleSource(row.sourceType)
                                        }
                                        className="w-4 h-4 text-blue-600"
                                    />
                                </Label>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
