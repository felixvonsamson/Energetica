import { describe, expect, it } from "vitest";

import {
    CONSUMERS,
    DUMPING,
    EXPORTS,
    dateOfDay,
    meritOrderData,
    networkPowerRows,
    orderedKeys,
    playerPowerRows,
    priceRows,
    seriesEnergy,
    timeOfDay,
} from "./workshop-review";

// Two points of a day starting at the period's point 24. Alice (1) has wind,
// which dumps 1 W at the first point, and batteries, which charge 3 W then
// discharge 2 W. Bob (2) has gas.
const day = {
    day: 1,
    first_point: 24,
    price: [50, null],
    quantity: [12, 0],
    pools: [
        {
            player_id: 1,
            facility: "onshore_wind_turbine" as const,
            generation: [10, 4],
            dumped: [1, 0],
            charged: [0, 0],
        },
        {
            player_id: 1,
            facility: "lithium_ion_batteries" as const,
            generation: [0, 2],
            dumped: [0, 0],
            charged: [3, 0],
        },
        {
            player_id: 2,
            facility: "gas_burner" as const,
            generation: [5, 5],
            dumped: [0, 0],
            charged: [0, 0],
        },
    ],
    tiers: [
        { tier: "must_serve", served: [8, 8] },
        { tier: "low_flex", served: [3, 3] },
    ],
};

describe("playerPowerRows", () => {
    it("counts each facility type's generation, keyed by the period's point", () => {
        expect(playerPowerRows(day, 1, "generation")).toEqual([
            { tick: 24, onshore_wind_turbine: 10, lithium_ion_batteries: 0 },
            { tick: 25, onshore_wind_turbine: 4, lithium_ion_batteries: 2 },
        ]);
    });

    it("counts what was sold, charged and dumped as consumption", () => {
        expect(playerPowerRows(day, 1, "consumption")).toEqual([
            {
                tick: 24,
                [EXPORTS]: 9,
                [DUMPING]: 1,
                lithium_ion_batteries: 3,
            },
            {
                tick: 25,
                [EXPORTS]: 6,
                [DUMPING]: 0,
                lithium_ion_batteries: 0,
            },
        ]);
    });

    it("gives a player with nothing operating empty rows", () => {
        expect(playerPowerRows(day, 3, "generation")).toEqual([
            { tick: 24 },
            { tick: 25 },
        ]);
    });
});

describe("networkPowerRows", () => {
    it("adds up generation by type or by player", () => {
        expect(networkPowerRows(day, "generation", "type")[0]).toEqual({
            tick: 24,
            onshore_wind_turbine: 10,
            lithium_ion_batteries: 0,
            gas_burner: 5,
        });
        expect(networkPowerRows(day, "generation", "player")[1]).toEqual({
            tick: 25,
            "1": 6,
            "2": 5,
        });
    });

    it("splits consumption into demand tiers, charging and dumping by type", () => {
        expect(networkPowerRows(day, "consumption", "type")[0]).toEqual({
            tick: 24,
            must_serve: 8,
            low_flex: 3,
            lithium_ion_batteries: 3,
            [DUMPING]: 1,
        });
    });

    it("groups the tiers as consumers, and gives each player their charging and dumping", () => {
        expect(networkPowerRows(day, "consumption", "player")[0]).toEqual({
            tick: 24,
            [CONSUMERS]: 11,
            "1": 4,
            "2": 0,
        });
    });

    it("consumes as much as it generates, however it is grouped", () => {
        const total = (row: Record<string, number>) =>
            Object.entries(row)
                .filter(([key]) => key !== "tick")
                .reduce((sum, [, value]) => sum + value, 0);
        const generated = total(
            networkPowerRows(day, "generation", "type")[0]!,
        );

        for (const grouping of ["type", "player"] as const) {
            const row = networkPowerRows(day, "consumption", grouping)[0]!;
            expect(total(row)).toBe(generated);
        }
    });
});

describe("priceRows", () => {
    it("leaves a gap where the grid was down", () => {
        const [first, second] = priceRows(day);

        expect(first).toEqual({ tick: 24, price: 50 });
        expect(second?.tick).toBe(25);
        expect(second?.price).toBeNaN();
    });
});

describe("orderedKeys", () => {
    it("puts the preferred keys first and leaves out all-zero series", () => {
        const rows = [
            { tick: 0, b: 1, a: 0, c: 2 },
            { tick: 1, b: 0, a: 0, c: 0 },
        ];

        expect(orderedKeys(rows, ["c", "a"])).toEqual(["c", "b"]);
    });
});

describe("seriesEnergy", () => {
    it("adds up power times the length of each point", () => {
        const rows = playerPowerRows(day, 1, "generation");

        expect(seriesEnergy(rows, "onshore_wind_turbine", 0.5)).toBe(7);
    });
});

describe("meritOrderData", () => {
    it("reads a bid at any price, and a blackout's missing price, as unbounded", () => {
        const orders = {
            player_id: [-1],
            capacity: [8],
            price: [null],
            facility: ["must_serve"],
            cumul_capacities: [8],
            cleared: [5],
        };

        const data = meritOrderData({
            point: 3,
            offers: { ...orders, price: [40] },
            demands: orders,
            price: null,
            quantity: 5,
        });

        expect(data.capacities.price).toEqual([40]);
        expect(data.demands.price).toEqual([Infinity]);
        expect(data.market_price).toBe(Infinity);
        expect(data.demands.cleared).toEqual([5]);
    });
});

describe("timeOfDay", () => {
    it("gives the time each point of the day starts at", () => {
        expect(timeOfDay(0, 24)).toBe("00:00");
        expect(timeOfDay(13, 24)).toBe("13:00");
        expect(timeOfDay(5, 96)).toBe("01:15");
        expect(timeOfDay(96 + 1, 96)).toBe("00:15");
        expect(timeOfDay(287, 288)).toBe("23:55");
    });
});

describe("dateOfDay", () => {
    it("counts days from 1 January", () => {
        expect(dateOfDay(0)).toBe("1 Jan");
        expect(dateOfDay(59)).toBe("1 Mar");
    });
});
