/**
 * Priority item component - displays a single facility in the priority list.
 * Shows facility name, status, and supports drag-and-drop reordering.
 */

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

import { PriceInput } from "./PriceInput";
import { StatusBadge } from "./StatusBadge";
import type {
    PowerPriorityItem,
    InteractionMode,
    ProductionStatus,
    ConsumptionStatus,
} from "./types";

import { AssetName } from "@/components/ui/AssetName";
import { FacilityGauge } from "@/components/ui/FacilityGauge";
import { formatPower } from "@/lib/format-utils";
import {
    getPriorityItemDisplayName,
    getPriorityItemKey,
} from "@/lib/power-priorities-utils";
import type { ApiResponse } from "@/types/api-helpers";

interface PriorityItemProps {
    /** The priority item to display */
    item: PowerPriorityItem;
    /** Consumption priority (1-based, null if not a consumption item) */
    consumptionPriority: number | null;
    /** Production priority (1-based, null if not a production item) */
    productionPriority: number | null;
    /** Whether this is a ghost item from the opposite table */
    isGhost: boolean;
    /** Interaction mode (drag or price) */
    mode: InteractionMode;
    /** Callback when price changes (price mode only) */
    onPriceChange: (newPrice: number) => void;
    /** Whether the item is in edit mode */
    isEditMode?: boolean;
    /** Facility statuses from the API */
    statuses: ApiResponse<"/api/v1/facilities/statuses", "get">;
    /** Current power level in MW */
    currentPowerMW?: number;
    /** Total capacity in MW */
    capacityMW?: number;
}

/**
 * Displays a single facility in the priority list with its status and priority
 * number. Supports drag-and-drop reordering when in edit mode.
 *
 * Ghost items are valid drop targets but cannot be dragged (no drag handle).
 */
export function PriorityItem({
    item,
    consumptionPriority,
    productionPriority,
    isGhost,
    mode,
    onPriceChange,
    isEditMode = false,
    statuses,
    currentPowerMW = 0,
    capacityMW = 0,
}: PriorityItemProps) {
    const suffix = getPriorityItemDisplayName(item);
    const itemId = getPriorityItemKey(item);
    const isDraggable = mode === "drag" && isEditMode && !isGhost;

    // Look up the status for this facility
    const status: ProductionStatus | ConsumptionStatus | null | undefined =
        item.side === "ask"
            ? statuses.production[item.type]
            : statuses.consumption[item.type];

    // All items use sortable (including ghosts for drop targets)
    // Ghost items are disabled for dragging but still registered for drop targeting
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: itemId,
        disabled: !isDraggable,
    });

    // Apply transform and transition styles
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    // Determine grid template based on mode, edit state, and item side
    // Consumption items don't include production priority column
    // Production items don't include consumption priority column
    const isConsumption = item.side === "bid";
    const isProduction = item.side === "ask";

    let gridTemplate: string;
    if (isConsumption) {
        // Consumption items: [cons#/drag] [facility] [power] [gauge] [price?] [status]
        gridTemplate =
            mode === "price" && isEditMode
                ? "grid-cols-[60px_1fr_80px_160px_140px_130px]"
                : "grid-cols-[60px_1fr_80px_160px_130px]";
    } else {
        // Production items: [facility] [power] [gauge] [price?] [status] [prod#/drag]
        gridTemplate =
            mode === "price" && isEditMode
                ? "grid-cols-[1fr_80px_160px_140px_130px_60px]"
                : "grid-cols-[1fr_80px_160px_130px_60px]";
    }

    // Ghost items use simplified layout
    const itemClassName = [
        "p-3 bg-tan-green dark:bg-dark-bg-secondary rounded-lg",
        isGhost
            ? "flex items-center opacity-50 ml-10 h-6"
            : `grid ${gridTemplate} gap-3 items-center`,
        isDragging && "opacity-50",
        isDraggable && "cursor-grab active:cursor-grabbing",
        // Production items get left margin to shift over (skip consumption priority column)
        isProduction && !isGhost && "ml-[72px]", // 60px column + 3px gap
        // Consumption items get right margin to stop short (skip production priority column)
        isConsumption && !isGhost && "mr-[72px]", // 60px column + 3px gap
    ]
        .filter(Boolean)
        .join(" ");

    // Ghost items render simplified
    if (isGhost) {
        return (
            <div ref={setNodeRef} style={style} className={itemClassName}>
                <div className="text-sm">
                    <AssetName assetId={item.type} mode="auto" />
                    {suffix && (
                        <span className="text-gray-600 dark:text-gray-400">
                            {suffix}
                        </span>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div ref={setNodeRef} style={style} className={itemClassName}>
            {/* Consumption priority number or drag handle (only for consumption items) */}
            {isConsumption && (
                <div className="text-center flex items-center justify-center">
                    {isDraggable ? (
                        <div
                            {...listeners}
                            {...attributes}
                            className="cursor-grab active:cursor-grabbing touch-none"
                        >
                            <GripVertical className="w-5 h-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                        </div>
                    ) : (
                        <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                            #{consumptionPriority}
                        </span>
                    )}
                </div>
            )}

            {/* Facility name */}
            <div className="min-w-0 font-medium">
                <AssetName assetId={item.type} mode="auto" />
                {suffix && (
                    <span className="text-gray-600 dark:text-gray-400">
                        {suffix}
                    </span>
                )}
            </div>

            {/* Current power */}
            <div className="text-xs text-gray-600 dark:text-gray-400 text-right">
                {currentPowerMW !== undefined ? (
                    <span className="font-mono">
                        {formatPower(currentPowerMW)}
                    </span>
                ) : (
                    <span className="text-center">—</span>
                )}
            </div>

            {/* Power gauge */}
            <div>
                {capacityMW > 0 ? (
                    <FacilityGauge
                        facilityType={item.type}
                        value={
                            capacityMW > 0
                                ? (currentPowerMW / capacityMW) * 100
                                : 0
                        }
                    />
                ) : (
                    <div className="text-center text-xs text-gray-500 dark:text-gray-400">
                        —
                    </div>
                )}
            </div>

            {/* Price input (only in price mode) */}
            {mode === "price" &&
                item.price !== null &&
                item.price !== undefined && (
                    <div>
                        <PriceInput
                            value={item.price}
                            onChange={(newPrice) => onPriceChange(newPrice)}
                            disabled={!isEditMode}
                        />
                    </div>
                )}

            {/* Status badge */}
            <div className="flex justify-end">
                <StatusBadge status={status} />
            </div>

            {/* Production priority number or drag handle (only for production items) */}
            {isProduction && (
                <div className="text-center flex items-center justify-center">
                    {isDraggable ? (
                        <div
                            {...listeners}
                            {...attributes}
                            className="cursor-grab active:cursor-grabbing touch-none"
                        >
                            <GripVertical className="w-5 h-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                        </div>
                    ) : (
                        <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                            #{productionPriority}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}
