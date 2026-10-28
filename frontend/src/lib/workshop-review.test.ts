import { describe, expect, it } from "vitest";

import {
    CONSUMERS,
    DUMPING,
    EXPORTS,
    dateOfDay,
    isPointOfWindow,
    sliceDays,
    meritOrderData,
    networkPowerRows,
    orderedKeys,
    playerPowerRows,
    playerStorageRows,
    pointAxisLabel,
    pointTime,
    priceRows,
    centredOn,
    clampWindow,
    middleWeek,
    windowLabel,
    outages,
    isGridDown,
    seriesEnergy,
    timeOfDay,
    weekdayOfDay,
} from "./workshop-review";

// Two points of some days starting at the period's point 24. Alice (1) has wind,
// which dumps 1 W at the first point, and batteries, which charge 3 W then
// discharge 2 W. The batteries hold 4 Wh and end the points at 2 Wh, then
// empty. Bob (2) has gas.
const days = {
    days: [66, 67, 68, 69, 70, 71, 72],
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
            stored: [0, 0],
            storage_capacity: 0,
        },
        {
            player_id: 1,
            facility: "lithium_ion_batteries" as const,
            generation: [0, 2],
            dumped: [0, 0],
            charged: [3, 0],
            stored: [2, 0],
            storage_capacity: 4,
        },
        {
            player_id: 2,
            facility: "gas_burner" as const,
            generation: [5, 5],
            dumped: [0, 0],
            charged: [0, 0],
            stored: [0, 0],
            storage_capacity: 0,
        },
    ],
    tiers: [
        { tier: "must_serve", served: [8, 8] },
        { tier: "low_flex", served: [3, 3] },
    ],
};

describe("playerPowerRows", () => {
    it("counts each facility type's generation, keyed by the period's point", () => {
        expect(playerPowerRows(days, 1, "generation")).toEqual([
            { tick: 24, onshore_wind_turbine: 10, lithium_ion_batteries: 0 },
            { tick: 25, onshore_wind_turbine: 4, lithium_ion_batteries: 2 },
        ]);
    });

    it("counts what was sold, charged and dumped as consumption", () => {
        expect(playerPowerRows(days, 1, "consumption")).toEqual([
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
        expect(playerPowerRows(days, 3, "generation")).toEqual([
            { tick: 24 },
            { tick: 25 },
        ]);
    });
});

describe("playerStorageRows", () => {
    it("gives each storage type's stored energy", () => {
        expect(playerStorageRows(days, 1, "energy")).toEqual([
            { tick: 24, lithium_ion_batteries: 2 },
            { tick: 25, lithium_ion_batteries: 0 },
        ]);
    });

    it("gives each storage type's state of charge, from 0 to 1", () => {
        expect(playerStorageRows(days, 1, "soc")).toEqual([
            { tick: 24, lithium_ion_batteries: 0.5 },
            { tick: 25, lithium_ion_batteries: 0 },
        ]);
    });

    it("keeps a storage type that stayed empty all along", () => {
        const empty = {
            ...days,
            pools: [
                {
                    player_id: 2,
                    facility: "pumped_hydro" as const,
                    generation: [0, 0],
                    dumped: [0, 0],
                    charged: [0, 0],
                    stored: [0, 0],
                    storage_capacity: 4,
                },
            ],
        };
        expect(playerStorageRows(empty, 2, "soc")).toEqual([
            { tick: 24, pumped_hydro: 0 },
            { tick: 25, pumped_hydro: 0 },
        ]);
    });

    it("gives a player with no storage empty rows", () => {
        expect(playerStorageRows(days, 2, "soc")).toEqual([
            { tick: 24 },
            { tick: 25 },
        ]);
    });
});

describe("networkPowerRows", () => {
    it("adds up generation by type or by player", () => {
        expect(networkPowerRows(days, "generation", "type")[0]).toEqual({
            tick: 24,
            onshore_wind_turbine: 10,
            lithium_ion_batteries: 0,
            gas_burner: 5,
        });
        expect(networkPowerRows(days, "generation", "player")[1]).toEqual({
            tick: 25,
            "1": 6,
            "2": 5,
        });
    });

    it("splits consumption into demand tiers, charging and dumping by type", () => {
        expect(networkPowerRows(days, "consumption", "type")[0]).toEqual({
            tick: 24,
            must_serve: 8,
            low_flex: 3,
            lithium_ion_batteries: 3,
            [DUMPING]: 1,
        });
    });

    it("groups the tiers as consumers, and gives each player their charging and dumping", () => {
        expect(networkPowerRows(days, "consumption", "player")[0]).toEqual({
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
            networkPowerRows(days, "generation", "type")[0]!,
        );

        for (const grouping of ["type", "player"] as const) {
            const row = networkPowerRows(days, "consumption", grouping)[0]!;
            expect(total(row)).toBe(generated);
        }
    });
});

describe("priceRows", () => {
    it("leaves a gap where the grid was down", () => {
        const [first, second] = priceRows(days);

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
        const rows = playerPowerRows(days, 1, "generation");

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

describe("weekdayOfDay", () => {
    it("starts the year on a Monday", () => {
        expect(weekdayOfDay(0)).toBe("Mon");
        expect(weekdayOfDay(6)).toBe("Sun");
        expect(weekdayOfDay(59)).toBe("Thu");
    });
});

describe("pointTime", () => {
    it("gives the weekday, date and time each point of the period starts at", () => {
        expect(pointTime(0, [59, 60], 24)).toBe("Thu 1 Mar, 00:00");
        expect(pointTime(30, [59, 60], 24)).toBe("Fri 2 Mar, 06:00");
    });
});

describe("pointAxisLabel", () => {
    it("labels a midnight with its weekday and date", () => {
        expect(pointAxisLabel(24, [59, 60], 24)).toBe("Fri 2 Mar");
        expect(pointAxisLabel(0, [59, 60], 96)).toBe("Thu 1 Mar");
    });

    it("labels another point with its weekday and time", () => {
        expect(pointAxisLabel(30, [59, 60], 24)).toBe("Fri 06:00");
        expect(pointAxisLabel(1, [59, 60], 288)).toBe("Thu 00:05");
    });
});

describe("middleWeek", () => {
    it("picks the week in the middle of a season", () => {
        expect(middleWeek(91)).toEqual({ first: 42, count: 7 });
    });

    it("takes every day of a period shorter than a week", () => {
        expect(middleWeek(5)).toEqual({ first: 0, count: 5 });
    });
});

describe("clampWindow", () => {
    it("keeps a window inside the period", () => {
        expect(clampWindow({ first: 88, count: 7 }, 91)).toEqual({
            first: 84,
            count: 7,
        });
        expect(clampWindow({ first: -3, count: 7 }, 91)).toEqual({
            first: 0,
            count: 7,
        });
    });

    it("cuts a window down to the period, and to at least a day", () => {
        expect(clampWindow({ first: 2, count: 120 }, 91)).toEqual({
            first: 0,
            count: 91,
        });
        expect(clampWindow({ first: 2, count: 0 }, 91)).toEqual({
            first: 2,
            count: 1,
        });
    });
});

describe("centredOn", () => {
    it("centres a window on a day", () => {
        expect(centredOn(50, 7, 91)).toEqual({ first: 47, count: 7 });
        expect(centredOn(50, 4, 91)).toEqual({ first: 49, count: 4 });
    });

    it("stops at the period's ends", () => {
        expect(centredOn(1, 7, 91)).toEqual({ first: 0, count: 7 });
        expect(centredOn(90, 7, 91)).toEqual({ first: 84, count: 7 });
    });
});

describe("windowLabel", () => {
    // 1 March is day 59 of the Workshop year, a Thursday.
    const days = Array.from({ length: 14 }, (_, i) => 59 + i);

    it("names the first and last day", () => {
        expect(windowLabel(days, { first: 2, count: 7 })).toBe(
            "3 Mar – 9 Mar (7 days)",
        );
    });

    it("names a single day with its weekday", () => {
        expect(windowLabel(days, { first: 0, count: 1 })).toBe("Thu 1 Mar");
    });
});

describe("outages", () => {
    it("covers a day from each blackout, cut short at the end of the period", () => {
        // A week of 24 clearings a day has 168 points.
        expect(outages([12, 160], 168, 24)).toEqual([
            { start: 12, end: 36 },
            { start: 160, end: 168 },
        ]);
    });
});

describe("isGridDown", () => {
    it("is the day after each blackout, not the blackout itself", () => {
        expect(isGridDown(12, [12], 24)).toBe(false);
        expect(isGridDown(13, [12], 24)).toBe(true);
        expect(isGridDown(35, [12], 24)).toBe(true);
        expect(isGridDown(36, [12], 24)).toBe(false);
        expect(isGridDown(5, [], 24)).toBe(false);
    });
});

describe("sliceDays", () => {
    // Three days of two points each, from the period's start.
    const all = {
        days: [59, 60, 61],
        first_point: 0,
        price: [1, 2, 3, 4, 5, null],
        quantity: [10, 20, 30, 40, 50, null],
        pools: [
            {
                player_id: 1,
                facility: "gas_burner" as const,
                generation: [1, 2, 3, 4, 5, 6],
                dumped: [0, 0, 0, 0, 0, 1],
                charged: [0, 0, 0, 0, 0, 2],
                stored: [0, 0, 0, 0, 0, 3],
                storage_capacity: 0,
            },
        ],
        tiers: [{ tier: "must_serve", served: [6, 5, 4, 3, 2, 1] }],
    };

    it("keeps the window's days and points, numbered in the period", () => {
        expect(sliceDays(all, { first: 1, count: 2 }, 2)).toEqual({
            days: [60, 61],
            first_point: 2,
            price: [3, 4, 5, null],
            quantity: [30, 40, 50, null],
            pools: [
                {
                    ...all.pools[0],
                    generation: [3, 4, 5, 6],
                    dumped: [0, 0, 0, 1],
                    charged: [0, 0, 0, 2],
                    stored: [0, 0, 0, 3],
                },
            ],
            tiers: [{ tier: "must_serve", served: [4, 3, 2, 1] }],
        });
    });
});

describe("isPointOfWindow", () => {
    it("tells whether a point belongs to the window's days", () => {
        const window = { first: 7, count: 3 };
        expect(isPointOfWindow(7 * 24, window, 24)).toBe(true);
        expect(isPointOfWindow(10 * 24 - 1, window, 24)).toBe(true);
        expect(isPointOfWindow(7 * 24 - 1, window, 24)).toBe(false);
        expect(isPointOfWindow(10 * 24, window, 24)).toBe(false);
    });
});
