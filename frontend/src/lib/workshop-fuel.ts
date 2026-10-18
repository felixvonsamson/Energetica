/**
 * The fuel a Workshop player buys each season (#1009): reading a quantity typed
 * into the bids panel, showing a price's change since last season, and telling
 * when an order runs into the stockpile limit.
 *
 * The server counts fuel in kg. Players type gas and coal in kilotonnes and
 * uranium in tonnes.
 */

import coal from "@/assets/fuels/coal.svg";
import gas from "@/assets/fuels/gas.svg";
import uranium from "@/assets/fuels/uranium.svg";
import { assetCSSColourVariable } from "@/lib/assets/asset-colors";
import type { ApiSchema } from "@/types/api-helpers";

type Fuel = ApiSchema<"Fuel">;
type FuelLine = ApiSchema<"WorkshopFuelLineOut">;

/** Each fuel's image in the bids panel. These are placeholders for now. */
export const workshopFuelImages: Record<Fuel, string> = { coal, gas, uranium };

/**
 * The fuel's colour, the same one the charts use. Each fuel has an
 * `--asset-color-*` token in `global.css`.
 */
export function workshopFuelColor(fuel: Fuel): string {
    return assetCSSColourVariable(fuel);
}

export const KG_PER_TONNE = 1_000;

/**
 * The unit each fuel's order field takes. Gas and coal are bought by the
 * thousand tonnes. Uranium is bought by the kg, so a coarser unit would hide
 * most of an order.
 */
const FIELD_UNITS: Record<Fuel, { label: string; kg: number }> = {
    gas: { label: "kt", kg: 1_000_000 },
    coal: { label: "kt", kg: 1_000_000 },
    uranium: { label: "t", kg: KG_PER_TONNE },
};

/** The unit beside a fuel's order field, "kt" or "t". */
export function fuelFieldUnit(fuel: Fuel): string {
    return FIELD_UNITS[fuel].label;
}

export type ParsedQuantity =
    | { ok: true; kg: number }
    | { ok: false; reason: "empty" | "invalid" | "negative" };

/**
 * Read a quantity typed into a fuel's order field, in the field's unit, as kg
 * to the nearest kg. Thousands separators, an apostrophe or a space, are
 * ignored.
 */
export function parseFuelQuantity(text: string, fuel: Fuel): ParsedQuantity {
    const trimmed = text.replace(/['\s]/g, "");
    if (trimmed === "") return { ok: false, reason: "empty" };
    const quantity = Number(trimmed);
    if (!Number.isFinite(quantity)) return { ok: false, reason: "invalid" };
    if (quantity < 0) return { ok: false, reason: "negative" };
    return { ok: true, kg: Math.round(quantity * FIELD_UNITS[fuel].kg) };
}

/**
 * `kg` as a fuel's order field shows it: in the field's unit, to three
 * decimals, with thousands separated by an apostrophe as elsewhere in the
 * game.
 */
export function fuelFieldText(kg: number, fuel: Fuel): string {
    const [whole = "0", fraction] = String(
        Number((kg / FIELD_UNITS[fuel].kg).toFixed(3)),
    ).split(".");
    const separated = whole.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
    return fraction === undefined ? separated : `${separated}.${fraction}`;
}

/**
 * `kg` rounded to the quantity its fuel's field shows. Typing back what the
 * field shows gives this, rather than the exact order.
 */
export function shownQuantity(kg: number, fuel: Fuel): number {
    const parsed = parseFuelQuantity(fuelFieldText(kg, fuel), fuel);
    return parsed.ok ? parsed.kg : kg;
}

/**
 * The season's price per unit of the fuel's order field, so it reads in the
 * same unit as the quantity beside it.
 */
export function fieldPrice(line: Pick<FuelLine, "fuel" | "price">): number {
    return line.price * FIELD_UNITS[line.fuel].kg;
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
 * How much the player can still order before the stock reaches the stockpile
 * limit, in kg. The server cuts a larger order down to this.
 */
function stockpileRoom(
    line: Pick<FuelLine, "stock" | "stockpile_limit">,
): number {
    return Math.max(0, line.stockpile_limit - line.stock);
}

/**
 * Whether ordering `kg` would take the stock over the stockpile limit, so the
 * server cuts the order down.
 */
export function isOverStockpile(
    kg: number,
    line: Pick<FuelLine, "stock" | "stockpile_limit">,
): boolean {
    return kg > 0 && kg > stockpileRoom(line);
}

/**
 * What an order of `kg` costs, in coins: the quantity the server keeps once it
 * cuts the order down to the stockpile limit, at the season's price. This is
 * what the player pays when the Trading period is settled.
 */
export function orderCost(
    kg: number,
    line: Pick<FuelLine, "price" | "stock" | "stockpile_limit">,
): number {
    return Math.min(kg, stockpileRoom(line)) * line.price;
}
