/**
 * Grouping a Workshop player's fleet into stacks of cards (#998). Several
 * copies of one facility show as one stack, which opens to list how long each
 * copy has left.
 */

import type { ApiSchema } from "@/types/api-helpers";

type OwnedFacility = ApiSchema<"WorkshopOwnedFacilityOut">;
type FacilityId = ApiSchema<"FacilityId">;

export interface FleetStack {
    facility: FacilityId;
    /** Every copy, the one with the most lifetime left first. */
    copies: OwnedFacility[];
}

/**
 * One stack per facility, in the order each was first bought. The copy with the
 * most lifetime left is on top.
 */
export function fleetStacks(fleet: OwnedFacility[]): FleetStack[] {
    const stacks = new Map<FacilityId, OwnedFacility[]>();
    for (const owned of fleet) {
        const copies = stacks.get(owned.facility);
        if (copies) copies.push(owned);
        else stacks.set(owned.facility, [owned]);
    }
    return [...stacks].map(([facility, copies]) => ({
        facility,
        copies: copies.toSorted((a, b) => b.rounds_left - a.rounds_left),
    }));
}

/** "2 Rounds", or "1 Round". */
export function roundsLabel(rounds: number): string {
    return `${rounds} ${rounds === 1 ? "Round" : "Rounds"}`;
}

/**
 * The lifetime left across a stack, longest first, such as "2–1 Rounds", or a
 * single figure when every copy has the same left.
 */
export function lifetimeRangeLabel(copies: OwnedFacility[]): string {
    const left = copies.map((copy) => copy.rounds_left);
    const longest = Math.max(...left);
    const shortest = Math.min(...left);
    if (longest === shortest) return roundsLabel(longest);
    return `${longest}–${shortest} Rounds`;
}
