import { describe, expect, it } from "vitest";

import {
    CONSUMERS,
    DUMPING,
    EXPORTS,
    dateOfDay,
    isPointOfWeek,
    meritOrderData,
    networkPowerRows,
    orderedKeys,
    playerPowerRows,
    pointAxisLabel,
    pointTime,
    priceRows,
    reviewableWeeks,
    outages,
    isGridDown,
    seriesEnergy,
    timeOfDay,
    weekdayOfDay,
} from "./workshop-review";

// Two points of a week starting at the period's point 24. Alice (1) has wind,
// which dumps 1 W at the first point, and batteries, which charge 3 W then
// discharge 2 W. Bob (2) has gas.
const week = {
    week: 1,
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
        expect(playerPowerRows(week, 1, "generation")).toEqual([
            { tick: 24, onshore_wind_turbine: 10, lithium_ion_batteries: 0 },
            { tick: 25, onshore_wind_turbine: 4, lithium_ion_batteries: 2 },
        ]);
    });

    it("counts what was sold, charged and dumped as consumption", () => {
        expect(playerPowerRows(week, 1, "consumption")).toEqual([
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
        expect(playerPowerRows(week, 3, "generation")).toEqual([
            { tick: 24 },
            { tick: 25 },
        ]);
    });
});

describe("networkPowerRows", () => {
    it("adds up generation by type or by player", () => {
        expect(networkPowerRows(week, "generation", "type")[0]).toEqual({
            tick: 24,
            onshore_wind_turbine: 10,
            lithium_ion_batteries: 0,
            gas_burner: 5,
        });
        expect(networkPowerRows(week, "generation", "player")[1]).toEqual({
            tick: 25,
            "1": 6,
            "2": 5,
        });
    });

    it("splits consumption into demand tiers, charging and dumping by type", () => {
        expect(networkPowerRows(week, "consumption", "type")[0]).toEqual({
            tick: 24,
            must_serve: 8,
            low_flex: 3,
            lithium_ion_batteries: 3,
            [DUMPING]: 1,
        });
    });

    it("groups the tiers as consumers, and gives each player their charging and dumping", () => {
        expect(networkPowerRows(week, "consumption", "player")[0]).toEqual({
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
            networkPowerRows(week, "generation", "type")[0]!,
        );

        for (const grouping of ["type", "player"] as const) {
            const row = networkPowerRows(week, "consumption", grouping)[0]!;
            expect(total(row)).toBe(generated);
        }
    });
});

describe("priceRows", () => {
    it("leaves a gap where the grid was down", () => {
        const [first, second] = priceRows(week);

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
        const rows = playerPowerRows(week, 1, "generation");

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

describe("reviewableWeeks", () => {
    const days = Array.from({ length: 14 }, (_, i) => 59 + i);

    it("lists every week, whether or not the grid went down", () => {
        expect(reviewableWeeks(days)).toEqual([
            days.slice(0, 7),
            days.slice(7),
        ]);
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

describe("isPointOfWeek", () => {
    it("tells whether a point belongs to the week", () => {
        expect(isPointOfWeek(7 * 24, 1, 24)).toBe(true);
        expect(isPointOfWeek(14 * 24 - 1, 1, 24)).toBe(true);
        expect(isPointOfWeek(7 * 24 - 1, 1, 24)).toBe(false);
        expect(isPointOfWeek(14 * 24, 1, 24)).toBe(false);
    });
});
