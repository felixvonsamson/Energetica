/**
 * The room's prices for a Trading period (#1299): every player's prices, shown
 * like a trading board with one column per facility type and an arrow for how
 * each price moved since the last period it ran in.
 */

import type { ApiSchema } from "@/types/api-helpers";

type FacilityId = ApiSchema<"FacilityId">;
type PlayerQuotes = ApiSchema<"PlayerQuotes">;
type QuotedPrice = ApiSchema<"QuotedPrice">;

/**
 * How a price compares with the one its facility type ran at in the player's
 * last Trading period with it. A type that ran in no earlier period is new.
 */
export type PriceTrend = "up" | "down" | "unchanged" | "new";

export function priceTrend({ price, previous }: QuotedPrice): PriceTrend {
    if (previous === null) return "new";
    if (price > previous) return "up";
    if (price < previous) return "down";
    return "unchanged";
}

/** One column of the board: a facility type's sell or buy price. */
export interface MarketColumn {
    facility: FacilityId;
    side: "sell" | "buy";
}

/**
 * The board's columns: each facility type at least one player has a price for,
 * in `facilityOrder`, with a buy column after the sell column of storage.
 */
export function marketColumns(
    players: Pick<PlayerQuotes, "sell" | "buy">[],
    facilityOrder: FacilityId[],
): MarketColumn[] {
    const has = (side: MarketColumn["side"], facility: FacilityId) =>
        players.some((player) => player[side][facility] !== undefined);
    return facilityOrder.flatMap((facility) =>
        (["sell", "buy"] as const)
            .filter((side) => has(side, facility))
            .map((side) => ({ facility, side })),
    );
}
