import { describe, expect, it } from "vitest";

import {
    installedCapacity,
    parsePrice,
    pricedFacilities,
} from "./workshop-prices";

const owned = (
    facility: "gas_burner" | "nuclear_reactor" | "lithium_ion_batteries",
    { rounds_left = 2, under_construction = false } = {},
) => ({ facility, built_round: 1, rounds_left, under_construction });

describe("pricedFacilities", () => {
    it("lists each operating type once, in the order first bought", () => {
        expect(
            pricedFacilities([
                owned("lithium_ion_batteries"),
                owned("gas_burner"),
                owned("lithium_ion_batteries"),
            ]),
        ).toEqual(["lithium_ion_batteries", "gas_burner"]);
    });

    it("leaves out a type still under construction", () => {
        expect(
            pricedFacilities([
                owned("nuclear_reactor", { under_construction: true }),
                owned("gas_burner"),
            ]),
        ).toEqual(["gas_burner"]);
    });

    it("leaves out a type whose every copy has retired", () => {
        expect(
            pricedFacilities([owned("gas_burner", { rounds_left: 0 })]),
        ).toEqual([]);
    });
});

describe("parsePrice", () => {
    const range = { floor: -25, ceiling: 1000 };

    it("reads a number between the floor and the ceiling", () => {
        expect(parsePrice("42.5", range)).toEqual({ ok: true, price: 42.5 });
        expect(parsePrice(" -25 ", range)).toEqual({ ok: true, price: -25 });
        expect(parsePrice("1000", range)).toEqual({ ok: true, price: 1000 });
    });

    it("refuses an empty field", () => {
        expect(parsePrice("", range)).toEqual({ ok: false, reason: "empty" });
        expect(parsePrice("  ", range)).toEqual({ ok: false, reason: "empty" });
    });

    it("refuses a price below the floor", () => {
        expect(parsePrice("-25.01", range)).toEqual({
            ok: false,
            reason: "below_floor",
        });
    });

    it("refuses a price above the ceiling", () => {
        expect(parsePrice("1000.01", range)).toEqual({
            ok: false,
            reason: "above_ceiling",
        });
    });

    it("refuses text that is not a number", () => {
        expect(parsePrice("abc", range)).toEqual({
            ok: false,
            reason: "invalid",
        });
        expect(parsePrice("1e999", range)).toEqual({
            ok: false,
            reason: "invalid",
        });
    });
});

describe("installedCapacity", () => {
    const batteries = {
        base_power_generation: 86e6,
        base_storage_capacity: 3.2e9,
    };
    const gas = { base_power_generation: 11e6, base_storage_capacity: null };

    it("adds up the power of every operating copy", () => {
        expect(
            installedCapacity(
                gas,
                [
                    owned("gas_burner"),
                    owned("gas_burner"),
                    owned("gas_burner", { rounds_left: 0 }),
                    owned("nuclear_reactor"),
                ],
                "gas_burner",
            ),
        ).toEqual({ power: 22e6, energy: null });
    });

    it("adds up the energy storage holds", () => {
        expect(
            installedCapacity(
                batteries,
                [
                    owned("lithium_ion_batteries"),
                    owned("lithium_ion_batteries"),
                ],
                "lithium_ion_batteries",
            ),
        ).toEqual({ power: 172e6, energy: 6.4e9 });
    });

    it("leaves out a copy still under construction", () => {
        expect(
            installedCapacity(
                gas,
                [owned("gas_burner", { under_construction: true })],
                "gas_burner",
            ),
        ).toEqual({ power: 0, energy: null });
    });
});
