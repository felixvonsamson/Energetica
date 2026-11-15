/**
 * When a facility bought next is bought in. The figures the facility cards show
 * live in `@energetica/facility-cards/lib/facility-metrics`.
 */

import type { ApiSchema } from "@/types/api-helpers";

type Checkpoint = ApiSchema<"WorkshopSessionOut">["checkpoint"];

/**
 * The Round a facility bought next is bought in: the current one while its
 * Investment phase is open, else the next one, or null once no Round is left.
 */
export function nextBuyRound(
    checkpoint: Checkpoint,
    roundCount: number,
): number | null {
    const round =
        checkpoint.kind === "not_started"
            ? 1
            : checkpoint.kind === "finished"
              ? null
              : checkpoint.kind === "investment"
                ? checkpoint.round
                : checkpoint.round + 1;
    return round !== null && round <= roundCount ? round : null;
}
