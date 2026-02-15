/** Power Priorities page - Manage production and consumption priorities. */

import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";

import { GameLayout } from "@/components/layout/game-layout";
import { PriorityTable } from "@/components/power-priorities/priority-table";
import type { PowerPriorityItem } from "@/components/power-priorities/types";
import { useLatestChartDataSlice } from "@/hooks/use-charts";
import { useFacilityStatuses, useFacilities } from "@/hooks/use-facilities";
import {
    usePowerPriorities,
    useUpdateElectricityPrices,
} from "@/hooks/use-power-priorities";
import { getPriorityItemKey } from "@/lib/power-priorities-utils";

function PowerPrioritiesHelp() {
    return (
        <div className="space-y-3">
            <p>
                Here you can set the priority of your facilities to determine
                the order in which they will be used to satisfy your demand.
            </p>
            <p>
                Use the ↑ / ↓ buttons on each row to change its priority.
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
        infoDialog: {
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
    const updateElectricityPrices = useUpdateElectricityPrices();

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
     * Bumps an item one step up or down in the visual table by swapping it with
     * its neighbour in allPriorities, then redistributing prices so the order
     * is preserved on the backend (which sorts by price ascending).
     */
    const handleBump = async (
        item: PowerPriorityItem,
        direction: "up" | "down",
    ) => {
        const idx = power_priorities.findIndex(
            (p) => getPriorityItemKey(p) === getPriorityItemKey(item),
        );
        if (idx === -1) return;

        // "up" in the visual table = move to higher allPriorities index (lower priority).
        // "down" = lower allPriorities index (higher priority).
        const neighbourIdx = direction === "up" ? idx + 1 : idx - 1;
        if (neighbourIdx < 0 || neighbourIdx >= power_priorities.length) return;

        // Swap the two items
        const reordered = [...power_priorities];
        const a = reordered[idx]!;
        const b = reordered[neighbourIdx]!;
        reordered[idx] = b;
        reordered[neighbourIdx] = a;

        // Redistribute existing prices to match the new order so the backend
        // stores them in the intended sequence.
        const sortedPrices = [...reordered.map((p) => p.price)].sort(
            (a, b) => a - b,
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
    const handlePriceCommit = async (
        item: PowerPriorityItem,
        newPrice: number,
    ) => {
        const key = getPriorityItemKey(item);
        const updated = power_priorities.map((p) =>
            getPriorityItemKey(p) === key ? { ...p, price: newPrice } : p,
        );
        // Sort by price ascending so the cheapest item has highest priority
        const sorted = [...updated].sort((a, b) => a.price - b.price);
        await submitPrices(sorted);
    };

    return (
        <div className="p-4 md:p-8 space-y-6">
            <PriorityTable
                renewables={renewables}
                onBump={handleBump}
                onPriceCommit={handlePriceCommit}
                isMutating={updateElectricityPrices.isPending}
                allPriorities={power_priorities}
                statuses={statusesData}
                productionPowerLevels={productionPowerLevels}
                consumptionPowerLevels={consumptionPowerLevels}
                productionCapacityByType={productionCapacityByType}
                consumptionCapacityByType={consumptionCapacityByType}
            />
        </div>
    );
}
