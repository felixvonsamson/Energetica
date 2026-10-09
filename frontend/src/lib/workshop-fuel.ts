/**
 * The fuel a Workshop player buys each season (#1009): reading a quantity typed
 * into the bids panel, showing a price's change since last season, and telling
 * when an order runs into the stockpile limit.
 *
 * The server counts fuel in kg. Players type and read it in tonnes.
 */

import type { ApiSchema } from "@/types/api-helpers";

type FuelLine = ApiSchema<"WorkshopFuelLineOut">;

export const KG_PER_TONNE = 1_000;

export type ParsedTonnes =
    | { ok: true; kg: number }
    | { ok: false; reason: "empty" | "invalid" | "negative" };

/** Read a quantity typed into a fuel field, in tonnes, as kg. */
export function parseTonnes(text: string): ParsedTonnes {
    const trimmed = text.trim();
    if (trimmed === "") return { ok: false, reason: "empty" };
    const tonnes = Number(trimmed);
    if (!Number.isFinite(tonnes)) return { ok: false, reason: "invalid" };
    if (tonnes < 0) return { ok: false, reason: "negative" };
    return { ok: true, kg: tonnes * KG_PER_TONNE };
}

/**
 * `kg` as a fuel field shows it: tonnes, to the nearest kg. Uranium is bought
 * by the kg, so anything coarser would hide most of an order.
 */
export function tonnesFieldText(kg: number): string {
    return String(Number((kg / KG_PER_TONNE).toFixed(3)));
}

/** How many seasons at full output the stockpile limit holds, such as 3. */
export function stockpileSeasons(
    line: Pick<FuelLine, "season_need" | "stockpile_limit">,
): number {
    return line.season_need > 0
        ? Math.round(line.stockpile_limit / line.season_need)
        : 0;
}

/**
 * A price's change since last season, such as "+15%" or "−8%", or null in the
 * first season, which has nothing to compare with.
 */
export function formatPriceChange(change: number | null): string | null {
    if (change === null) return null;
    const percent = Math.round(change * 100);
    if (percent === 0) return "0%";
    return percent > 0 ? `+${percent}%` : `−${-percent}%`;
}

/**
 * Whether ordering `kg` would take the stock over the stockpile limit, so the
 * server cuts the order down.
 */
export function isOverStockpile(
    kg: number,
    line: Pick<FuelLine, "stock" | "stockpile_limit">,
): boolean {
    return kg > 0 && kg > line.stockpile_limit - line.stock;
}
