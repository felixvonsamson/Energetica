/** Power Priorities page - Manage production and consumption priorities. */

import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";

import { GameLayout } from "@/components/layout/game-layout";
import { PriorityTable } from "@/components/power-priorities/priority-table";
import type { PowerPriorityItem } from "@/components/power-priorities/types";
import { useLatestChartData } from "@/hooks/useCharts";
import { useFacilityStatuses, useFacilities } from "@/hooks/useFacilities";
import {
    usePowerPriorities,
    useUpdatePowerPriorities,
    useUpdateElectricityPrices,
} from "@/hooks/usePowerPriorities";
import { getPriorityItemKey } from "@/lib/power-priorities-utils";

function PowerPrioritiesHelp() {
    return (
        <div className="space-y-3">
            <p>
                Here you can set the priority of your facilities to determine
                the order in which they will be used to satisfy your demand.
            </p>
            <p>
                Drag and drop facilities in the list to change their priority.
                Higher priority facilities will be used first.
            </p>
            <p>
                When you are in a network, you can also set prices for buying
                and selling electricity to trade with other players.
            </p>
        </div>
    );
}

export const Route = createFileRoute("/app/facilities/power-priorities")({
    component: PowerPrioritiesPage,
    staticData: {
        title: "Power Priorities",
        routeConfig: {
            requiredRole: "player",
            requiresSettledTile: true,
            isUnlocked: () => true,
        },
        infoModal: {
            contents: <PowerPrioritiesHelp />,
        },
    },
});

function PowerPrioritiesPage() {
    return (
        <GameLayout>
            <PowerPrioritiesContent />
        </GameLayout>
    );
}

function PowerPrioritiesContent() {
    const { data: prioritiesData, isLoading, error } = usePowerPriorities();
    const {
        data: statusesData,
        isLoading: statusesLoading,
        error: statusesError,
    } = useFacilityStatuses();
    const { data: facilitiesData } = useFacilities();
    const updatePriorities = useUpdatePowerPriorities();
    const updateElectricityPrices = useUpdateElectricityPrices();

    // Fetch current power data (uses latest available data to prevent UI jitter)
    const { data: productionPowerLevels } = useLatestChartData({
        chartType: "power-sources",
    });
    const { data: consumptionPowerLevels } = useLatestChartData({
        chartType: "power-sinks",
    });

    // Calculate production and consumption capacities separately
    // (storage facilities appear in both!)
    const productionCapacityByType = useMemo(() => {
        if (!facilitiesData) return {};

        const capacities: Record<string, number> = {};

        // Power facilities
        facilitiesData.power_facilities.forEach((facility) => {
            if (!capacities[facility.facility]) {
                capacities[facility.facility] = 0;
            }
            capacities[facility.facility] += facility.max_power_generation;
        });

        // Storage facilities (when generating/discharging)
        facilitiesData.storage_facilities.forEach((facility) => {
            if (!capacities[facility.facility]) {
                capacities[facility.facility] = 0;
            }
            capacities[facility.facility] += facility.max_power_generation;
        });

        return capacities;
    }, [facilitiesData]);

    const consumptionCapacityByType = useMemo(() => {
        if (!facilitiesData) return {};

        const capacities: Record<string, number> = {};

        // Extraction facilities
        facilitiesData.extraction_facilities.forEach((facility) => {
            if (!capacities[facility.facility]) {
                capacities[facility.facility] = 0;
            }
            capacities[facility.facility] += facility.max_power_use;
        });

        // Storage facilities (when charging)
        facilitiesData.storage_facilities.forEach((facility) => {
            if (!capacities[facility.facility]) {
                capacities[facility.facility] = 0;
            }
            capacities[facility.facility] += facility.max_power_use;
        });

        return capacities;
    }, [facilitiesData]);

    // Edit mode state
    const [isEditMode, setIsEditMode] = useState(false);
    const [pendingPriorities, setPendingPriorities] = useState<
        PowerPriorityItem[] | null
    >(null);

    // Track pending price changes for price mode
    const [pendingPriceChanges, setPendingPriceChanges] = useState<
        Map<string, number>
    >(new Map());

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

    // Use pending priorities if in edit mode, otherwise use fetched data
    const currentPriorities = pendingPriorities || power_priorities;

    // Handlers
    const handleEnterEdit = () => {
        setIsEditMode(true);
        setPendingPriorities([...power_priorities]); // Clone for editing
        setPendingPriceChanges(new Map()); // Reset price changes
    };

    const handleCancel = () => {
        setIsEditMode(false);
        setPendingPriorities(null);
        setPendingPriceChanges(new Map());
    };

    const handlePriceChange = (item: PowerPriorityItem, newPrice: number) => {
        const itemKey = getPriorityItemKey(item);
        const newChanges = new Map(pendingPriceChanges);
        newChanges.set(itemKey, newPrice);
        setPendingPriceChanges(newChanges);

        // Update the item in pendingPriorities with the new price
        if (pendingPriorities) {
            const updatedPriorities = pendingPriorities.map((p) =>
                getPriorityItemKey(p) === itemKey
                    ? { ...p, price: newPrice }
                    : p,
            );

            // Re-sort by price to update order (ascending price = higher priority)
            const sorted = [...updatedPriorities].sort(
                (a, b) => a.price - b.price,
            );
            setPendingPriorities(sorted);
        }
    };

    const handleApply = async () => {
        if (!pendingPriorities) return;

        try {
            // if (mode === "drag") {
            //     // Drag mode: update priorities directly
            //     await updatePriorities.mutateAsync({
            //         power_priorities: pendingPriorities,
            //     });
            // } else {
            // Price mode: update prices which will reorder automatically
            const asks = pendingPriorities
                .filter((p) => p.side === "ask")
                .map((p) => ({ type: p.type, price: p.price || 0 }));
            const bids = pendingPriorities
                .filter((p) => p.side === "bid")
                .map((p) => ({ type: p.type, price: p.price || 0 }));

            await updateElectricityPrices.mutateAsync({ asks, bids });
            // }

            setIsEditMode(false);
            setPendingPriorities(null);
            setPendingPriceChanges(new Map());
        } catch (err) {
            console.error("Failed to update priorities:", err);
            alert("Failed to save changes. Please try again.");
        }
    };

    const handleReorder = (newPriorities: PowerPriorityItem[]) => {
        // When reordering, update prices to match the new order
        // Extract all current prices and sort them
        const currentPrices = newPriorities.map((item) => item.price);
        const sortedPrices = [...currentPrices].sort((a, b) => a - b);

        // Assign sorted prices to items in the new order
        const updatedPriorities = newPriorities.map((item, index) => ({
            ...item,
            price: sortedPrices[index],
        }));

        setPendingPriorities(updatedPriorities);
    };

    return (
        <div className="p-4 md:p-8 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div className="grow" />

                {!isEditMode ? (
                    <button
                        onClick={handleEnterEdit}
                        className="px-4 py-2 bg-brand-green hover:bg-brand-green/80 text-white rounded-lg"
                    >
                        Edit
                    </button>
                ) : (
                    <div className="flex gap-2">
                        <button
                            onClick={handleCancel}
                            className="px-4 py-2 bg-gray-300 hover:bg-gray-400 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleApply}
                            disabled={updatePriorities.isPending}
                            className="px-4 py-2 bg-brand-green hover:bg-brand-green/80 text-white rounded-lg disabled:opacity-50"
                        >
                            {updatePriorities.isPending ? "Saving..." : "Apply"}
                        </button>
                    </div>
                )}
            </div>

            {/* Single table showing all items */}
            <PriorityTable
                renewables={renewables}
                isEditMode={isEditMode}
                onReorder={handleReorder}
                onPriceChange={handlePriceChange}
                allPriorities={currentPriorities}
                statuses={statusesData}
                productionPowerLevels={productionPowerLevels}
                consumptionPowerLevels={consumptionPowerLevels}
                productionCapacityByType={productionCapacityByType}
                consumptionCapacityByType={consumptionCapacityByType}
            />
        </div>
    );
}
