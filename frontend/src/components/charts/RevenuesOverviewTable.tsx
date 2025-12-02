/**
 * Revenues overview table component that displays aggregated revenue data by
 * facility type.
 *
 * Shows total revenues over the selected period for each facility type.
 */

import { useMemo, useState } from "react";
import { FacilityName } from "@components/ui/AssetName";
import { Money } from "@components/ui/Money";

type RevenueType = "revenues" | "expenses" | "all";

interface RevenuesOverviewTableProps {
    /** Chart data with time series for each facility type */
    chartData: Array<Record<string, number>>;
    /** Type of revenue to display */
    revenueType: RevenueType;
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

/**
 * Revenues overview table showing aggregated revenue data by facility type.
 *
 * - Facility name
 * - Total revenues over the period
 */
export function RevenuesOverviewTable({
    chartData,
    revenueType,
    hiddenFacilities,
    onToggleFacility,
}: RevenuesOverviewTableProps) {
    const [sortKey, setSortKey] = useState<SortKey>("revenues");
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

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
                    <tr className="bg-tan-green dark:bg-dark-bg-tertiary">
                        <th
                            className="py-3 px-4 text-left font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
                            onClick={() => handleSort("facility")}
                        >
                            Facility{getSortIndicator("facility")}
                        </th>
                        <th
                            className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
                            onClick={() => handleSort("revenues")}
                        >
                            {getColumnLabel()}
                            {getSortIndicator("revenues")}
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
                                    <Money amount={row.totalRevenues} />
                                </td>
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
