/**
 * How far the simulation of a Trading period has got (#1155). The server sends
 * the progress after each day cleared, and the page puts it into its cached
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

type TradingFormat = ApiSchema<"RoundFormat">["trading_format"];

/**
 * What the bar says while the simulation runs. A representative week is cleared
 * twice, for its storage's cyclic start, so its days are not counted.
 */
export function settlementLabel(
    progress: SettlementProgress,
    tradingFormat: TradingFormat,
): string {
    if (tradingFormat === "representative_week")
        return "Simulating the representative week";
    return `Simulating the season: day ${progress.days_done} of ${progress.days_total}`;
}
