/**
 * Priority item component - displays a single facility in the priority list.
 * Self-contained: fetches its own data, and owns its mutation logic for bump
 * reordering and price editing.
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
import {
    usePowerPriorities,
    useUpdateElectricityPrices,
    useUpdatePowerPriorities,
} from "@/hooks/use-power-priorities";
import { formatPower } from "@/lib/format-utils";
import { getPriorityItemDisplayName } from "@/lib/power-priorities-utils";
import { cn } from "@/lib/utils";

interface PriorityItemProps {
    item: PowerPriorityItem;
    /** Index of this item in the original (high→low priority) array */
    originalIndex: number;
    canBumpUp: boolean;
    canBumpDown: boolean;
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
    originalIndex,
    canBumpUp,
    canBumpDown,
}: PriorityItemProps) {
    const updatePowerPriorities = useUpdatePowerPriorities();
    const updateElectricityPrices = useUpdateElectricityPrices();
    const isMutating =
        updatePowerPriorities.isPending || updateElectricityPrices.isPending;

    // All cached — no extra network requests.
    const { data: prioritiesData } = usePowerPriorities();
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

    /**
     * Swaps this item with its neighbour and submits the new order. Price
     * redistribution is handled server-side.
     */
    const handleBump = async (direction: "up" | "down") => {
        const allPriorities = prioritiesData?.power_priorities ?? [];
        const neighbourIdx =
            direction === "up" ? originalIndex + 1 : originalIndex - 1;
        if (neighbourIdx < 0 || neighbourIdx >= allPriorities.length) return;

        const reordered = [...allPriorities];
        [reordered[originalIndex], reordered[neighbourIdx]] = [
            reordered[neighbourIdx]!,
            reordered[originalIndex]!,
        ];

        await updatePowerPriorities.mutateAsync({
            power_priorities: reordered,
        });
    };

    /** Commits a price edit for this item. */
    const handlePriceCommit = async (newPrice: number) => {
        const asks = (prioritiesData?.power_priorities ?? [])
            .filter((p) => p.side === "ask")
            .map((p) => ({
                type: p.type,
                price:
                    p.type === item.type && item.side === "ask"
                        ? newPrice
                        : p.price,
            }));
        const bids = (prioritiesData?.power_priorities ?? [])
            .filter((p) => p.side === "bid")
            .map((p) => ({
                type: p.type,
                price:
                    p.type === item.type && item.side === "bid"
                        ? newPrice
                        : p.price,
            }));
        await updateElectricityPrices.mutateAsync({ asks, bids });
    };

    const bumpButtons = (
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
            <Button
                variant="ghost"
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
                {isConsumption ? bumpButtons : null}
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
                <span className="font-mono">
                    {formatPower(currentPowerMW ?? 0)}
                </span>
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
                {isProduction ? bumpButtons : null}
            </td>
        </tr>
    );
}
