/** Utility functions for power priorities business logic. */

import type { PowerPriorityItem } from "@/components/power-priorities/types";

/** Storage facility types that can charge and discharge */
const STORAGE_FACILITY_TYPES = [
    "small_pumped_hydro",
    "molten_salt",
    "large_pumped_hydro",
    "hydrogen_storage",
    "lithium_ion_batteries",
    "solid_state_batteries",
] as const;

/**
 * Validates that battery discharge (ask) is not placed below battery charge
 * (bid) in the unified priority list.
 *
 * @param priorities - The unified priority array
 * @returns True if valid, false if any battery has discharge below charge
 */
export function validateBatteryOrder(priorities: PowerPriorityItem[]): boolean {
    for (const storageType of STORAGE_FACILITY_TYPES) {
        const dischargeIdx = priorities.findIndex(
            (p) => p.type === storageType && p.side === "ask",
        );
        const chargeIdx = priorities.findIndex(
            (p) => p.type === storageType && p.side === "bid",
        );

        // Invalid: discharge (ask) must not be AFTER charge (bid) in priority list
        // Lower index = higher priority
        if (
            dischargeIdx !== -1 &&
            chargeIdx !== -1 &&
            dischargeIdx > chargeIdx
        ) {
            return false;
        }
    }

    return true;
}

/**
 * Gets the display name for a power priority item. Handles special cases like
 * transport/construction/research and storage suffixes.
 *
 * @param item - The power priority item
 * @returns The display name
 */
export function getPriorityItemDisplayName(item: PowerPriorityItem): string {
    const { type, side } = item;

    // Storage facilities need (charge) / (discharge) suffix
    if ((STORAGE_FACILITY_TYPES as readonly string[]).includes(type)) {
        const suffix = side === "ask" ? " (discharge)" : " (charge)";
        // The AssetName component will handle the base name
        return suffix;
    }

    return "";
}

/**
 * Checks if a facility type is a storage facility.
 *
 * @param type - The facility type
 * @returns True if it's a storage facility
 */
export function isStorageFacility(type: string): boolean {
    return (STORAGE_FACILITY_TYPES as readonly string[]).includes(type);
}

/**
 * Gets ghost items (items from the opposite side) to display in View All mode.
 *
 * @param allPriorities - The complete unified priority array
 * @param currentSide - The current table's side ("ask" for production, "bid"
 *   for consumption)
 * @param showViewAll - Whether View All mode is enabled
 * @returns Array of items from the opposite side
 */
export function getGhostItems(
    allPriorities: PowerPriorityItem[],
    currentSide: "ask" | "bid",
    showViewAll: boolean,
): PowerPriorityItem[] {
    if (!showViewAll) return [];

    const oppositeSide = currentSide === "ask" ? "bid" : "ask";
    return allPriorities.filter((p) => p.side === oppositeSide);
}

/**
 * Gets all items for a table including ghost items, maintaining their relative
 * order from the unified priority array.
 *
 * @param allPriorities - The complete unified priority array
 * @param currentSide - The current table's side
 * @param showViewAll - Whether to include ghost items
 * @returns Array of items with isGhost flag
 */
export function getInterleavedItems(
    allPriorities: PowerPriorityItem[],
    currentSide: "ask" | "bid",
    showViewAll: boolean,
): Array<PowerPriorityItem & { isGhost: boolean }> {
    let items;

    if (!showViewAll) {
        // Only show items from current side
        items = allPriorities
            .filter((p) => p.side === currentSide)
            .map((p) => ({ ...p, isGhost: false }));
    } else {
        // Show all items with ghost flag
        items = allPriorities.map((p) => ({
            ...p,
            isGhost: p.side !== currentSide,
        }));
    }

    // Reverse for consumption side to match display order
    // (consumption items are displayed in reverse priority order)
    if (currentSide === "bid") {
        return items.reverse();
    }

    return items;
}

/**
 * Creates a unique key for a power priority item.
 *
 * @param item - The power priority item
 * @returns A unique string key
 */
export function getPriorityItemKey(item: PowerPriorityItem): string {
    return `${item.side}-${item.type}`;
}
