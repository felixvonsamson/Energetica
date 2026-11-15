/**
 * The figures a Workshop player sees when hovering a metric (#1400), worked out
 * from the raw values the game already shows, so players get the result without
 * doing the maths. Marginal cost is deliberately left out: players add up the
 * costs per MWh themselves.
 */

import type { FacilityCardData } from "#facility-cards/lib/facility-card-data";

const WH_PER_MWH = 1_000_000;

/**
 * What the fuel a facility burns costs per MWh it generates, in coins, at a
 * price per kg.
 */
export function fuelCostPerMWh(kgPerMWh: number, pricePerKg: number): number {
    return kgPerMWh * pricePerKg;
}

/** The carbon tax a facility pays per MWh, in coins, at a rate per kg of CO₂. */
export function carbonTaxPerMWh(kgPerMWh: number, ratePerKg: number): number {
    return kgPerMWh * ratePerKg;
}

/** What the carbon tax charges per tonne of CO₂, from its rate per kg. */
export function taxPerTonne(ratePerKg: number): number {
    return Math.round(ratePerKg * 1000);
}

/**
 * How much higher a storage facility's sell price must be than its buy price
 * for it to make a profit, as a share: 0.25 is 25%. Storing 1 MWh gives back
 * only `efficiency` MWh to sell.
 */
export function storageMarkup(efficiency: number): number {
    return 1 / efficiency - 1;
}

/**
 * The most fuel a facility burns in a season, in kg: a season at full output,
 * in Wh, at its fuel use per MWh.
 */
export function maxFuelPerSeason(
    fullOutputPerSeason: number,
    kgPerMWh: number,
): number {
    return (fullOutputPerSeason / WH_PER_MWH) * kgPerMWh;
}

/**
 * The first and last Rounds a facility bought in `builtRound` works in: from
 * the end of its construction lag, for its whole lifetime.
 */
export function workingRounds(
    builtRound: number,
    facility: Pick<
        FacilityCardData,
        "construction_lag_rounds" | "lifetime_rounds"
    >,
): { first: number; last: number } {
    const first = builtRound + facility.construction_lag_rounds;
    return { first, last: first + facility.lifetime_rounds - 1 };
}
