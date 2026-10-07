/**
 * How far the simulation of a Trading period has got (#1155). The server sends
 * the progress after each simulated day, and the page puts it into its cached
 * session rather than re-reading the whole session.
 */

import type { ApiSchema } from "@/types/api-helpers";

type WorkshopSession = ApiSchema<"WorkshopSessionOut">;
type SettlementProgress = ApiSchema<"WorkshopSettlementOut">;

/**
 * `session` with `progress` as its running simulation. A run that failed starts
 * again from day 0, so the progress can go down as well as up.
 */
export function withSettlementProgress(
    session: WorkshopSession | undefined,
    progress: SettlementProgress,
): WorkshopSession | undefined {
    return session && { ...session, settlement: progress };
}

/** Whether `progress` is a representative-day run, which has no days to count. */
export function isRepresentativeDay(progress: SettlementProgress): boolean {
    return progress.days_total === 1;
}

/** What the bar says while the simulation runs. */
export function settlementLabel(progress: SettlementProgress): string {
    if (isRepresentativeDay(progress))
        return "Simulating the representative day";
    return `Simulating the season: day ${progress.days_done} of ${progress.days_total}`;
}
