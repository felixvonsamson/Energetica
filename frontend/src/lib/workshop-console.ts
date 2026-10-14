/**
 * What the facilitator's lever console (#1018) shows: which Round it opens on,
 * which later Rounds a lever change carried to, and why a change was refused.
 */

import { ApiClientError, isGameError } from "@/lib/api-client";
import { resolveErrorMessage } from "@/lib/game-messages";
import type { ApiSchema } from "@/types/api-helpers";

type WorkshopPlans = ApiSchema<"WorkshopPlansOut">;

/**
 * The Round the console opens on: the earliest one whose plan can still change.
 * That is Round N+1 during Round N, and Round N+2 from Recap N. Once every plan
 * is locked, the last Round.
 */
export function consoleRound(plans: WorkshopPlans): number {
    const open = plans.rounds.find((plan) => !plan.locked);
    return open?.round ?? plans.rounds.length;
}

type RoundLevers = ApiSchema<"RoundLevers">;

function sameLevers(a: RoundLevers, b: RoundLevers): boolean {
    return (
        a.round_format.trading_format === b.round_format.trading_format &&
        a.round_format.clearings_per_day === b.round_format.clearings_per_day &&
        a.round_format.storage === b.round_format.storage &&
        a.fuel_procurement === b.fuel_procurement &&
        a.carbon_tax_vote === b.carbon_tax_vote
    );
}

/**
 * The Rounds after `round` whose levers a change to `round` also changed, by
 * comparing every plan before the change with every plan after it. A later
 * Round that already held the new value did not change, so it is left out.
 */
export function carriedRounds(
    before: WorkshopPlans,
    after: WorkshopPlans,
    round: number,
): number[] {
    return after.rounds
        .filter((plan) => {
            const previous = before.rounds[plan.round - 1];
            return (
                plan.round > round &&
                previous !== undefined &&
                !sameLevers(previous.levers, plan.levers)
            );
        })
        .map((plan) => plan.round);
}

/**
 * The note shown after a change carried to later Rounds, such as "Also applied
 * to Rounds 4–6.", with consecutive Rounds joined into a range. `null` when no
 * other Round changed.
 */
export function carriedNote(rounds: number[]): string | null {
    const first = rounds[0];
    if (first === undefined) return null;
    if (rounds.length === 1) return `Also applied to Round ${first}.`;

    const ranges: [number, number][] = [];
    for (const round of rounds) {
        const last = ranges[ranges.length - 1];
        if (last && round === last[1] + 1) last[1] = round;
        else ranges.push([round, round]);
    }
    const parts = ranges.map(([start, end]) =>
        start === end ? `${start}` : `${start}–${end}`,
    );
    return `Also applied to Rounds ${parts.join(", ")}.`;
}

/**
 * Why a lever change was refused. A change that would leave a Round invalid
 * names that Round, which may be a later one the change carries to.
 */
export function leverChangeError(error: unknown): string {
    if (
        error instanceof ApiClientError &&
        isGameError(error.detail) &&
        error.detail.game_exception_type === "WORKSHOP_LEVERS_INVALID" &&
        typeof error.detail.kwargs?.round === "number"
    ) {
        return `This change would leave Round ${error.detail.kwargs.round} invalid: every storage type needs the full-season format.`;
    }
    return resolveErrorMessage(error);
}
