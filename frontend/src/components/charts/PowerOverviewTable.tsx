/**
 * Power overview table component that displays aggregated generation or
 * consumption data by facility type.
 *
 * Shows total energy generated/consumed over the selected period, installed
 * capacity, and used capacity for generation view.
 */

import { useMemo, useState } from "react";

import { FacilityName } from "@/components/ui/AssetName";
import { FacilityGauge } from "@/components/ui/FacilityGauge";
import { useFacilities } from "@/hooks/useFacilities";
import { useGameEngine } from "@/hooks/useGame";
import { formatEnergy, formatPower } from "@/lib/format-utils";
import type { ChartType } from "@/types/charts";

interface PowerOverviewTableProps {
    /** Chart type determining if we show generation or consumption table */
    chartType: ChartType;
    /** Chart data with time series for each facility type */
    chartData: Array<Record<string, number>>;
    /** Resolution in ticks per datapoint */
    resolution: number;
    /** Set of hidden facility types */
    hiddenFacilities: Set<string>;
    /** Callback when a facility visibility is toggled */
    onToggleFacility: (facilityType: string) => void;
}

interface FacilityRow {
    facilityType: string;
    totalEnergy: number;
    installedCapacity?: number;
    usedCapacity?: number;
}

type SortKey = "facility" | "energy" | "capacity" | "used";
type SortDirection = "asc" | "desc";

/**
 * Power overview table showing aggregated generation or consumption data.
 *
 * For generation mode:
 *
 * - Facility name
 * - Total generated energy over the period
 * - Installed capacity
 * - Used capacity (percentage)
 *
 * For consumption mode:
 *
 * - Facility name
 * - Total consumed energy over the period
 */
export function PowerOverviewTable({
    chartType,
    chartData,
    resolution,
    hiddenFacilities,
    onToggleFacility,
}: PowerOverviewTableProps) {
    const [sortKey, setSortKey] = useState<SortKey>("energy");
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

    const { data: facilitiesData } = useFacilities();
    const { data: gameEngine } = useGameEngine();
    const isGeneration = chartType === "power-sources";

    // Check if all facilities are hidden
    const allHidden = useMemo(() => {
        if (!chartData || chartData.length === 0) return false;
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
        if (!chartData || chartData.length === 0) return;
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
        if (!chartData || chartData.length === 0) return [];
        if (!gameEngine) return [];

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
                // Sum all power values and multiply by resolution to get total energy
                const totalEnergy = chartData.reduce((sum, dataPoint) => {
                    const power = dataPoint[facilityType] || 0;
                    // Energy = Power × Time
                    // resolution is ticks per datapoint, game_seconds_per_tick is game seconds per tick
                    // Energy (Wh) = Power (W) × Time (hours)
                    const timeInHours =
                        (resolution * gameEngine.game_seconds_per_tick) / 3600;
                    return sum + power * timeInHours;
                }, 0);

                const row: FacilityRow = {
                    facilityType,
                    totalEnergy,
                };

                // For generation view, calculate installed capacity and usage
                if (isGeneration && facilitiesData) {
                    const facilities = facilitiesData.power_facilities.filter(
                        (f) => f.facility === facilityType,
                    );

                    if (facilities.length > 0) {
                        const installedCapacity = facilities.reduce(
                            (sum, f) => sum + f.max_power_generation,
                            0,
                        );
                        row.installedCapacity = installedCapacity;

                        // Calculate used capacity as percentage
                        // Average power over the period / installed capacity
                        const timeInHours =
                            (resolution * gameEngine.game_seconds_per_tick) /
                            3600;
                        const avgPower =
                            totalEnergy / (chartData.length * timeInHours);
                        row.usedCapacity =
                            installedCapacity > 0
                                ? (avgPower / installedCapacity) * 100
                                : 0;
                    }
                }

                return row;
            },
        );

        // Filter out rows with zero energy
        return rows.filter((row) => row.totalEnergy > 0);
    }, [chartData, resolution, isGeneration, facilitiesData, gameEngine]);

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
                case "energy":
                    aVal = a.totalEnergy;
                    bVal = b.totalEnergy;
                    break;
                case "capacity":
                    aVal = a.installedCapacity ?? 0;
                    bVal = b.installedCapacity ?? 0;
                    break;
                case "used":
                    aVal = a.usedCapacity ?? 0;
                    bVal = b.usedCapacity ?? 0;
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
                No data available for this period
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-tan-green dark:bg-dark-bg-tertiary">
                        <th
                            className="py-3 px-4 text-left font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
                            onClick={() => handleSort("facility")}
                        >
                            Facility{getSortIndicator("facility")}
                        </th>
                        <th
                            className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
                            onClick={() => handleSort("energy")}
                        >
                            {isGeneration ? "Generated" : "Consumed"}
                            {getSortIndicator("energy")}
                        </th>
                        {isGeneration && (
                            <>
                                <th
                                    className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
                                    onClick={() => handleSort("capacity")}
                                >
                                    Installed Cap.
                                    {getSortIndicator("capacity")}
                                </th>
                                <th
                                    className="py-3 px-4 text-center font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors min-w-37.5"
                                    onClick={() => handleSort("used")}
                                >
                                    Used Capacity
                                    {getSortIndicator("used")}
                                </th>
                            </>
                        )}
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
                        const isVisible = !hiddenFacilities.has(
                            row.facilityType,
                        );
                        return (
                            <tr
                                key={row.facilityType}
                                className="border-b border-pine/10 dark:border-dark-border/30 hover:bg-tan-green/20 dark:hover:bg-dark-bg-tertiary/30 transition-colors"
                            >
                                <td className="py-3 px-4">
                                    <FacilityName
                                        facility={row.facilityType}
                                        mode="long"
                                    />
                                </td>
                                <td className="py-3 px-4 text-right font-mono">
                                    {formatEnergy(row.totalEnergy)}
                                </td>
                                {isGeneration && (
                                    <>
                                        <td className="py-3 px-4 text-right font-mono">
                                            {row.installedCapacity !== undefined
                                                ? formatPower(
                                                      row.installedCapacity,
                                                  )
                                                : "-"}
                                        </td>
                                        <td className="py-3 px-4 text-center min-w-37.5">
                                            {row.usedCapacity !== undefined ? (
                                                <FacilityGauge
                                                    facilityType={
                                                        row.facilityType
                                                    }
                                                    value={row.usedCapacity}
                                                />
                                            ) : (
                                                <span className="text-center block">
                                                    -
                                                </span>
                                            )}
                                        </td>
                                    </>
                                )}
                                <td className="py-3 px-4 text-center">
                                    <button
                                        onClick={() =>
                                            onToggleFacility(row.facilityType)
                                        }
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
