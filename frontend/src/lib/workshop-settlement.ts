/**
 * How far the simulation of a Trading period has got (#1155). The server sends
 * the progress after each simulated day, and the page puts it into its cached
 * session rather than re-reading the whole session.
 */

import type { ApiSchema } from "@/types/api-helpers";

type WorkshopSession = ApiSchema<"WorkshopSessionOut">;
type SettlementProgress = ApiSchema<"WorkshopSettlementOut">;

/**
 * `session` with `progress` as its running simulation. A progress older than
 * the one the session already has, such as one a slower read brought back, is
 * left out, so the bar never moves back.
 */
export function withSettlementProgress(
    session: WorkshopSession | undefined,
    progress: SettlementProgress,
): WorkshopSession | undefined {
    if (!session) return session;
    const current = session.settlement;
    if (
        current &&
        current.days_total === progress.days_total &&
        current.days_done >= progress.days_done
    ) {
        return session;
    }
    return { ...session, settlement: progress };
}

/** What the bar says while the simulation runs. */
export function settlementLabel(progress: SettlementProgress): string {
    // A representative day is over too quickly for a day count to help.
    if (progress.days_total === 1) return "Simulating the representative day";
    return `Simulating the season: day ${progress.days_done} of ${progress.days_total}`;
}
