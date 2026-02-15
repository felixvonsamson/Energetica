/**
 * Priority item component - displays a single facility in the priority list.
 * Self-contained: fetches its own data, derives all display values from
 * allPriorities, and owns its mutation logic for bump reordering and price
 * editing.
 */

import { ChevronDown, ChevronUp } from "lucide-react";
import { useMemo } from "react";

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
import { useLatestChartDataSlice } from "@/hooks/use-charts";
import { useFacilityStatuses, useFacilities } from "@/hooks/use-facilities";
import { useUpdateElectricityPrices } from "@/hooks/use-power-priorities";
import { formatPower } from "@/lib/format-utils";
import { getPriorityItemKey, getPriorityItemDisplayName } from "@/lib/power-priorities-utils";
import { cn } from "@/lib/utils";

interface PriorityItemProps {
    /** The priority item to display */
    item: PowerPriorityItem;
    /** The complete unified priority array — used to derive ordering and display values */
    allPriorities: PowerPriorityItem[];
}

/**
 * Displays a single facility as a table row.
 *
 * Bump buttons sit in the side cell that "owns" the row (left for consumption,
 * right for production). The ↑ button uses variant="ghost" and ↓ uses
 * variant="secondary" — ↓ is always the "increase priority" action for both
 * sides, so it gets the visual weight.
 */
export function PriorityItem({ item, allPriorities }: PriorityItemProps) {
    const updateElectricityPrices = useUpdateElectricityPrices();
    const isMutating = updateElectricityPrices.isPending;

    const { data: statusesData } = useFacilityStatuses();
    const { data: facilitiesData } = useFacilities();
    const { data: productionPowerLevels } = useLatestChartDataSlice({
        chartType: "power-sources",
    });
    const { data: consumptionPowerLevels } = useLatestChartDataSlice({
        chartType: "power-sinks",
    });

    const suffix = getPriorityItemDisplayName(item);

    const status: ProductionStatus | ConsumptionStatus | null | undefined =
        item.side === "ask"
            ? statusesData?.production[item.type]
            : statusesData?.consumption[item.type];

    const isConsumption = item.side === "bid";
    const isProduction = item.side === "ask";

    // Derive position and bump eligibility from allPriorities.
    // allPriorities[0] = highest priority; the table displays in reverse
    // (top = lowest priority), so:
    //   canBumpUp   = item can move toward top of screen (lower priority) = not already last in array
    //   canBumpDown = item can move toward bottom of screen (higher priority) = not already first in array
    const originalIndex = allPriorities.findIndex(
        (p) => getPriorityItemKey(p) === getPriorityItemKey(item),
    );
    const canBumpUp = originalIndex < allPriorities.length - 1;
    const canBumpDown = originalIndex > 0;

    const consumptionItemsAfter = allPriorities
        .slice(originalIndex + 1)
        .filter((p) => p.side === "bid").length;
    const consumptionPriority =
        isConsumption && originalIndex !== -1 ? consumptionItemsAfter + 1 : null;

    const productionItemsBefore = allPriorities
        .slice(0, originalIndex)
        .filter((p) => p.side === "ask").length;
    const productionPriority =
        isProduction && originalIndex !== -1 ? productionItemsBefore + 1 : null;

    const currentPowerMW =
        item.side === "ask"
            ? productionPowerLevels[item.type]
            : consumptionPowerLevels[item.type];

    const capacityMW = useMemo(() => {
        if (!facilitiesData) return 0;
        if (item.side === "ask") {
            return (
                facilitiesData.power_facilities
                    .filter((f) => f.facility === item.type)
                    .reduce((sum, f) => sum + f.max_power_generation, 0) +
                facilitiesData.storage_facilities
                    .filter((f) => f.facility === item.type)
                    .reduce((sum, f) => sum + f.max_power_generation, 0)
            );
        }
        return (
            facilitiesData.extraction_facilities
                .filter((f) => f.facility === item.type)
                .reduce((sum, f) => sum + f.max_power_use, 0) +
            facilitiesData.storage_facilities
                .filter((f) => f.facility === item.type)
                .reduce((sum, f) => sum + f.max_power_use, 0)
        );
    }, [facilitiesData, item.type, item.side]);

    /** Submits updated prices derived from a reordered/repriced priority array. */
    const submitPrices = async (updatedPriorities: PowerPriorityItem[]) => {
        const asks = updatedPriorities
            .filter((p) => p.side === "ask")
            .map((p) => ({ type: p.type, price: p.price || 0 }));
        const bids = updatedPriorities
            .filter((p) => p.side === "bid")
            .map((p) => ({ type: p.type, price: p.price || 0 }));
        await updateElectricityPrices.mutateAsync({ asks, bids });
    };

    /**
     * Bumps this item one step up or down in the visual table by swapping it
     * with its neighbour in allPriorities, then redistributing prices so the
     * order is preserved on the backend (which sorts by price ascending).
     */
    const handleBump = async (direction: "up" | "down") => {
        if (originalIndex === -1) return;

        // "up" in the visual table = move to higher allPriorities index (lower priority).
        // "down" = lower allPriorities index (higher priority).
        const neighbourIdx = direction === "up" ? originalIndex + 1 : originalIndex - 1;
        if (neighbourIdx < 0 || neighbourIdx >= allPriorities.length) return;

        const reordered = [...allPriorities];
        const a = reordered[originalIndex]!;
        const b = reordered[neighbourIdx]!;
        reordered[originalIndex] = b;
        reordered[neighbourIdx] = a;

        // Redistribute existing prices to match the new order so the backend
        // stores them in the intended sequence.
        const sortedPrices = [...reordered.map((p) => p.price)].sort(
            (x, y) => x - y,
        );
        const withPrices = reordered.map((p, i) => ({
            ...p,
            price: sortedPrices[i] ?? p.price,
        }));

        await submitPrices(withPrices);
    };

    /**
     * Applies a direct price edit. Re-sorts the priority list by the new
     * prices so the backend order stays consistent.
     */
    const handlePriceCommit = async (newPrice: number) => {
        const key = getPriorityItemKey(item);
        const updated = allPriorities.map((p) =>
            getPriorityItemKey(p) === key ? { ...p, price: newPrice } : p,
        );
        const sorted = [...updated].sort((a, b) => a.price - b.price);
        await submitPrices(sorted);
    };

    const bumpButtons = (priority: number) => (
        <div className="inline-flex items-center gap-1">
            <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleBump("up")}
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
                onClick={() => handleBump("down")}
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
                <span className="font-mono">{formatPower(currentPowerMW ?? 0)}</span>
            </td>

            {/* Power gauge (hidden on mobile) */}
            <td className="py-3 px-3 hidden lg:table-cell bg-secondary">
                {capacityMW > 0 ? (
                    <FacilityGauge
                        facilityType={item.type}
                        value={((currentPowerMW ?? 0) / capacityMW) * 100}
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
                    onCommit={handlePriceCommit}
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
