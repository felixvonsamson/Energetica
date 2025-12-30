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

import { PriorityItem } from "./PriorityItem";
import { RenewablesSection } from "./RenewablesSection";
import type {
    PowerPriorityItem,
    RenewableFacilityType,
    InteractionMode,
} from "./types";

import { Card } from "@/components/ui";
import { getPriorityItemKey } from "@/lib/power-priorities-utils";
import type { ApiResponse } from "@/types/api-helpers";

interface PriorityTableProps {
    /** Which side this table represents */
    side: "production" | "consumption";
    /** Renewable facilities (production only) */
    renewables?: RenewableFacilityType[];
    /** Whether the table is in edit mode */
    isEditMode?: boolean;
    /** Interaction mode (drag or price) */
    mode?: InteractionMode;
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
    side,
    renewables = [],
    isEditMode = false,
    mode = "drag",
    onReorder,
    onPriceChange,
    allPriorities = [],
    statuses,
    productionPowerLevels = {},
    consumptionPowerLevels = {},
    productionCapacityByType = {},
    consumptionCapacityByType = {},
}: PriorityTableProps) {
    const emptyMessage =
        side === "production"
            ? "No production facilities available"
            : "No consumption facilities available";

    // Determine which side to show
    const currentSide = side === "production" ? "ask" : "bid";

    // Always show all items (both consumption and production) without ghost mode
    // For consumption table, reverse the order to maintain display convention
    const displayItems = allPriorities.map((p) => ({
        ...p,
        isGhost: false,
    }));
    if (currentSide === "bid") {
        displayItems.reverse();
    }

    // Set up sensors for drag and drop
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    // Generate sortable IDs for ALL items (including ghosts as drop targets)
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

    const priorityItems = (
        <>
            {displayItems.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                    {emptyMessage}
                </p>
            ) : (
                displayItems.map((item) => {
                    // Find the original index in the unified priority array
                    const originalIndex = allPriorities.findIndex(
                        (p) =>
                            getPriorityItemKey(p) === getPriorityItemKey(item),
                    );

                    // Calculate priorities based on ORIGINAL position in unified array
                    // (not display position, since display is reversed for consumption)
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

                    // Use the appropriate power level and capacity based on item side
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
                            isGhost={item.isGhost}
                            mode={mode}
                            isEditMode={isEditMode}
                            onPriceChange={(newPrice) =>
                                onPriceChange?.(item, newPrice)
                            }
                            statuses={statuses}
                            currentPowerMW={currentPowerMW}
                            capacityMW={capacityMW}
                        />
                    );
                })
            )}
        </>
    );

    return (
        <Card>
            <div className="space-y-2">
                {/* Column headers */}
                {displayItems.length > 0 && (
                    <div
                        className={`grid gap-3 px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 ${
                            mode === "price" && isEditMode
                                ? "grid-cols-[60px_1fr_80px_160px_140px_120px_60px]"
                                : "grid-cols-[60px_1fr_80px_160px_120px_60px]"
                        }`}
                    >
                        <div className="text-center">Cons #</div>
                        <div>Facility</div>
                        <div className="text-right">Power</div>
                        <div>Usage</div>
                        {mode === "price" && isEditMode && <div>Price</div>}
                        <div className="text-right">Status</div>
                        <div className="text-center">Prod #</div>
                    </div>
                )}

                {/* Priority items with drag and drop */}
                {isEditMode && displayItems.length > 0 ? (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={itemIds}
                            strategy={verticalListSortingStrategy}
                        >
                            {priorityItems}
                        </SortableContext>
                    </DndContext>
                ) : (
                    priorityItems
                )}

                {/* Renewables section (at bottom for consumption table) */}
                {renewables.length > 0 && (
                    <RenewablesSection
                        renewables={renewables}
                        statuses={statuses}
                        productionPowerLevels={productionPowerLevels}
                        productionCapacityByType={productionCapacityByType}
                    />
                )}
            </div>
        </Card>
    );
}
