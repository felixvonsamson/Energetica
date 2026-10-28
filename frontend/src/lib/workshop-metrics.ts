/**
 * The figures a Workshop player sees when hovering a metric (#1400), worked out
 * from the raw values the game already shows, so players get the result without
 * doing the maths. Marginal cost is deliberately left out: players add up the
 * costs per MWh themselves.
 */

import { isOperating } from "@/lib/workshop-prices";
import type { ApiSchema } from "@/types/api-helpers";

type Checkpoint = ApiSchema<"WorkshopSessionOut">["checkpoint"];
type Fuel = ApiSchema<"Fuel">;
type FacilityId = ApiSchema<"FacilityId">;
type OwnedFacility = ApiSchema<"WorkshopOwnedFacilityOut">;
type WorkshopFacility = ApiSchema<"WorkshopFacilityOut">;

/** The fuel a facility burns per MWh, in coins, at a price per kg. */
export function fuelCostPerMWh(kgPerMWh: number, pricePerKg: number): number {
    return kgPerMWh * pricePerKg;
}

/** The carbon tax a facility pays per MWh, in coins, at a rate per kg of CO₂. */
export function carbonTaxPerMWh(kgPerMWh: number, ratePerKg: number): number {
    return kgPerMWh * ratePerKg;
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
 * The energy a weather-dependent facility generates in an average season, in
 * Wh: a season at full output, in Wh, at its capacity factor.
 */
export function expectedGenerationPerSeason(
    fullOutputPerSeason: number,
    capacityFactor: number,
): number {
    return fullOutputPerSeason * capacityFactor;
}

/** What the operating copies of one facility type burn in a season. */
export interface FuelNeed {
    facility: FacilityId;
    count: number;
    /** In kg, at full output for the whole season. */
    need: number;
}

/**
 * What each facility type in `fleet` burning `fuel` burns in a season at full
 * output, counting only the copies operating this Round, in the order the types
 * were first bought. Together they make the season need the server starts the
 * fuel order from.
 */
export function fuelNeedByFacility(
    fuel: Fuel,
    facilities: Pick<
        WorkshopFacility,
        "id" | "fuel_type" | "fuel_use" | "full_output_per_season"
    >[],
    fleet: OwnedFacility[],
): FuelNeed[] {
    const needs = new Map<FacilityId, FuelNeed>();
    for (const owned of fleet.filter(isOperating)) {
        const facility = facilities.find((f) => f.id === owned.facility);
        if (facility?.fuel_type !== fuel || facility.fuel_use === null)
            continue;
        const line = needs.get(facility.id) ?? {
            facility: facility.id,
            count: 0,
            need: 0,
        };
        line.count += 1;
        line.need +=
            (facility.full_output_per_season / WH_PER_MWH) * facility.fuel_use;
        needs.set(facility.id, line);
    }
    return [...needs.values()];
}

const WH_PER_MWH = 1_000_000;

/**
 * The first and last Rounds a facility bought in `builtRound` works in: from
 * the end of its construction lag, for its whole lifetime.
 */
export function workingRounds(
    builtRound: number,
    facility: Pick<
        WorkshopFacility,
        "construction_lag_rounds" | "lifetime_rounds"
    >,
): { first: number; last: number } {
    const first = builtRound + facility.construction_lag_rounds;
    return { first, last: first + facility.lifetime_rounds - 1 };
}

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

/**
 * A facility's price spread over each MW of its power and each Round of its
 * lifetime, in coins, so facilities of different sizes and lifetimes compare.
 * `power` is in W.
 */
export function pricePerMWPerRound(
    price: number,
    power: number,
    lifetimeRounds: number,
): number {
    return price / (power / W_PER_MW) / lifetimeRounds;
}

const W_PER_MW = 1_000_000;
