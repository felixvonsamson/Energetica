import { useMemo, useState } from "react";
/**
 * Storage overview table component that displays aggregated storage data by
 * facility type.
 *
 * Shows cumulative charging/discharging, max storage capacity, and current
 * state of charge for each storage facility type.
 */

import {
    EChartsTimeSeries,
    EChartsTimeSeriesConfig,
} from "@/components/charts/echarts-time-series";
import { FacilityIcon } from "@/components/ui/asset-icon";
import { FacilityName } from "@/components/ui/asset-name";
import { FacilityGauge } from "@/components/ui/facility-gauge";
import { useAssetColorGetter } from "@/hooks/use-asset-color-getter";
import { useChartFilters } from "@/hooks/use-chart-filters";
import { useFacilities } from "@/hooks/use-facilities";
import { formatEnergy } from "@/lib/format-utils";

interface StorageChartProps {
    chartData: Array<Record<string, unknown>>;
    isLoading: boolean;
    isError: boolean;
    hiddenFacilities: Set<string>;
    viewMode: "normal" | "percent";
}

export function StorageChart({
    chartData,
    isLoading,
    isError,
    hiddenFacilities,
    viewMode,
}: StorageChartProps) {
    const getColor = useAssetColorGetter();
    const filterDataKeys = useChartFilters(hiddenFacilities);

    // In percent mode, chartData already contains server-computed SoC (0-1 fraction).
    // Scale to 0-100 for display.
    const displayData: Array<Record<string, unknown>> = useMemo(() => {
        if (viewMode === "normal" || chartData.length === 0) {
            return chartData;
        }
        return chartData.map((dataPoint) => {
            const result: Record<string, unknown> = { tick: dataPoint.tick };
            Object.keys(dataPoint).forEach((key) => {
                if (key === "tick") return;
                const val = dataPoint[key];
                result[key] = typeof val === "number" ? val * 100 : 0;
            });
            return result;
        });
    }, [chartData, viewMode]);

    const chartConfig: EChartsTimeSeriesConfig = useMemo(
        () => ({
            chartType: viewMode === "normal" ? "storage-level" : "storage-soc",
            chartVariant: viewMode === "normal" ? "area" : "smoothLine",
            stacked: viewMode === "normal" ? true : false,
            getColor,
            filterDataKeys,
            formatValue:
                viewMode === "normal"
                    ? formatEnergy
                    : (value: number) => `${value.toFixed(1)}%`,
            formatYAxis: (value: number) =>
                viewMode === "normal" ? formatEnergy(value) : `${value}%`,
        }),
        [viewMode, getColor, filterDataKeys],
    );

    return (
        <EChartsTimeSeries
            data={displayData}
            config={chartConfig}
            isLoading={isLoading}
            isError={isError}
        />
    );
}

interface StorageOverviewTableProps {
    /** Chart data with time series for each facility type */
    chartData: Array<Record<string, number>>;
    /** Set of hidden facility types */
    hiddenFacilities: Set<string>;
    /** Callback when a facility visibility is toggled */
    onToggleFacility: (facilityType: string) => void;
}

interface FacilityRow {
    facilityType: string;
    cumulCharging: number;
    cumulDischarging: number;
    maxCapacity: number;
    currentLevel: number;
    stateOfCharge: number;
}

type SortKey =
    | "facility"
    | "charging"
    | "discharging"
    | "capacity"
    | "level"
    | "soc";
type SortDirection = "asc" | "desc";

/**
 * Storage overview table showing aggregated storage data.
 *
 * - Facility name
 * - Cumulative charging over the period
 * - Cumulative discharging over the period
 * - Max storage capacity
 * - State of charge (percentage and gauge)
 */
export function StorageOverviewTable({
    chartData,
    hiddenFacilities,
    onToggleFacility,
}: StorageOverviewTableProps) {
    const [sortKey, setSortKey] = useState<SortKey>("charging");
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

    const { data: facilitiesData } = useFacilities();

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
        if (!facilitiesData) return [];

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
        const rows: FacilityRow[] = Array.from(facilityTypes).map(
            (facilityType) => {
                // Calculate cumulative charging and discharging from level changes
                let cumulCharging = 0;
                let cumulDischarging = 0;

                for (let i = 1; i < chartData.length; i++) {
                    const prevLevel = chartData[i - 1]?.[facilityType] ?? 0;
                    const currentLevel = chartData[i]?.[facilityType] ?? 0;
                    const change = currentLevel - prevLevel;

                    if (change > 0) {
                        cumulCharging += change;
                    } else if (change < 0) {
                        cumulDischarging += Math.abs(change);
                    }
                }

                // Get current level (last data point)
                const currentLevel =
                    chartData[chartData.length - 1]?.[facilityType] ?? 0;

                // Get max capacity from facilities data
                const facilities = facilitiesData.storage_facilities.filter(
                    (f) => f.facility === facilityType,
                );

                const maxCapacity =
                    facilities.length > 0
                        ? facilities.reduce(
                              (sum, f) => sum + f.storage_capacity,
                              0,
                          )
                        : 0;

                const stateOfCharge =
                    maxCapacity > 0 ? (currentLevel / maxCapacity) * 100 : 0;

                return {
                    facilityType,
                    cumulCharging,
                    cumulDischarging,
                    maxCapacity,
                    currentLevel,
                    stateOfCharge,
                };
            },
        );

        // Filter out rows with zero capacity
        return rows.filter((row) => row.maxCapacity > 0);
    }, [chartData, facilitiesData]);

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
                case "charging":
                    aVal = a.cumulCharging;
                    bVal = b.cumulCharging;
                    break;
                case "discharging":
                    aVal = a.cumulDischarging;
                    bVal = b.cumulDischarging;
                    break;
                case "capacity":
                    aVal = a.maxCapacity;
                    bVal = b.maxCapacity;
                    break;
                case "level":
                    aVal = a.currentLevel;
                    bVal = b.currentLevel;
                    break;
                case "soc":
                    aVal = a.stateOfCharge;
                    bVal = b.stateOfCharge;
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

    if (sortedRows.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500">
                No storage facilities available
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
                            onClick={() => handleSort("charging")}
                        >
                            Cumul Charging{getSortIndicator("charging")}
                        </th>
                        <th
                            className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                            onClick={() => handleSort("discharging")}
                        >
                            Cumul Discharging{getSortIndicator("discharging")}
                        </th>
                        <th
                            className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                            onClick={() => handleSort("capacity")}
                        >
                            Max Storage{getSortIndicator("capacity")}
                        </th>
                        <th
                            className="py-3 px-4 text-center font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors min-w-37.5"
                            onClick={() => handleSort("soc")}
                        >
                            State of Charge{getSortIndicator("soc")}
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
                                    {formatEnergy(row.cumulCharging)}
                                </td>
                                <td className="py-3 px-4 text-right font-mono">
                                    {formatEnergy(row.cumulDischarging)}
                                </td>
                                <td className="py-3 px-4 text-right font-mono">
                                    {formatEnergy(row.maxCapacity)}
                                </td>
                                <td className="py-3 px-4 text-center min-w-37.5">
                                    <FacilityGauge
                                        facilityType={row.facilityType}
                                        value={row.stateOfCharge}
                                    />
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
