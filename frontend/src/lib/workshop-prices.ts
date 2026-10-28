/**
 * The prices a Workshop player offers their facilities' power at (#1002): which
 * facility types get a price in the panel, how much of each the player has
 * installed, and reading a price typed into it.
 */

import type { ApiSchema } from "@/types/api-helpers";

type OwnedFacility = ApiSchema<"WorkshopOwnedFacilityOut">;
type FacilityId = ApiSchema<"FacilityId">;
type WorkshopFacility = ApiSchema<"WorkshopFacilityOut">;

/** The lowest and highest prices a player can set, per MWh, both included. */
export type PriceRange = ApiSchema<"WorkshopPriceRangeOut">;

/**
 * The facility types the player has operating, each once, in the order first
 * bought. Only these produce power in the Trading period, so only these need a
 * price.
 */
export function pricedFacilities(fleet: OwnedFacility[]): FacilityId[] {
    return [
        ...new Set(fleet.filter(isOperating).map((owned) => owned.facility)),
    ];
}

/** Whether `owned` works this Round: built, and not yet retired. */
export function isOperating(owned: OwnedFacility): boolean {
    return !owned.under_construction && owned.rounds_left > 0;
}

/** How much of one facility type a player has operating. */
export interface InstalledCapacity {
    /** In W. */
    power: number;
    /** In Wh, or null if the type is not storage. */
    energy: number | null;
}

/**
 * The power, and for storage the energy, of every operating copy of `id` in
 * `fleet`. `facility` is that type's catalog entry.
 */
export function installedCapacity(
    facility: Pick<
        WorkshopFacility,
        "base_power_generation" | "base_storage_capacity"
    >,
    fleet: OwnedFacility[],
    id: FacilityId,
): InstalledCapacity {
    const copies = fleet.filter(
        (owned) => owned.facility === id && isOperating(owned),
    ).length;
    return {
        power: copies * facility.base_power_generation,
        energy:
            facility.base_storage_capacity === null
                ? null
                : copies * facility.base_storage_capacity,
    };
}

/** Why a field does not hold a price the player can set. */
export type InvalidPriceReason =
    | "empty"
    | "invalid"
    | "below_floor"
    | "above_ceiling";

export type ParsedPrice =
    | { ok: true; price: number }
    | { ok: false; reason: InvalidPriceReason };

/** Read a price typed into a field. A field must hold a price within `range`. */
export function parsePrice(text: string, range: PriceRange): ParsedPrice {
    const trimmed = text.trim();
    if (trimmed === "") return { ok: false, reason: "empty" };
    const price = Number(trimmed);
    if (!Number.isFinite(price)) return { ok: false, reason: "invalid" };
    if (price < range.floor) return { ok: false, reason: "below_floor" };
    if (price > range.ceiling) return { ok: false, reason: "above_ceiling" };
    return { ok: true, price };
}
