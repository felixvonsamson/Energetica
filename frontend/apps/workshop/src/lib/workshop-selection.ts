/**
 * Laying out a Workshop player's investment selection (#999, #1272): copies of
 * one facility form a stack, and the stacks share one row.
 */

import type { ApiSchema } from "@/types/api-helpers";

type FacilityId = ApiSchema<"FacilityId">;

export interface SelectionStack {
    facility: FacilityId;
    /** How many copies of the facility are picked. */
    count: number;
}

/** One stack per facility, in the order each was first picked. */
export function selectionStacks(selection: FacilityId[]): SelectionStack[] {
    const counts = new Map<FacilityId, number>();
    for (const id of selection) counts.set(id, (counts.get(id) ?? 0) + 1);
    return [...counts].map(([facility, count]) => ({ facility, count }));
}

/**
 * The left margin of every stack after the first, for stacks `widths` wide in a
 * row `rowWidth` wide: `gap` while they all fit side by side, and a negative
 * margin that overlaps them just enough to fit once they do not. The row never
 * grows wider than `rowWidth`, so a phone never scrolls sideways; there are few
 * enough kinds of facility that each stack still shows a sliver.
 */
export function overlapMargin(
    widths: number[],
    rowWidth: number,
    gap: number,
): number {
    const count = widths.length;
    const total = widths.reduce((sum, width) => sum + width, 0);
    if (count < 2 || total + (count - 1) * gap <= rowWidth) return gap;
    return (rowWidth - total) / (count - 1);
}
