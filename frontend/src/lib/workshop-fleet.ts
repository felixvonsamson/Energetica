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
        copies: copies.slice().sort((a, b) => b.rounds_left - a.rounds_left),
    }));
}

/** "2 Rounds", or "1 Round". */
export function roundsLabel(rounds: number): string {
    return `${rounds} ${rounds === 1 ? "Round" : "Rounds"}`;
}

/**
 * "Needs 1 Round to build", for a facility that only starts working Rounds
 * after the one it is bought in, or null for one that works straight away
 * (#1414). Working straight away is the default, so it goes unsaid.
 */
export function constructionLagLabel(lagRounds: number): string | null {
    return lagRounds > 0 ? `Needs ${roundsLabel(lagRounds)} to build` : null;
}

/**
 * What the dialog says before a player adds a facility with a construction lag
 * to their selection (#1414), so nobody is surprised when it produces nothing
 * this Round. A Round is a year, and the text says so.
 */
export function constructionLagWarning(
    name: string,
    lagRounds: number,
): string {
    // Catalog names are in sentence case, so mid-sentence the first letter
    // goes lower case, unless the first word is an acronym like "Gen-IV".
    const noun = /^[A-Z][a-z]*(\s|$)/.test(name)
        ? name[0]!.toLowerCase() + name.slice(1)
        : name;
    const article = /^[aeiou]/i.test(noun) ? "An" : "A";
    const years = lagRounds === 1 ? "one year" : `${lagRounds} years`;
    const idle =
        lagRounds === 1
            ? "this Round"
            : `this Round or the next${lagRounds > 2 ? ` ${lagRounds - 1}` : ""}`;
    const start =
        lagRounds === 1 ? "next Round" : `in ${roundsLabel(lagRounds)}`;
    return `${article} ${noun} needs ${roundsLabel(lagRounds)}, ${years}, to build. If you buy it now, it will not produce any power ${idle}. It starts working ${start}.`;
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
