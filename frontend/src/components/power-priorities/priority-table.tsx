/**
 * Priority table component - displays either production or consumption
 * facilities. Handles rendering of renewables section, priority items, and
 * empty states. Supports drag-and-drop reordering in edit mode.
 */

import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { PriorityItem } from "@/components/power-priorities/priority-item";
import { RenewablesSection } from "@/components/power-priorities/renewables-section";
import type {
    PowerPriorityItem,
    RenewableFacilityType,
} from "@/components/power-priorities/types";
import { Card, CardContent } from "@/components/ui";
import { cn } from "@/lib/classname-utils";
import { getPriorityItemKey } from "@/lib/power-priorities-utils";
import type { ApiResponse } from "@/types/api-helpers";

interface PriorityTableProps {
    /** Renewable facilities (production only) */
    renewables?: RenewableFacilityType[];
    /** Whether the table is in edit mode */
    isEditMode?: boolean;
    /** Callback when priorities are reordered */
    onReorder?: (newPriorities: PowerPriorityItem[]) => void;
    /** Callback when a price changes (price mode only) */
    onPriceChange?: (item: PowerPriorityItem, newPrice: number) => void;
    /** The complete unified priority array (needed for drag mapping) */
    allPriorities?: PowerPriorityItem[];
    /** Facility statuses from the API */
    statuses: ApiResponse<"/api/v1/facilities/statuses", "get">;
    /** Production power levels by facility type */
    productionPowerLevels?: Record<string, number>;
    /** Consumption power levels by facility type */
    consumptionPowerLevels?: Record<string, number>;
    /** Production capacity by facility type */
    productionCapacityByType?: Record<string, number>;
    /** Consumption capacity by facility type */
    consumptionCapacityByType?: Record<string, number>;
}

/**
 * Displays a table of priority items with optional renewables section.
 * Production table shows renewables at top. Both tables show priority items. In
 * edit mode, enables drag-and-drop reordering using dnd-kit.
 */
export function PriorityTable({
    renewables = [],
    isEditMode = false,
    onReorder,
    onPriceChange,
    allPriorities = [],
    statuses,
    productionPowerLevels = {},
    consumptionPowerLevels = {},
    productionCapacityByType = {},
    consumptionCapacityByType = {},
}: PriorityTableProps) {
    const emptyMessage = "No consumption facilities available";

    const displayItems = allPriorities
        .map((p) => ({
            ...p,
        }))
        .reverse();

    // Set up sensors for drag and drop
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    // Generate sortable IDs for ALL items
    const itemIds = displayItems.map((item) => getPriorityItemKey(item));

    // Handle drag end
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (
            !over ||
            active.id === over.id ||
            !onReorder ||
            !allPriorities.length
        ) {
            return;
        }

        // Find the dragged item and the item it was dropped over
        const activeKey = active.id as string;
        const overKey = over.id as string;

        // Find indices in the unified array (not the filtered array!)
        const oldIndex = allPriorities.findIndex(
            (p) => getPriorityItemKey(p) === activeKey,
        );
        const newIndex = allPriorities.findIndex(
            (p) => getPriorityItemKey(p) === overKey,
        );

        if (oldIndex === -1 || newIndex === -1) {
            console.error("Could not find item indices for drag operation");
            return;
        }

        // Reorder in the unified array
        const newPriorities = arrayMove(allPriorities, oldIndex, newIndex);
        onReorder(newPriorities);
    };

    // Render priority items (shared between edit and view modes)
    const renderPriorityItems = () =>
        displayItems.map((item) => {
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

            return (
                <PriorityItem
                    key={getPriorityItemKey(item)}
                    item={item}
                    consumptionPriority={consumptionPriority}
                    productionPriority={productionPriority}
                    isEditMode={isEditMode}
                    onPriceChange={(newPrice) =>
                        onPriceChange?.(item, newPrice)
                    }
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
                        {emptyMessage}
                    </p>
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-170 border-separate border-spacing-y-2">
                                <thead>
                                    <tr
                                        className={cn(
                                            "text-xs font-medium text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700",
                                        )}
                                    >
                                        <th className="text-center py-2 px-3 w-15">
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
                                        <th className="py-2 px-3 w-60">
                                            Price
                                        </th>
                                        <th className="text-right py-2 px-3 w-10">
                                            Status
                                        </th>
                                        <th className="text-center py-2 px-3 w-15">
                                            Prod #
                                        </th>
                                    </tr>
                                </thead>
                                {isEditMode ? (
                                    <SortableContext
                                        items={itemIds}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        <tbody>{renderPriorityItems()}</tbody>
                                    </SortableContext>
                                ) : (
                                    <tbody>{renderPriorityItems()}</tbody>
                                )}
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
                    </DndContext>
                )}
            </CardContent>
        </Card>
    );
}
