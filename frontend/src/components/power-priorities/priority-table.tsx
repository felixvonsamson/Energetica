/**
 * Priority table component - displays all production and consumption facilities
 * in a single interleaved table. Fetches its own data. Supports bump-button
 * reordering and inline price editing (delegated to each PriorityItem row).
 */

import { useMemo } from "react";

import { PriorityItem } from "@/components/power-priorities/priority-item";
import { RenewablesSection } from "@/components/power-priorities/renewables-section";
import { Card, CardContent } from "@/components/ui";
import { useLatestChartDataSlice } from "@/hooks/use-charts";
import { useFacilityStatuses, useFacilities } from "@/hooks/use-facilities";
import { usePowerPriorities } from "@/hooks/use-power-priorities";
import { getPriorityItemKey } from "@/lib/power-priorities-utils";

export function PriorityTable() {
    const { data: prioritiesData, isLoading, error } = usePowerPriorities();
    const {
        data: statusesData,
        isLoading: statusesLoading,
        error: statusesError,
    } = useFacilityStatuses();
    const { data: facilitiesData } = useFacilities();

    const { data: productionPowerLevels } = useLatestChartDataSlice({
        chartType: "power-sources",
    });
    const { data: consumptionPowerLevels } = useLatestChartDataSlice({
        chartType: "power-sinks",
    });

    const productionCapacityByType = useMemo(() => {
        if (!facilitiesData) return {};
        const capacities: Record<string, number> = {};
        facilitiesData.power_facilities.forEach((f) => {
            capacities[f.facility] =
                (capacities[f.facility] ?? 0) + f.max_power_generation;
        });
        facilitiesData.storage_facilities.forEach((f) => {
            capacities[f.facility] =
                (capacities[f.facility] ?? 0) + f.max_power_generation;
        });
        return capacities;
    }, [facilitiesData]);

    const consumptionCapacityByType = useMemo(() => {
        if (!facilitiesData) return {};
        const capacities: Record<string, number> = {};
        facilitiesData.extraction_facilities.forEach((f) => {
            capacities[f.facility] =
                (capacities[f.facility] ?? 0) + f.max_power_use;
        });
        facilitiesData.storage_facilities.forEach((f) => {
            capacities[f.facility] =
                (capacities[f.facility] ?? 0) + f.max_power_use;
        });
        return capacities;
    }, [facilitiesData]);

    if (isLoading || statusesLoading) {
        return (
            <div className="p-4 md:p-8 text-center">
                <p className="text-lg">Loading power priorities...</p>
            </div>
        );
    }

    if (error || statusesError) {
        return (
            <div className="p-4 md:p-8 text-center text-alert-red">
                <p className="text-lg">Error loading power priorities</p>
                <p className="text-sm mt-2">
                    {error instanceof Error
                        ? error.message
                        : statusesError instanceof Error
                          ? statusesError.message
                          : "Unknown error"}
                </p>
            </div>
        );
    }

    if (!prioritiesData || !statusesData) {
        return null;
    }

    const { renewables, power_priorities } = prioritiesData;

    // Reverse so the table reads top=lowest-priority, bottom=highest-priority.
    const displayItems = [...power_priorities].reverse();

    const renderPriorityItems = () =>
        displayItems.map((item, displayIndex) => {
            const originalIndex = power_priorities.findIndex(
                (p) => getPriorityItemKey(p) === getPriorityItemKey(item),
            );

            const consumptionItemsAfter = power_priorities
                .slice(originalIndex + 1)
                .filter((i) => i.side === "bid").length;
            const consumptionPriority =
                item.side === "bid" ? consumptionItemsAfter + 1 : null;

            const productionItemsBefore = power_priorities
                .slice(0, originalIndex)
                .filter((i) => i.side === "ask").length;
            const productionPriority =
                item.side === "ask" ? productionItemsBefore + 1 : null;

            const currentPowerMW =
                item.side === "ask"
                    ? productionPowerLevels[item.type]
                    : consumptionPowerLevels[item.type];
            const capacityMW =
                item.side === "ask"
                    ? productionCapacityByType[item.type]
                    : consumptionCapacityByType[item.type];

            const canBumpUp = displayIndex > 0;
            const canBumpDown = displayIndex < displayItems.length - 1;

            return (
                <PriorityItem
                    key={getPriorityItemKey(item)}
                    item={item}
                    allPriorities={power_priorities}
                    consumptionPriority={consumptionPriority}
                    productionPriority={productionPriority}
                    canBumpUp={canBumpUp}
                    canBumpDown={canBumpDown}
                    statuses={statusesData}
                    currentPowerMW={currentPowerMW}
                    capacityMW={capacityMW}
                />
            );
        });

    return (
        <Card>
            <CardContent>
                {displayItems.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                        No facilities available
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-170 border-separate border-spacing-y-2">
                            <thead>
                                <tr className="text-xs font-medium text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                                    <th className="text-center py-2 px-2 w-24">
                                        Cons #
                                    </th>
                                    <th className="text-left py-2 px-3">
                                        Facility
                                    </th>
                                    <th className="text-right py-2 px-3 w-30">
                                        Power
                                    </th>
                                    <th className="py-2 px-3 w-40 hidden lg:table-cell">
                                        Usage
                                    </th>
                                    <th className="py-2 px-3 w-36">Price</th>
                                    <th className="text-right py-2 px-3 w-10">
                                        Status
                                    </th>
                                    <th className="text-center py-2 px-2 w-24">
                                        Prod #
                                    </th>
                                </tr>
                            </thead>
                            <tbody>{renderPriorityItems()}</tbody>
                            {renewables.length > 0 && (
                                <RenewablesSection
                                    renewables={renewables}
                                    statuses={statusesData}
                                    productionPowerLevels={
                                        productionPowerLevels
                                    }
                                    productionCapacityByType={
                                        productionCapacityByType
                                    }
                                />
                            )}
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
