/**
 * The persistent world's power overview table: each facility type's energy over
 * the chart's time range, with its installed capacity and capacity factor for
 * generation. It sits below the power chart.
 */

import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { FacilityIcon } from "@/components/ui/asset-icon";
import { FacilityName } from "@/components/ui/asset-name";
import { useFacilities } from "@/hooks/use-facilities";
import { useGameEngine } from "@/hooks/use-game";
import type { ChartType } from "@/types/charts";
import { formatEnergy, formatPower } from "@energetica/core/format-utils";
import { FacilityGauge } from "@energetica/ui/components/facility-gauge";
import { MagnitudeBar } from "@energetica/ui/components/magnitude-bar";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@energetica/ui/components/tooltip";
import { useAssetColorGetter } from "@energetica/ui/hooks/use-asset-color-getter";

interface PowerOverviewTableProps {
    chartType: ChartType;
    chartData: Array<Record<string, number>>;
    resolution: number;
    hiddenFacilities: Set<string>;
    onToggleFacility: (facilityType: string) => void;
    /**
     * Called with a row's series key when the player hovers the row, and with
     * null when the pointer leaves the table.
     */
    onHoverRow?: (key: string | null) => void;
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
    onHoverRow,
}: PowerOverviewTableProps) {
    const [sortKey, setSortKey] = useState<SortKey>("energy");
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

    const { data: facilitiesData } = useFacilities();
    const { data: gameEngine } = useGameEngine();
    const getColor = useAssetColorGetter();
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
                    const facilities = [
                        ...facilitiesData.power_facilities,
                        ...facilitiesData.storage_facilities,
                    ].filter((f) => f.facility === facilityType);
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

    // Largest total normalises the consumption magnitude bars. Generation
    // rows keep the plain number — their capacity-factor gauge already carries
    // the color, and two bars per row would be noise.
    const maxEnergy = useMemo(
        () => facilityRows.reduce((m, row) => Math.max(m, row.totalEnergy), 0),
        [facilityRows],
    );

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
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span className="underline decoration-dotted cursor-help">
                                                Capacity Factor
                                            </span>
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-52 text-center leading-snug">
                                            Average power output over the
                                            displayed time range divided by
                                            installed capacity.{" "}
                                            <Link
                                                to="/app/wiki/$slug"
                                                params={{
                                                    slug: "power-facilities",
                                                }}
                                                className="underline hover:opacity-80"
                                            >
                                                Learn more
                                            </Link>
                                        </TooltipContent>
                                    </Tooltip>
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
                <tbody onMouseLeave={() => onHoverRow?.(null)}>
                    {sortedRows.map((row) => {
                        const isVisible = !hiddenFacilities.has(
                            row.facilityType,
                        );
                        return (
                            <tr
                                key={row.facilityType}
                                onMouseEnter={() =>
                                    onHoverRow?.(row.facilityType)
                                }
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
                                <td className="py-3 px-4">
                                    {isGeneration ? (
                                        <span className="block text-right font-mono">
                                            {formatEnergy(row.totalEnergy)}
                                        </span>
                                    ) : (
                                        <MagnitudeBar
                                            value={row.totalEnergy}
                                            max={maxEnergy}
                                            color={getColor(row.facilityType)}
                                            label={formatEnergy(
                                                row.totalEnergy,
                                            )}
                                            dimmed={!isVisible}
                                        />
                                    )}
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
