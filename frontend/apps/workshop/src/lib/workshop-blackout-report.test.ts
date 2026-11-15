import { describe, expect, it } from "vitest";

import type { ApiSchema } from "@/types/api-helpers";

import { blackoutReport } from "./workshop-blackout-report";

type Blackout = ApiSchema<"Blackout">;

// Day 70 of the Workshop year is Mon 12 Mar, and day 339 is Thu 6 Dec.
const MARCH: Blackout = {
    round: 1,
    season: "spring",
    day: 70,
    minute: 18 * 60,
};
const DECEMBER: Blackout = {
    round: 1,
    season: "winter",
    day: 339,
    minute: 19 * 60 + 15,
};

function report(blackouts: Blackout[]) {
    const count = blackouts.length;
    return blackoutReport(blackouts, Math.min(1, 0.3 * count), 0.9 ** count);
}

describe("blackoutReport", () => {
    it("has nothing to report in a Round the grid held", () => {
        expect(report([])).toBe(null);
    });

    it("tells a single blackout with its date and time", () => {
        expect(report([MARCH])).toEqual({
            headline: "Lights out on Mon 12 Mar",
            body:
                "At 18:00 on Mon 12 Mar the grid could not supply the demand that must always be served, and went down. " +
                "After 24 hours it was restarted, and electricity was rationed for the rest of the year: demand was cut by 10%. " +
                "Every producer lost 30% of this year's operating profit.",
        });
    });

    it("tells two blackouts as a pair", () => {
        expect(report([MARCH, DECEMBER])).toEqual({
            headline: "Two major blackouts this year",
            body:
                "The grid went down twice this year: on Mon 12 Mar at 18:00 and on Thu 6 Dec at 19:15. " +
                "Each time it was restarted after 24 hours with tighter rationing, and by the end of the year demand had been cut by 19%. " +
                "Every producer lost 60% of this year's operating profit.",
        });
    });

    it("tells three blackouts as a crisis", () => {
        const third: Blackout = { ...DECEMBER, day: 340 };
        expect(report([MARCH, DECEMBER, third])).toEqual({
            headline: "Grid in crisis",
            body:
                "The grid failed three times this year: on Mon 12 Mar at 18:00, on Thu 6 Dec at 19:15 and on Fri 7 Dec at 19:15. " +
                "People no longer trust their power producers. " +
                "Rationing cut demand by 27% by the end of the year. " +
                "Every producer lost 90% of this year's operating profit.",
        });
    });

    it("tells four or more as a collapse, and lists only the first few", () => {
        const blackouts = Array.from({ length: 7 }, (_, i) => ({
            ...MARCH,
            day: 70 + i,
        }));
        expect(report(blackouts)).toEqual({
            headline: "Total collapse",
            body:
                "The grid failed 7 times this year: on Mon 12 Mar at 18:00, on Tue 13 Mar at 18:00, on Wed 14 Mar at 18:00, " +
                "on Thu 15 Mar at 18:00, on Fri 16 Mar at 18:00 and 2 more times. " +
                "Electricity has become a luxury, rationed down to 48% of normal demand. " +
                "Every producer lost this year's entire operating profit.",
        });
    });
});
