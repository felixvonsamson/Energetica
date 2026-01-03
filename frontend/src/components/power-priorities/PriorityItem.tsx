/**
 * Priority item component - displays a single facility in the priority list.
 * Shows facility name, status, and supports drag-and-drop reordering.
 */

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { GripVertical } from "lucide-react";

import { Money } from "../ui";

import { PriceInput } from "./PriceInput";
import { StatusBadge } from "./StatusBadge";
import type {
    PowerPriorityItem,
    ProductionStatus,
    ConsumptionStatus,
} from "./types";

import { AssetName } from "@/components/ui/AssetName";
import { FacilityGauge } from "@/components/ui/FacilityGauge";
import { cn } from "@/lib/classname-utils";
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
 * Displays a single facility as a table row in the priority list with its
 * status and priority number. Supports drag-and-drop reordering when in edit
 * mode.
 *
 * Ghost items are valid drop targets but cannot be dragged (no drag handle).
 */
export function PriorityItem({
    item,
    consumptionPriority,
    productionPriority,
    onPriceChange,
    isEditMode = false,
    statuses,
    currentPowerMW = 0,
    capacityMW = 0,
}: PriorityItemProps) {
    const suffix = getPriorityItemDisplayName(item);
    const itemId = getPriorityItemKey(item);
    const isDraggable = isEditMode;

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

    const isConsumption = item.side === "bid";
    const isProduction = item.side === "ask";

    return (
        <motion.tr
            ref={setNodeRef}
            style={style}
            // Motion props
            layout={!isDragging}
            layoutId={isDragging ? undefined : itemId}
            //
            className={cn("h-13", isDragging && "opacity-50")}
        >
            {/* Consumption priority number or drag handle */}
            <td
                {...(isConsumption && isDraggable ? listeners : {})}
                {...(isConsumption && isDraggable ? attributes : {})}
                className={cn(
                    "py-3 px-3 text-center",
                    isConsumption
                        ? "bg-tan-green dark:bg-dark-bg-secondary rounded-l-lg"
                        : "bg-transparent",
                    isConsumption &&
                        isDraggable &&
                        "cursor-grab active:cursor-grabbing touch-none",
                )}
            >
                {isConsumption ? (
                    isDraggable ? (
                        <div className="inline-flex">
                            <GripVertical className="w-5 h-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                        </div>
                    ) : (
                        <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                            #{consumptionPriority}
                        </span>
                    )
                ) : null}
            </td>

            {/* Facility name */}
            <td
                className={cn(
                    "py-3 px-3 font-medium bg-tan-green dark:bg-dark-bg-secondary",
                    isProduction && "rounded-l-lg",
                )}
            >
                <AssetName assetId={item.type} mode="short" />
                {suffix && (
                    <span className="text-gray-600 dark:text-gray-400">
                        {suffix}
                    </span>
                )}
            </td>

            {/* Current power */}
            <td className="py-3 px-3 text-right text-xs text-gray-600 dark:text-gray-400 bg-tan-green dark:bg-dark-bg-secondary">
                {currentPowerMW !== undefined ? (
                    <span className="font-mono">
                        {formatPower(currentPowerMW)}
                    </span>
                ) : (
                    <span>—</span>
                )}
            </td>

            {/* Power gauge (hidden on mobile) */}
            <td className="py-3 px-3 hidden lg:table-cell bg-tan-green dark:bg-dark-bg-secondary">
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
            </td>

            {/* Price display */}
            {!isEditMode && (
                <td className="text-right py-3 px-3 bg-tan-green dark:bg-dark-bg-secondary">
                    <Money amount={item.price} />
                </td>
            )}

            {/* Price input (only in price mode) */}
            {isEditMode && item.price !== null && item.price !== undefined && (
                <td className="py-0 px-3 bg-tan-green dark:bg-dark-bg-secondary">
                    <PriceInput
                        value={item.price}
                        onChange={(newPrice) => onPriceChange(newPrice)}
                        disabled={!isEditMode}
                    />
                </td>
            )}

            {/* Status badge */}
            <td
                className={cn(
                    "py-2 px-3 text-right bg-tan-green dark:bg-dark-bg-secondary",
                    isConsumption && "rounded-r-lg",
                )}
            >
                <div className="inline-flex justify-end">
                    <StatusBadge status={status} variant={"iconOnly"} />
                </div>
            </td>

            {/* Production priority number or drag handle */}
            <td
                {...(isProduction && isDraggable ? listeners : {})}
                {...(isProduction && isDraggable ? attributes : {})}
                className={cn(
                    "py-3 px-3 text-center",
                    isProduction
                        ? "bg-tan-green dark:bg-dark-bg-secondary rounded-r-lg"
                        : "bg-transparent",
                    isProduction &&
                        isDraggable &&
                        "cursor-grab active:cursor-grabbing touch-none",
                )}
            >
                {isProduction ? (
                    isDraggable ? (
                        <div className="inline-flex">
                            <GripVertical className="w-5 h-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                        </div>
                    ) : (
                        <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                            #{productionPriority}
                        </span>
                    )
                ) : null}
            </td>
        </motion.tr>
    );
}
