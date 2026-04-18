import { useMemo, useState } from "react";

import {
    EChartsTimeSeries,
    EChartsTimeSeriesConfig,
} from "@/components/charts/echarts-time-series";
import { ResourceIcon } from "@/components/ui/asset-icon";
import { ResourceName } from "@/components/ui/asset-name";
import { FacilityGauge } from "@/components/ui/facility-gauge";
import { useAssetColorGetter } from "@/hooks/use-asset-color-getter";
import { useChartFilters } from "@/hooks/use-chart-filters";
import { usePlayerResources } from "@/hooks/use-player-resources";
import { formatMass } from "@/lib/format-utils";
import { Fuel } from "@/types/fuel";

interface ResourcesChartProps {
    chartData: Array<Record<string, unknown>>;
    isLoading: boolean;
    isError: boolean;
    hiddenResources: Set<string>;
    viewMode: "mass" | "percent";
}

export function ResourcesChart({
    chartData,
    isLoading,
    isError,
    hiddenResources,
    viewMode,
}: ResourcesChartProps) {
    const getColor = useAssetColorGetter();
    const filterDataKeys = useChartFilters(hiddenResources);

    // In percent mode, chartData already contains server-computed SoC (0-1 fraction).
    // Scale to 0-100 for display.
    const displayData: Array<Record<string, unknown>> = useMemo(() => {
        if (viewMode === "mass" || chartData.length === 0) {
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
            chartType: viewMode === "mass" ? "resources" : "resources-soc",
            chartVariant: viewMode === "mass" ? "area" : "smoothLine",
            stacked: false,
            getColor,
            filterDataKeys,
            formatValue:
                viewMode === "mass"
                    ? formatMass
                    : (value: number) => `${value.toFixed(1)}%`,
            formatYAxis: (value: number) =>
                viewMode === "mass" ? formatMass(value) : `${value}%`,
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

interface ResourcesOverviewTableProps {
    chartData: Array<Record<string, number>>;
    hiddenResources: Set<string>;
    onToggleResource: (resource: string) => void;
}

interface ResourceRow {
    resource: string;
    currentStock: number;
    percentFull: number;
}

type SortKey = "resource" | "stock" | "percent";
type SortDirection = "asc" | "desc";

export function ResourcesOverviewTable({
    chartData,
    hiddenResources,
    onToggleResource,
}: ResourcesOverviewTableProps) {
    const [sortKey, setSortKey] = useState<SortKey>("stock");
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
    const { data: resourcesData } = usePlayerResources();

    const allHidden = useMemo(() => {
        if (chartData.length === 0) return false;
        const resourceTypes = new Set<string>();
        chartData.forEach((dataPoint) => {
            Object.keys(dataPoint).forEach((key) => {
                if (key !== "tick") resourceTypes.add(key);
            });
        });
        return (
            resourceTypes.size > 0 &&
            Array.from(resourceTypes).every((type) => hiddenResources.has(type))
        );
    }, [chartData, hiddenResources]);

    const handleToggleAll = () => {
        if (chartData.length === 0) return;
        const resourceTypes = new Set<string>();
        chartData.forEach((dataPoint) => {
            Object.keys(dataPoint).forEach((key) => {
                if (key !== "tick") resourceTypes.add(key);
            });
        });

        if (allHidden) {
            resourceTypes.forEach((type) => {
                if (hiddenResources.has(type)) onToggleResource(type);
            });
        } else {
            resourceTypes.forEach((type) => {
                if (!hiddenResources.has(type)) onToggleResource(type);
            });
        }
    };

    const resourceRows = useMemo(() => {
        if (chartData.length === 0 || !resourcesData) return [];

        const capacities: Record<string, number> = {
            coal: resourcesData.coal.capacity,
            gas: resourcesData.gas.capacity,
            uranium: resourcesData.uranium.capacity,
        };

        const resourceTypes = new Set<string>();
        chartData.forEach((dataPoint) => {
            Object.keys(dataPoint).forEach((key) => {
                if (key !== "tick") resourceTypes.add(key);
            });
        });

        return Array.from(resourceTypes).map((resource): ResourceRow => {
            const currentStock =
                chartData[chartData.length - 1]?.[resource] ?? 0;
            const capacity = capacities[resource] ?? 0;
            const percentFull =
                capacity > 0 ? (currentStock / capacity) * 100 : 0;

            return { resource, currentStock, percentFull };
        });
    }, [chartData, resourcesData]);

    const sortedRows = useMemo(() => {
        const sorted = [...resourceRows];
        sorted.sort((a, b) => {
            let aVal: number | string;
            let bVal: number | string;

            switch (sortKey) {
                case "resource":
                    aVal = a.resource;
                    bVal = b.resource;
                    break;
                case "stock":
                    aVal = a.currentStock;
                    bVal = b.currentStock;
                    break;
                case "percent":
                    aVal = a.percentFull;
                    bVal = b.percentFull;
                    break;
                default:
                    return 0;
            }

            if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
            if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
            return 0;
        });
        return sorted;
    }, [resourceRows, sortKey, sortDirection]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
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
                No resource data available
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
                            onClick={() => handleSort("resource")}
                        >
                            Resource{getSortIndicator("resource")}
                        </th>
                        <th
                            className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                            onClick={() => handleSort("stock")}
                        >
                            Current Stock{getSortIndicator("stock")}
                        </th>
                        <th
                            className="py-3 px-4 text-center font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors min-w-37.5"
                            onClick={() => handleSort("percent")}
                        >
                            Fill Level{getSortIndicator("percent")}
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
                        const isVisible = !hiddenResources.has(row.resource);
                        return (
                            <tr
                                key={row.resource}
                                className="border-b border-border/30 hover:bg-tan-green/20 dark:hover:bg-muted/30 transition-colors"
                            >
                                <td className="py-3 px-4">
                                    <div className="flex items-center gap-2">
                                        <ResourceIcon
                                            resource={row.resource}
                                            size={20}
                                        />
                                        <ResourceName
                                            resource={row.resource as Fuel}
                                            mode="long"
                                        />
                                    </div>
                                </td>
                                <td className="py-3 px-4 text-right font-mono">
                                    {formatMass(row.currentStock)}
                                </td>
                                <td className="py-3 px-4 text-center min-w-37.5">
                                    <FacilityGauge
                                        facilityType={row.resource}
                                        value={row.percentFull}
                                    />
                                </td>
                                <td className="py-3 px-4 text-center">
                                    <button
                                        onClick={() =>
                                            onToggleResource(row.resource)
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
