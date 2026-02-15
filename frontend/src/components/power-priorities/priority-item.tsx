/**
 * Priority item component - displays a single facility in the priority list.
 * Shows facility name, status, current power, price input, and bump buttons.
 */

import { ChevronDown, ChevronUp } from "lucide-react";

import { PriceInput } from "@/components/power-priorities/price-input";
import { StatusBadge } from "@/components/power-priorities/status-badge";
import type {
    PowerPriorityItem,
    ProductionStatus,
    ConsumptionStatus,
} from "@/components/power-priorities/types";
import { AssetName } from "@/components/ui/asset-name";
import { Button } from "@/components/ui/button";
import { FacilityGauge } from "@/components/ui/facility-gauge";
import { formatPower } from "@/lib/format-utils";
import { getPriorityItemDisplayName } from "@/lib/power-priorities-utils";
import { cn } from "@/lib/utils";
import type { ApiResponse } from "@/types/api-helpers";

interface PriorityItemProps {
    /** The priority item to display */
    item: PowerPriorityItem;
    /** Consumption priority (1-based, null if not a consumption item) */
    consumptionPriority: number | null;
    /** Production priority (1-based, null if not a production item) */
    productionPriority: number | null;
    /** Called when the user commits a new price (blur / Enter) */
    onPriceCommit: (newPrice: number) => void;
    /** Called when the user clicks a bump button */
    onBump: (direction: "up" | "down") => void;
    /** Whether the ↑ bump button should be disabled (already at top of list) */
    canBumpUp: boolean;
    /** Whether the ↓ bump button should be disabled (already at bottom of list) */
    canBumpDown: boolean;
    /** Disable all interaction while a mutation is in flight */
    isMutating?: boolean;
    /** Facility statuses from the API */
    statuses: ApiResponse<"/api/v1/facilities/statuses", "get">;
    /** Current power level in MW */
    currentPowerMW?: number;
    /** Total capacity in MW */
    capacityMW?: number;
}

/**
 * Displays a single facility as a table row.
 *
 * Bump buttons sit in the side cell that "owns" the row (left for consumption,
 * right for production). The ↑ button uses variant="ghost" and ↓ uses
 * variant="secondary" — ↓ is always the "increase priority" action for both
 * sides, so it gets the visual weight.
 */
export function PriorityItem({
    item,
    consumptionPriority,
    productionPriority,
    onPriceCommit,
    onBump,
    canBumpUp,
    canBumpDown,
    isMutating = false,
    statuses,
    currentPowerMW = 0,
    capacityMW = 0,
}: PriorityItemProps) {
    const suffix = getPriorityItemDisplayName(item);

    const status: ProductionStatus | ConsumptionStatus | null | undefined =
        item.side === "ask"
            ? statuses.production[item.type]
            : statuses.consumption[item.type];

    const isConsumption = item.side === "bid";
    const isProduction = item.side === "ask";

    const bumpButtons = (priority: number) => (
        <div className="inline-flex items-center gap-1">
            <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onBump("up")}
                disabled={!canBumpUp || isMutating}
                title="Move up (lower priority)"
                aria-label="Move up"
            >
                <ChevronUp className="size-4" />
            </Button>
            <span className="text-sm font-semibold text-gray-600 dark:text-gray-400 w-6 text-center tabular-nums">
                #{priority}
            </span>
            <Button
                variant="secondary"
                size="icon-sm"
                onClick={() => onBump("down")}
                disabled={!canBumpDown || isMutating}
                title="Move down (higher priority)"
                aria-label="Move down"
            >
                <ChevronDown className="size-4" />
            </Button>
        </div>
    );

    return (
        <tr className="h-13">
            {/* Consumption side cell — bump buttons for bid rows, empty for ask */}
            <td
                className={cn(
                    "py-3 px-2 text-center",
                    isConsumption
                        ? "bg-secondary rounded-l-lg"
                        : "bg-transparent",
                )}
            >
                {isConsumption && consumptionPriority !== null
                    ? bumpButtons(consumptionPriority)
                    : null}
            </td>

            {/* Facility name */}
            <td
                className={cn(
                    "py-3 px-3 font-medium bg-secondary",
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
            <td className="py-3 px-3 text-right text-xs text-gray-600 dark:text-gray-400 bg-secondary">
                <span className="font-mono">{formatPower(currentPowerMW)}</span>
            </td>

            {/* Power gauge (hidden on mobile) */}
            <td className="py-3 px-3 hidden lg:table-cell bg-secondary">
                {capacityMW > 0 ? (
                    <FacilityGauge
                        facilityType={item.type}
                        value={(currentPowerMW / capacityMW) * 100}
                    />
                ) : (
                    <div className="text-center text-xs text-gray-500 dark:text-gray-400">
                        —
                    </div>
                )}
            </td>

            {/* Price */}
            <td className="py-0 px-3 bg-secondary">
                <PriceInput
                    value={item.price}
                    onCommit={onPriceCommit}
                    disabled={isMutating}
                />
            </td>

            {/* Status badge */}
            <td
                className={cn(
                    "py-2 px-3 text-right bg-secondary",
                    isConsumption && "rounded-r-lg",
                )}
            >
                <div className="inline-flex justify-end">
                    <StatusBadge status={status} variant={"iconOnly"} />
                </div>
            </td>

            {/* Production side cell — bump buttons for ask rows, empty for bid */}
            <td
                className={cn(
                    "py-3 px-2 text-center",
                    isProduction
                        ? "bg-secondary rounded-r-lg"
                        : "bg-transparent",
                )}
            >
                {isProduction && productionPriority !== null
                    ? bumpButtons(productionPriority)
                    : null}
            </td>
        </tr>
    );
}
