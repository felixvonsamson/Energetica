import { useCallback, useMemo, useState } from "react";

import {
    EChartsTimeSeries,
    EChartsTimeSeriesConfig,
} from "@/components/charts/echarts-time-series";
import { FacilityIcon } from "@/components/ui/asset-icon";
import { FacilityName } from "@/components/ui/asset-name";
import { CashFlow } from "@/components/ui/cash-flow";
import { Money } from "@/components/ui/money";
import { useTimeMode } from "@/contexts/time-mode-context";
import { useAssetColorGetter } from "@/hooks/use-asset-color-getter";
import { useChartFilters } from "@/hooks/use-chart-filters";
import { useGameEngine } from "@/hooks/use-game";
import { formatCashFlow } from "@/lib/format-utils";

export type CashFlowType = "revenues" | "expenses" | "net-profit";
export type NetProfitViewMode = "net" | "breakdown";

interface CashFlowChartProps {
    chartData: Array<Record<string, unknown>>;
    isLoading: boolean;
    isError: boolean;
    hiddenFacilities: Set<string>;
    viewMode: "normal" | "percent";
    revenueType: CashFlowType;
    netProfitViewMode: NetProfitViewMode;
}

export function CashFlowChart({
    chartData,
    isLoading,
    isError,
    hiddenFacilities,
    viewMode,
    revenueType,
    netProfitViewMode,
}: CashFlowChartProps) {
    const { data: gameEngineConfig } = useGameEngine();
    const { mode: timeMode } = useTimeMode();
    const getColor = useAssetColorGetter();

    // Custom color getter for breakdown mode
    const getBreakdownColor = useCallback((key: string) => {
        if (key === "baseline") return "hsl(var(--muted-foreground) / 0.5)";
        if (key === "profit") return "var(--success)";
        if (key === "loss") return "var(--destructive)";
        return "var(--foreground)";
    }, []);

    // Create filters - don't filter non-zero for net-profit view
    const filterDataKeys = useChartFilters(
        hiddenFacilities,
        revenueType !== "net-profit",
    );

    // Transform data for percent view if needed
    const transformedData: Array<Record<string, unknown>> = useMemo(() => {
        if (
            viewMode === "normal" ||
            revenueType === "net-profit" ||
            chartData.length === 0
        ) {
            return chartData;
        }

        // For percent view, calculate percentage based on total
        return chartData.map((dataPoint) => {
            const dp = dataPoint as Record<string, unknown>;
            const result: Record<string, unknown> = {
                tick: typeof dp.tick === "number" ? dp.tick : 0,
            };

            // Calculate total for this datapoint
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
                    // Preserve sign in percent view
                    result[key] = (value / total) * 100;
                } else {
                    result[key] = 0;
                }
            });

            return result;
        });
    }, [chartData, viewMode, revenueType]);

    const isShowingPercent =
        viewMode === "percent" && revenueType !== "net-profit";

    const formatValue = useCallback(
        (value: number) =>
            isShowingPercent ? (
                `${value.toFixed(1)}%`
            ) : (
                <CashFlow amountPerTick={value} />
            ),
        [isShowingPercent],
    );

    const chartConfig: EChartsTimeSeriesConfig | undefined = useMemo(() => {
        if (!gameEngineConfig) return undefined;

        const isBreakdownMode =
            revenueType === "net-profit" && netProfitViewMode === "breakdown";
        const isNetMode =
            revenueType === "net-profit" && netProfitViewMode === "net";

        // Determine chartType based on revenue type for proper key ordering
        const chartType =
            revenueType === "revenues"
                ? "revenues"
                : revenueType === "expenses"
                  ? "op-costs"
                  : undefined; // net-profit uses synthetic keys

        return {
            chartType,
            chartVariant: "area",
            stacked: true,
            getColor: isBreakdownMode ? getBreakdownColor : getColor,
            filterDataKeys,
            formatValue,
            formatYAxis: (value: number) =>
                isShowingPercent
                    ? `${value}%`
                    : formatCashFlow(value, "h", gameEngineConfig, timeMode).replace("$", ""),
            // Use gradient fill for the "net-profit" series only in net mode
            gradientKeys: isNetMode ? ["net-profit"] : [],
        };
    }, [
        gameEngineConfig,
        revenueType,
        netProfitViewMode,
        getBreakdownColor,
        getColor,
        filterDataKeys,
        formatValue,
        isShowingPercent,
        timeMode,
    ]);

    if (!chartConfig) return <></>;

    return (
        <EChartsTimeSeries
            data={transformedData}
            config={chartConfig}
            isLoading={isLoading}
            isError={isError}
        />
    );
}

interface CashFlowOverviewTableProps {
    /** Chart data with time series for each facility type */
    chartData: Array<Record<string, number>>;
    /** Type of revenue to display */
    revenueType: CashFlowType;
    /** Set of hidden facility types */
    hiddenFacilities: Set<string>;
    /** Callback when a facility visibility is toggled */
    onToggleFacility: (facilityType: string) => void;
}
interface FacilityRow {
    facilityType: string;
    totalRevenues: number;
}
type SortKey = "facility" | "revenues";
type SortDirection = "asc" | "desc";
/** Cash flow overview table */

export function CashFlowOverviewTable({
    chartData,
    revenueType,
    hiddenFacilities,
    onToggleFacility,
}: CashFlowOverviewTableProps) {
    const [sortKey, setSortKey] = useState<SortKey>("revenues");
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

    // Check if all facilities are hidden
    const allHidden = useMemo(() => {
        if (chartData.length === 0) return false;
        const facilityTypes = new Set<string>();
        chartData.forEach((dataPoint) => {
            Object.keys(dataPoint).forEach((key) => {
                if (key !== "tick") {
                    facilityTypes.add(key);
                }
            });
        });
        return (
            facilityTypes.size > 0 &&
            Array.from(facilityTypes).every((type) =>
                hiddenFacilities.has(type),
            )
        );
    }, [chartData, hiddenFacilities]);

    const handleToggleAll = () => {
        if (chartData.length === 0) return;
        const facilityTypes = new Set<string>();
        chartData.forEach((dataPoint) => {
            Object.keys(dataPoint).forEach((key) => {
                if (key !== "tick") {
                    facilityTypes.add(key);
                }
            });
        });

        // If all are hidden, show all. Otherwise, hide all.
        if (allHidden) {
            // Show all - remove all from hidden set
            facilityTypes.forEach((type) => {
                if (hiddenFacilities.has(type)) {
                    onToggleFacility(type);
                }
            });
        } else {
            // Hide all - add all to hidden set
            facilityTypes.forEach((type) => {
                if (!hiddenFacilities.has(type)) {
                    onToggleFacility(type);
                }
            });
        }
    };

    // Calculate aggregated data for each facility type
    const facilityRows = useMemo(() => {
        if (chartData.length === 0) return [];

        // Get all facility types from the chart data
        const facilityTypes = new Set<string>();
        chartData.forEach((dataPoint) => {
            Object.keys(dataPoint).forEach((key) => {
                if (key !== "tick") {
                    facilityTypes.add(key);
                }
            });
        });

        // Calculate totals for each facility type
        const rows: FacilityRow[] = Array.from(facilityTypes)
            .map((facilityType) => {
                // Sum all revenue values
                const totalRevenues = chartData.reduce((sum, dataPoint) => {
                    return sum + (dataPoint[facilityType] || 0);
                }, 0);

                return {
                    facilityType,
                    totalRevenues,
                };
            })
            // Filter out rows with zero revenues
            .filter((row) => row.totalRevenues > 0);

        return rows;
    }, [chartData]);

    // Sort facility rows
    const sortedRows = useMemo(() => {
        const sorted = [...facilityRows];
        sorted.sort((a, b) => {
            let aVal: number | string;
            let bVal: number | string;

            switch (sortKey) {
                case "facility":
                    aVal = a.facilityType;
                    bVal = b.facilityType;
                    break;
                case "revenues":
                    aVal = a.totalRevenues;
                    bVal = b.totalRevenues;
                    break;
                default:
                    return 0;
            }

            if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
            if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
            return 0;
        });

        return sorted;
    }, [facilityRows, sortKey, sortDirection]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            // Toggle direction
            setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
        } else {
            setSortKey(key);
            setSortDirection("desc");
        }
    };

    const getSortIndicator = (key: SortKey) => {
        if (sortKey !== key) return null;
        return sortDirection === "asc" ? " ▲" : " ▼";
    };

    const getColumnLabel = () => {
        if (revenueType === "revenues") return "Revenues";
        if (revenueType === "expenses") return "Expenses";
        return "Amount";
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
                            onClick={() => handleSort("facility")}
                        >
                            Facility{getSortIndicator("facility")}
                        </th>
                        <th
                            className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                            onClick={() => handleSort("revenues")}
                        >
                            {getColumnLabel()}
                            {getSortIndicator("revenues")}
                        </th>
                        <th className="py-3 px-4 text-center font-semibold">
                            <button
                                onClick={handleToggleAll}
                                className="px-3 py-1 text-xs font-semibold bg-brand hover:bg-brand/80 text-white rounded transition-colors"
                            >
                                {allHidden ? "Show All" : "Hide All"}
                            </button>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {sortedRows.map((row) => {
                        const isVisible = !hiddenFacilities.has(
                            row.facilityType,
                        );
                        return (
                            <tr
                                key={row.facilityType}
                                className="border-b border-border/30 hover:bg-tan-green/20 dark:hover:bg-muted/30 transition-colors"
                            >
                                <td className="py-3 px-4">
                                    <div className="flex items-center gap-2">
                                        <FacilityIcon
                                            facility={row.facilityType}
                                            size={20}
                                        />
                                        <FacilityName
                                            facility={row.facilityType}
                                            mode="long"
                                        />
                                    </div>
                                </td>
                                <td className="py-3 px-4 text-right font-mono">
                                    <Money amount={row.totalRevenues} />
                                </td>
                                <td className="py-3 px-4 text-center">
                                    <button
                                        onClick={() =>
                                            onToggleFacility(row.facilityType)
                                        }
                                        className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                                            isVisible
                                                ? "bg-brand hover:bg-brand/80 text-white"
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
