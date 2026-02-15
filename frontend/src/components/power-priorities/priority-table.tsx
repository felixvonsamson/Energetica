/**
 * Priority table component - displays all production and consumption facilities
 * in a single interleaved table. Supports bump-button reordering and inline
 * price editing.
 */

import { PriorityItem } from "@/components/power-priorities/priority-item";
import { RenewablesSection } from "@/components/power-priorities/renewables-section";
import type {
    PowerPriorityItem,
    RenewableFacilityType,
} from "@/components/power-priorities/types";
import { Card, CardContent } from "@/components/ui";
import { getPriorityItemKey } from "@/lib/power-priorities-utils";
import type { ApiResponse } from "@/types/api-helpers";

interface PriorityTableProps {
    /** Renewable facilities shown at the end of the table */
    renewables?: RenewableFacilityType[];
    /** Called when user bumps a row up or down */
    onBump: (item: PowerPriorityItem, direction: "up" | "down") => void;
    /** Called when user commits a price edit */
    onPriceCommit: (item: PowerPriorityItem, newPrice: number) => void;
    /** Whether a mutation is in flight (disables all interactive controls) */
    isMutating?: boolean;
    /** The complete unified priority array (index 0 = highest priority) */
    allPriorities?: PowerPriorityItem[];
    /** Facility statuses from the API */
    statuses: ApiResponse<"/api/v1/facilities/statuses", "get">;
    /** Production power levels by facility type */
    productionPowerLevels?: Partial<Record<string, number>>;
    /** Consumption power levels by facility type */
    consumptionPowerLevels?: Partial<Record<string, number>>;
    /** Production capacity by facility type */
    productionCapacityByType?: Record<string, number>;
    /** Consumption capacity by facility type */
    consumptionCapacityByType?: Record<string, number>;
}

export function PriorityTable({
    renewables = [],
    onBump,
    onPriceCommit,
    isMutating = false,
    allPriorities = [],
    statuses,
    productionPowerLevels = {},
    consumptionPowerLevels = {},
    productionCapacityByType = {},
    consumptionCapacityByType = {},
}: PriorityTableProps) {
    // Reverse so the table reads top=lowest-priority, bottom=highest-priority.
    // The bump logic operates on allPriorities indices, so we pass the original
    // index to each item via a closure.
    const displayItems = [...allPriorities].reverse();

    const renderPriorityItems = () =>
        displayItems.map((item, displayIndex) => {
            const originalIndex = allPriorities.findIndex(
                (p) => getPriorityItemKey(p) === getPriorityItemKey(item),
            );

            const consumptionItemsAfter = allPriorities
                .slice(originalIndex + 1)
                .filter((i) => i.side === "bid").length;
            const consumptionPriority =
                item.side === "bid" ? consumptionItemsAfter + 1 : null;

            const productionItemsBefore = allPriorities
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

            // canBumpUp: can move higher up the visual table (lower overall priority)
            // canBumpDown: can move lower in the visual table (higher overall priority)
            const canBumpUp = displayIndex > 0;
            const canBumpDown = displayIndex < displayItems.length - 1;

            return (
                <PriorityItem
                    key={getPriorityItemKey(item)}
                    item={item}
                    consumptionPriority={consumptionPriority}
                    productionPriority={productionPriority}
                    onPriceCommit={(newPrice) => onPriceCommit(item, newPrice)}
                    onBump={(direction) => onBump(item, direction)}
                    canBumpUp={canBumpUp}
                    canBumpDown={canBumpDown}
                    isMutating={isMutating}
                    statuses={statuses}
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
                                    statuses={statuses}
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
