/**
 * Power chart: stacked bar chart of facility production per tick.
 *
 * This is a thin wrapper around EChartsTimeSeries that handles the
 * power-chart-specific concerns:
 *  - Deriving visible keys from the canonical facility order (hidden + zero filtering)
 *  - Percent-mode normalization of the data
 *  - Facility icon + name labels in the tooltip
 */

import { useMemo, useState } from "react";

import {
    EChartsTimeSeries,
    type EChartsTimeSeriesConfig,
} from "@/components/charts/echarts-time-series";
import { FacilityIcon } from "@/components/ui/asset-icon";
import { FacilityName } from "@/components/ui/asset-name";
import { FacilityGauge } from "@/components/ui/facility-gauge";
import { useAssetColorGetter } from "@/hooks/use-asset-color-getter";
import { useFacilities } from "@/hooks/use-facilities";
import { useGameEngine } from "@/hooks/use-game";
import { KEY_ORDER_BY_CHART_TYPE } from "@/lib/charts/key-order";
import { formatEnergy, formatPower } from "@/lib/format-utils";
import type { ChartType } from "@/types/charts";

export type PowerChartViewMode = "absolute" | "percent";

interface PowerChartProps {
    chartType: ChartType;
    chartData: Array<Record<string, unknown>>;
    isLoading: boolean;
    isError: boolean;
    hiddenFacilities: Set<string>;
    viewMode: PowerChartViewMode;
}

// Stable label renderer — defined outside the component so it never causes
// unnecessary config re-memos.
function formatLabel(key: string) {
    return (
        <div className="flex items-center gap-1">
            <FacilityIcon facility={key} size={14} />
            <FacilityName facility={key} mode="long" />
        </div>
    );
}

export function PowerChart({
    chartType,
    chartData,
    isLoading,
    isError,
    hiddenFacilities,
    viewMode,
}: PowerChartProps) {
    const getColor = useAssetColorGetter();

    // Derive visible keys in canonical stack order, excluding hidden facilities
    // and series that are all-zero across the entire data set.
    const visibleKeys = useMemo(() => {
        if (!chartData.length) return [];
        const keyOrder = KEY_ORDER_BY_CHART_TYPE[chartType] as readonly string[];
        return keyOrder.filter(
            (key) =>
                !hiddenFacilities.has(key) &&
                chartData.some((d) => Number(d[key] ?? 0) > 0),
        );
    }, [chartData, chartType, hiddenFacilities]);

    // Build display data containing only visible keys, optionally normalized
    // to percentages. Pre-filtering here means EChartsTimeSeries sees exactly
    // the series it should render — no filterDataKeys needed.
    const displayData = useMemo(() => {
        return chartData.map((dataPoint) => {
            const total =
                viewMode === "percent"
                    ? visibleKeys.reduce(
                          (s, k) => s + Number(dataPoint[k] ?? 0),
                          0,
                      )
                    : 0;
            const row: Record<string, unknown> = { tick: dataPoint.tick };
            for (const k of visibleKeys) {
                const v = Number(dataPoint[k] ?? 0);
                row[k] =
                    viewMode === "percent" && total > 0
                        ? (v / total) * 100
                        : v;
            }
            return row;
        });
    }, [chartData, visibleKeys, viewMode]);

    const config = useMemo(
        (): EChartsTimeSeriesConfig => ({
            chartType,
            chartVariant: "area",
            stacked: true,
            getColor,
            formatLabel,
            formatValue: (v) =>
                viewMode === "percent"
                    ? `${v.toFixed(1)}%`
                    : formatPower(v),
            formatYAxis:
                viewMode === "percent"
                    ? (v: number) => `${v.toFixed(0)}%`
                    : formatPower,
            yAxisMin: 0,
            yAxisMax: viewMode === "percent" ? 100 : undefined,
            hideZeroValues: true,
        }),
        [chartType, getColor, viewMode],
    );

    return (
        <EChartsTimeSeries
            data={displayData}
            config={config}
            isLoading={isLoading}
            isError={isError}
        />
    );
}

// ── PowerOverviewTable ────────────────────────────────────────────────────────

interface PowerOverviewTableProps {
    chartType: ChartType;
    chartData: Array<Record<string, number>>;
    resolution: number;
    hiddenFacilities: Set<string>;
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

    const allHidden = useMemo(() => {
        if (chartData.length === 0) return false;
        const facilityTypes = new Set<string>();
        chartData.forEach((dataPoint) => {
            Object.keys(dataPoint).forEach((key) => {
                if (key !== "tick") facilityTypes.add(key);
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
                if (key !== "tick") facilityTypes.add(key);
            });
        });
        if (allHidden) {
            facilityTypes.forEach((type) => {
                if (hiddenFacilities.has(type)) onToggleFacility(type);
            });
        } else {
            facilityTypes.forEach((type) => {
                if (!hiddenFacilities.has(type)) onToggleFacility(type);
            });
        }
    };

    const facilityRows = useMemo(() => {
        if (chartData.length === 0 || !gameEngine) return [];
        const facilityTypes = new Set<string>();
        chartData.forEach((dataPoint) => {
            Object.keys(dataPoint).forEach((key) => {
                if (key !== "tick") facilityTypes.add(key);
            });
        });

        const rows: FacilityRow[] = Array.from(facilityTypes).map(
            (facilityType) => {
                const timeInHours =
                    (resolution * gameEngine.game_seconds_per_tick) / 3600;
                const totalEnergy = chartData.reduce((sum, dataPoint) => {
                    return sum + (dataPoint[facilityType] ?? 0) * timeInHours;
                }, 0);

                const row: FacilityRow = { facilityType, totalEnergy };

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
        return rows.filter((row) => row.totalEnergy > 0);
    }, [chartData, resolution, isGeneration, facilitiesData, gameEngine]);

    const sortedRows = useMemo(() => {
        return [...facilityRows].sort((a, b) => {
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
    }, [facilityRows, sortKey, sortDirection]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
        } else {
            setSortKey(key);
            setSortDirection("desc");
        }
    };

    const getSortIndicator = (key: SortKey) =>
        sortKey === key ? (sortDirection === "asc" ? " ▲" : " ▼") : null;

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
                            onClick={() => handleSort("energy")}
                        >
                            {isGeneration ? "Generated" : "Consumed"}
                            {getSortIndicator("energy")}
                        </th>
                        {isGeneration && (
                            <>
                                <th
                                    className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                                    onClick={() => handleSort("capacity")}
                                >
                                    Installed Cap.
                                    {getSortIndicator("capacity")}
                                </th>
                                <th
                                    className="py-3 px-4 text-center font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors min-w-37.5"
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
