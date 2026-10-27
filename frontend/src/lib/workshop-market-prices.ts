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
 * last Trading period with it. A type that ran in no earlier period, as in the
 * very first one, is compared with its default price instead.
 */
export type PriceTrend = "up" | "down" | "unchanged";

export function priceTrend({
    price,
    previous,
    default: base,
}: QuotedPrice): PriceTrend {
    const reference = previous ?? base;
    if (price > reference) return "up";
    if (price < reference) return "down";
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

/**
 * What happens when a player clicks their own row on the board (#1388). The
 * board cannot be edited, so players who try are sent to the price panel. While
 * the price-setting window is open, the panel opens and the message says where
 * to find it again. Otherwise prices cannot be changed, and the message says
 * so.
 */
export function ownRowClick(windowOpen: boolean): {
    openPanel: boolean;
    message: string;
} {
    if (windowOpen) {
        return {
            openPanel: true,
            message:
                "This board only shows prices. Set yours in the price panel, which opens with the Prices button at the top right of the screen.",
        };
    }
    return {
        openPanel: false,
        message:
            "The price-setting window is closed, so prices cannot be changed now. When it opens, set yours with the Prices button at the top right of the screen.",
    };
}
