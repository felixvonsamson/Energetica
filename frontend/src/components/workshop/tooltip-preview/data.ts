/**
 * Made-up data for the tooltip preview page: a session, a vote, fuel, a
 * scoreboard and a balance sheet that between them reach every tooltip and
 * every case of the balance sheet's volume and rate tooltips.
 */

import type { BalanceSheet, PeriodSheet } from "@/lib/workshop-balance-sheet";
import type { ApiSchema } from "@/types/api-helpers";

type FacilityId = ApiSchema<"FacilityId">;
type Fuel = ApiSchema<"Fuel">;

/** The session in Round 2's Investment phase, with or without a carbon tax. */
export function previewSession(
    taxInForce: boolean,
): ApiSchema<"WorkshopSessionOut"> {
    return {
        checkpoint: { kind: "investment", round: 2 },
        round_count: 5,
        carbon_tax_since: taxInForce ? 2 : null,
    } as unknown as ApiSchema<"WorkshopSessionOut">;
}

export const PREVIEW_VOTE: ApiSchema<"WorkshopVoteOut"> = {
    round: 2,
    held: true,
    tax_rate: 0.025,
    ballot: null,
    passed: null,
};

export const PREVIEW_ENTRY = {
    role: "player",
    player: { account_id: 1, username: "alice", team: "Red" },
} as unknown as ApiSchema<"WorkshopEntryOut">;

/**
 * Coal burned and shocked, which ran out last season; gas burned; uranium not
 * burned. Under manual procurement, so the Buy field shows.
 */
export const PREVIEW_FUEL: ApiSchema<"WorkshopFuelOut"> = {
    procurement: "manual",
    fuels: [
        {
            fuel: "coal",
            name: "Coal",
            burned: true,
            price: 0.132,
            change: 0.42,
            shocked: true,
            stock: 1_200_000,
            season_need: 30_576_000,
            need_by_facility: [],
            stockpile_limit: 91_728_000,
            order: 29_376_000,
            ran_out: true,
        },
        {
            fuel: "gas",
            name: "Gas",
            burned: true,
            price: 0.231,
            change: -0.08,
            shocked: false,
            stock: 0,
            season_need: 21_840_000,
            need_by_facility: [],
            stockpile_limit: 65_520_000,
            order: 21_840_000,
            ran_out: false,
        },
        {
            fuel: "uranium",
            name: "Uranium",
            burned: false,
            price: 250,
            change: 0.03,
            shocked: false,
            stock: 0,
            season_need: 0,
            need_by_facility: [],
            stockpile_limit: 0,
            order: null,
            ran_out: false,
        },
    ],
};

/** A Run with teams and a bonus multiplier, so every header has its tooltip. */
export const PREVIEW_SCOREBOARD: ApiSchema<"Scoreboard"> = {
    completed_rounds: 2,
    final: false,
    scores: [
        score(1, "alice", "Red", 1_840_000, 900_000, 60_000, 520_000),
        score(2, "bob", "Blue", 1_510_000, 700_000, 20_000, 410_000),
        score(3, "carol", "Red", 1_200_000, 850_000, 90_000, 610_000),
    ],
    teams: [
        {
            name: "Red",
            account_ids: [1, 3],
            operating_profit: 3_040_000,
            investments: 1_750_000,
            carbon_tax: 150_000,
            residual_value: 1_130_000,
            bonus_multiplier: 1.1,
            score: 2_497_000,
        },
        {
            name: "Blue",
            account_ids: [2],
            operating_profit: 1_510_000,
            investments: 700_000,
            carbon_tax: 20_000,
            residual_value: 410_000,
            bonus_multiplier: 1,
            score: 1_200_000,
        },
    ],
};

function score(
    account_id: number,
    username: string,
    team: string,
    operating_profit: number,
    investments: number,
    carbon_tax: number,
    residual_value: number,
): ApiSchema<"Score"> {
    return {
        account_id,
        username,
        team,
        operating_profit,
        investments,
        carbon_tax,
        residual_value,
        score: operating_profit - investments - carbon_tax + residual_value,
    };
}

// --- Balance sheet ----------------------------------------------------------

const NAMES: Partial<Record<FacilityId, string>> = {
    onshore_wind_turbine: "Onshore wind turbine",
    coal_burner: "Coal burner",
    gas_burner: "Gas burner",
    lithium_ion_batteries: "Lithium-ion batteries",
};

const FUEL_NAMES: Record<Fuel, string> = {
    coal: "Coal",
    gas: "Gas",
    uranium: "Uranium",
};

/** One facility type's season, in MWh and kg; the sheet works out the rest. */
interface FacilitySeason {
    facility: FacilityId;
    count: number;
    sold: [mwh: number, amount: number];
    bought?: [mwh: number, amount: number];
    dumped?: [mwh: number, amount: number];
    omFixed: number;
    omVariableFull: number;
    usage: number;
    fuel?: { fuel: Fuel; bought: number; fromStock: number; price: number };
}

interface SeasonInput {
    facilities: FacilitySeason[];
    /** Fuel bought beyond what was burned, in kg. */
    excess?: { fuel: Fuel; quantity: number; price: number }[];
    revenueTaxRate?: number;
    /** CO₂ in kg. */
    constructionEmissions?: number;
    taxedEmissions?: number;
    carbonTaxRate?: number;
    carbonTaxShare?: number;
}

function market(
    lines: FacilitySeason[],
    key: "sold" | "bought" | "dumped",
): ApiSchema<"MarketLine">[] {
    return lines.flatMap((line) => {
        const value = line[key];
        if (!value) return [];
        return [
            {
                facility: line.facility,
                name: NAMES[line.facility]!,
                energy: value[0] * 1e6,
                amount: value[1],
            },
        ];
    });
}

function seasonSheet(input: SeasonInput): PeriodSheet {
    const { facilities } = input;
    const sold = market(facilities, "sold");
    const bought = market(facilities, "bought");
    const dumped = market(facilities, "dumped");
    const sum = <T>(items: T[], value: (item: T) => number) =>
        items.reduce((total, item) => total + value(item), 0);
    const om = facilities.map((line) => ({
        facility: line.facility,
        name: NAMES[line.facility]!,
        count: line.count,
        om: line.omFixed + line.omVariableFull * line.usage,
        fixed: line.omFixed,
        variable_full: line.omVariableFull,
        usage: line.usage,
    }));
    const facilityFuel = facilities.flatMap((line) =>
        line.fuel
            ? [
                  {
                      facility: line.facility,
                      name: NAMES[line.facility]!,
                      fuel: line.fuel.fuel,
                      quantity: line.fuel.bought,
                      cost: line.fuel.bought * line.fuel.price,
                      from_stock: line.fuel.fromStock,
                  },
              ]
            : [],
    );
    const excess = (input.excess ?? []).map((line) => ({
        fuel: line.fuel,
        name: FUEL_NAMES[line.fuel],
        quantity: line.quantity,
        price: line.price,
        cost: line.quantity * line.price,
    }));
    const fuelTotal =
        sum(facilityFuel, (line) => line.cost) + sum(excess, (l) => l.cost);
    const saleRevenue = sum(sold, (line) => line.amount);
    const purchaseCost = sum(bought, (line) => line.amount);
    const dumpCost = sum(dumped, (line) => line.amount);
    const omTotal = sum(om, (line) => line.om);
    const rate = input.revenueTaxRate ?? 0;
    const revenueTax = saleRevenue * rate;
    const carbonRate = input.carbonTaxRate ?? 0;
    const construction = input.constructionEmissions ?? 0;
    const taxed = input.taxedEmissions ?? 0;
    const share = input.carbonTaxShare ?? 0;
    return {
        energy_sold: sum(sold, (line) => line.energy),
        sale_revenue: saleRevenue,
        sold,
        energy_bought: sum(bought, (line) => line.energy),
        purchase_cost: purchaseCost,
        bought,
        market_income: saleRevenue - purchaseCost,
        energy_dumped: sum(dumped, (line) => line.energy),
        dump_cost: dumpCost,
        dumped,
        om,
        om_total: omTotal,
        fuel: [],
        fuel_total: fuelTotal,
        facility_fuel: facilityFuel,
        excess_fuel: excess,
        revenue_tax: revenueTax,
        taxable_revenue: rate > 0 ? saleRevenue : 0,
        revenue_tax_rate: rate,
        operating_income:
            saleRevenue -
            purchaseCost -
            dumpCost -
            omTotal -
            revenueTax -
            fuelTotal,
        construction_emissions: construction,
        construction_carbon_tax: construction * carbonRate,
        taxed_emissions: taxed,
        emitted_carbon_tax: taxed * carbonRate,
        carbon_tax_rate: carbonRate,
        carbon_tax_share: share,
        carbon_tax: (construction + taxed) * carbonRate - share,
    } as PeriodSheet;
}

/** Adds up seasons as the server does for the Round's total. */
function totalSheet(seasons: SeasonInput[]): PeriodSheet {
    const merged: SeasonInput = {
        facilities: [],
        excess: seasons.flatMap((season) => season.excess ?? []),
        constructionEmissions: sum(seasons, (s) => s.constructionEmissions),
        taxedEmissions: sum(seasons, (s) => s.taxedEmissions),
        carbonTaxRate: seasons[0]?.carbonTaxRate,
        carbonTaxShare: sum(seasons, (s) => s.carbonTaxShare),
    };
    const byFacility = new Map<FacilityId, FacilitySeason>();
    for (const line of seasons.flatMap((season) => season.facilities)) {
        const before = byFacility.get(line.facility);
        if (!before) {
            byFacility.set(line.facility, structuredClone(line));
            continue;
        }
        const add = (
            a?: [number, number],
            b?: [number, number],
        ): [number, number] | undefined =>
            a || b
                ? [(a?.[0] ?? 0) + (b?.[0] ?? 0), (a?.[1] ?? 0) + (b?.[1] ?? 0)]
                : undefined;
        const variable =
            before.omVariableFull * before.usage +
            line.omVariableFull * line.usage;
        const full = before.omVariableFull + line.omVariableFull;
        byFacility.set(line.facility, {
            ...before,
            sold: add(before.sold, line.sold)!,
            bought: add(before.bought, line.bought),
            dumped: add(before.dumped, line.dumped),
            omFixed: before.omFixed + line.omFixed,
            omVariableFull: full,
            usage: full > 0 ? variable / full : before.usage,
            fuel:
                before.fuel && line.fuel
                    ? {
                          fuel: before.fuel.fuel,
                          bought: before.fuel.bought + line.fuel.bought,
                          fromStock: before.fuel.fromStock + line.fuel.fromStock,
                          price:
                              (before.fuel.bought * before.fuel.price +
                                  line.fuel.bought * line.fuel.price) /
                              (before.fuel.bought + line.fuel.bought),
                      }
                    : (before.fuel ?? line.fuel),
        });
    }
    merged.facilities = [...byFacility.values()];
    const total = seasonSheet(merged);
    // The revenue tax hit summer only.
    const taxed = seasons.map(seasonSheet);
    total.revenue_tax = sum(taxed, (s) => s.revenue_tax);
    total.taxable_revenue = sum(taxed, (s) => s.taxable_revenue);
    total.revenue_tax_rate =
        total.taxable_revenue > 0
            ? total.revenue_tax / total.taxable_revenue
            : 0;
    total.operating_income = sum(taxed, (s) => s.operating_income);
    return total;
}

function sum<T>(items: T[], value: (item: T) => number | undefined): number {
    return items.reduce((total, item) => total + (value(item) ?? 0), 0);
}

const SPRING: SeasonInput = {
    facilities: [
        {
            facility: "onshore_wind_turbine",
            count: 2,
            sold: [24_600, 1_010_000],
            dumped: [1_900, 47_500],
            omFixed: 375_000,
            omVariableFull: 0,
            usage: 0.42,
        },
        {
            facility: "coal_burner",
            count: 1,
            sold: [52_000, 4_420_000],
            omFixed: 250_000,
            omVariableFull: 1_000_000,
            usage: 0.68,
            fuel: { fuel: "coal", bought: 20_800_000, fromStock: 0, price: 0.1 },
        },
        {
            facility: "gas_burner",
            count: 2,
            sold: [31_000, 3_260_000],
            omFixed: 400_000,
            omVariableFull: 1_600_000,
            usage: 0.41,
            fuel: { fuel: "gas", bought: 6_200_000, fromStock: 0, price: 0.25 },
        },
        {
            facility: "lithium_ion_batteries",
            count: 1,
            sold: [3_100, 310_000],
            bought: [3_900, 156_000],
            omFixed: 125_000,
            omVariableFull: 0,
            usage: 0.2,
        },
    ],
    excess: [{ fuel: "coal", quantity: 2_000_000, price: 0.1 }],
    constructionEmissions: 1_400_000,
    taxedEmissions: 61_000_000,
    carbonTaxRate: 0.025,
    carbonTaxShare: 640_000,
};

/** Summer: a blackout, a revenue tax, and gas burned partly from stock. */
const SUMMER: SeasonInput = {
    facilities: [
        {
            facility: "onshore_wind_turbine",
            count: 2,
            sold: [13_800, 760_000],
            omFixed: 375_000,
            omVariableFull: 0,
            usage: 0.23,
        },
        {
            facility: "coal_burner",
            count: 1,
            sold: [61_000, 5_800_000],
            omFixed: 250_000,
            omVariableFull: 1_000_000,
            usage: 0.8,
            fuel: {
                fuel: "coal",
                bought: 24_400_000,
                fromStock: 0,
                price: 0.132,
            },
        },
        {
            facility: "gas_burner",
            count: 2,
            sold: [44_000, 5_150_000],
            omFixed: 400_000,
            omVariableFull: 1_600_000,
            usage: 0.58,
            fuel: {
                fuel: "gas",
                bought: 6_800_000,
                fromStock: 2_000_000,
                price: 0.231,
            },
        },
        {
            facility: "lithium_ion_batteries",
            count: 1,
            sold: [3_400, 420_000],
            bought: [4_200, 190_000],
            omFixed: 125_000,
            omVariableFull: 0,
            usage: 0.22,
        },
    ],
    revenueTaxRate: 0.07,
    taxedEmissions: 72_000_000,
    carbonTaxRate: 0.025,
    carbonTaxShare: 700_000,
};

const spring = seasonSheet(SPRING);
const summer = seasonSheet(SUMMER);
const total = totalSheet([SPRING, SUMMER]);
const investmentTotal = 26_000_000;
const blackoutShare = 0.1;
const blackoutCost = total.operating_income * blackoutShare;

/**
 * Round 2 halfway through: spring and summer settled, summer with a blackout
 * and a revenue tax, and autumn and winter to come. Every kind of row shows.
 */
export const PREVIEW_BALANCE_SHEET: BalanceSheet = {
    round: 2,
    seasons: [
        { season: "spring", status: "settled", blackout_count: 0, sheet: spring },
        { season: "summer", status: "settled", blackout_count: 1, sheet: summer },
        { season: "autumn", status: "upcoming", blackout_count: 0, sheet: null },
        { season: "winter", status: "upcoming", blackout_count: 0, sheet: null },
    ],
    total,
    investments: [
        {
            facility: "modern_coal_plant",
            name: "Modern coal plant",
            count: 1,
            cost: investmentTotal,
        },
    ],
    investment_total: investmentTotal,
    blackout_cost_share: blackoutShare,
    blackout_cost: blackoutCost,
    net_profit:
        total.operating_income -
        total.carbon_tax -
        blackoutCost -
        investmentTotal,
    financing: [
        {
            kind: "loan_payment",
            amount: -6_000_000,
            payment: 1,
            payment_count: 3,
            at_session_end: false,
        },
    ],
    financing_total: -6_000_000,
} as BalanceSheet;
