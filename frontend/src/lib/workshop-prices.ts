/**
 * The prices a Workshop player offers their facilities' power at (#1002): which
 * facility types get a price in the panel, and reading a price typed into it.
 */

import type { ApiSchema } from "@/types/api-helpers";

type OwnedFacility = ApiSchema<"WorkshopOwnedFacilityOut">;
type FacilityId = ApiSchema<"FacilityId">;

/**
 * The facility types the player has operating, each once, in the order first
 * bought. Only these produce power in the Trading period, so only these need a
 * price.
 */
export function pricedFacilities(fleet: OwnedFacility[]): FacilityId[] {
    const operating = fleet
        .filter((owned) => !owned.under_construction && owned.rounds_left > 0)
        .map((owned) => owned.facility);
    return [...new Set(operating)];
}

export type ParsedPrice =
    | { ok: true; price: number }
    | { ok: false; reason: "empty" | "invalid" | "below_floor" };

/**
 * Read a price typed into a field. A field must hold a price at or above
 * `floor`.
 */
export function parsePrice(text: string, floor: number): ParsedPrice {
    const trimmed = text.trim();
    if (trimmed === "") return { ok: false, reason: "empty" };
    const price = Number(trimmed);
    if (!Number.isFinite(price)) return { ok: false, reason: "invalid" };
    if (price < floor) return { ok: false, reason: "below_floor" };
    return { ok: true, price };
}
