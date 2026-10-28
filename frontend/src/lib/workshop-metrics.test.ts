import { describe, expect, it } from "vitest";

import type { ApiSchema } from "@/types/api-helpers";

import {
    carbonTaxPerMWh,
    expectedGenerationPerSeason,
    fuelCostPerMWh,
    fuelNeedByFacility,
    nextBuyRound,
    pricePerMWPerRound,
    storageMarkup,
    workingRounds,
} from "./workshop-metrics";

type OwnedFacility = ApiSchema<"WorkshopOwnedFacilityOut">;

describe("nextBuyRound", () => {
    it("is the current Round while its Investment phase is open", () => {
        expect(nextBuyRound({ kind: "investment", round: 2 }, 4)).toBe(2);
    });

    it("is the next Round once the Investment phase has closed", () => {
        expect(
            nextBuyRound(
                { kind: "trading_period", round: 2, season: "spring" },
                4,
            ),
        ).toBe(3);
        expect(nextBuyRound({ kind: "recap", round: 2 }, 4)).toBe(3);
    });

    it("is Round 1 before the session starts", () => {
        expect(nextBuyRound({ kind: "not_started" }, 4)).toBe(1);
    });

    it("is null once no Round is left to buy in", () => {
        expect(nextBuyRound({ kind: "recap", round: 4 }, 4)).toBeNull();
        expect(nextBuyRound({ kind: "finished" }, 4)).toBeNull();
    });
});

describe("fuelCostPerMWh", () => {
    it("is the fuel burned per MWh at the fuel's price per kg", () => {
        // A coal burner burns 400 kg/MWh; coal at 0.1 per kg.
        expect(fuelCostPerMWh(400, 0.1)).toBeCloseTo(40);
    });
});

describe("carbonTaxPerMWh", () => {
    it("is the CO₂ emitted per MWh at the tax rate per kg", () => {
        // A coal burner emits 1'200 kg/MWh; the tax is 25 per tonne.
        expect(carbonTaxPerMWh(1_200, 0.025)).toBeCloseTo(30);
    });
});

describe("storageMarkup", () => {
    it("is how much higher the sell price must be than the buy price to make a profit", () => {
        // Buying 1 MWh gives back 0.8 MWh: 50 / 0.8 = 62.5, 25% above 50.
        expect(storageMarkup(0.8)).toBeCloseTo(0.25);
    });

    it("is nothing for storage that loses no energy", () => {
        expect(storageMarkup(1)).toBe(0);
    });
});

describe("expectedGenerationPerSeason", () => {
    it("is a season at full output scaled down by the capacity factor", () => {
        // 95 MW of PV for 2'184 hours is 207'480 MWh; at 15%, 31'122 MWh.
        expect(expectedGenerationPerSeason(207_480e6, 0.15)).toBeCloseTo(
            31_122e6,
            -3,
        );
    });
});

describe("fuelNeedByFacility", () => {
    const coalBurner = {
        id: "coal_burner",
        fuel_type: "coal",
        fuel_use: 400,
        // 35 MW for 2'184 hours.
        full_output_per_season: 76_440e6,
    } as const;
    const modernCoalPlant = {
        id: "modern_coal_plant",
        fuel_type: "coal",
        fuel_use: 300,
        // 75 MW for 2'184 hours.
        full_output_per_season: 163_800e6,
    } as const;
    const gasBurner = {
        id: "gas_burner",
        fuel_type: "gas",
        fuel_use: 225,
        full_output_per_season: 82_992e6,
    } as const;
    const owned = (
        facility: OwnedFacility["facility"],
        under_construction = false,
    ): OwnedFacility => ({
        facility,
        built_round: 1,
        rounds_left: 2,
        under_construction,
    });

    it("gives what each type burning the fuel burns in a season at full output", () => {
        const fleet = [
            owned("coal_burner"),
            owned("gas_burner"),
            owned("modern_coal_plant"),
            owned("coal_burner"),
        ];

        expect(
            fuelNeedByFacility(
                "coal",
                [coalBurner, modernCoalPlant, gasBurner],
                fleet,
            ),
        ).toEqual([
            // 2 × 76'440 MWh × 400 kg/MWh.
            { facility: "coal_burner", count: 2, need: 61_152_000 },
            // 163'800 MWh × 300 kg/MWh.
            { facility: "modern_coal_plant", count: 1, need: 49_140_000 },
        ]);
    });

    it("leaves out facilities that do not operate this Round", () => {
        const fleet = [owned("coal_burner"), owned("coal_burner", true)];

        expect(fuelNeedByFacility("coal", [coalBurner], fleet)).toEqual([
            { facility: "coal_burner", count: 1, need: 30_576_000 },
        ]);
    });
});

describe("workingRounds", () => {
    it("starts in the Round it is bought in and lasts its lifetime", () => {
        // A coal burner works straight away for 3 Rounds.
        expect(
            workingRounds(2, {
                construction_lag_rounds: 0,
                lifetime_rounds: 3,
            }),
        ).toEqual({ first: 2, last: 4 });
    });

    it("starts once its construction lag has run", () => {
        // A nuclear reactor bought in Round 2 works from Round 3.
        expect(
            workingRounds(2, {
                construction_lag_rounds: 1,
                lifetime_rounds: 6,
            }),
        ).toEqual({ first: 3, last: 8 });
    });
});

describe("pricePerMWPerRound", () => {
    it("spreads the price over each MW of power and each Round of lifetime", () => {
        // A coal burner: 10M for 35 MW lasting 3 Rounds.
        expect(pricePerMWPerRound(10_000_000, 35_000_000, 3)).toBeCloseTo(
            95_238,
            0,
        );
    });
});
