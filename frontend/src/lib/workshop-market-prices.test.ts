import { describe, expect, it } from "vitest";

import {
    marketColumns,
    ownRowClick,
    priceTrend,
} from "./workshop-market-prices";

const quote = (
    price: number,
    previous: number | null = null,
    base: number = price,
) => ({
    price,
    previous,
    default: base,
});

const player = (
    sell: Record<string, ReturnType<typeof quote>>,
    buy: Record<string, ReturnType<typeof quote>> = {},
) => ({ account_id: 1, username: "alice", sell, buy });

describe("priceTrend", () => {
    it("is up when the price is higher than the last period's", () => {
        expect(priceTrend(quote(150, 90))).toBe("up");
    });

    it("is down when the price is lower than the last period's", () => {
        expect(priceTrend(quote(80, 90))).toBe("down");
    });

    it("is unchanged when the price is the last period's", () => {
        expect(priceTrend(quote(90, 90))).toBe("unchanged");
    });

    it("compares with the default price when the type ran in no earlier period", () => {
        expect(priceTrend(quote(120, null, 90))).toBe("up");
        expect(priceTrend(quote(60, null, 90))).toBe("down");
        expect(priceTrend(quote(90, null, 90))).toBe("unchanged");
    });

    it("compares with the last period's price over the default price", () => {
        expect(priceTrend(quote(100, 120, 90))).toBe("down");
    });
});

describe("marketColumns", () => {
    const order = [
        "nuclear_reactor",
        "gas_burner",
        "lithium_ion_batteries",
    ] as const;

    it("lists the types someone has, in the catalog's order", () => {
        const players = [
            player({ gas_burner: quote(80) }),
            player({ nuclear_reactor: quote(20) }),
        ];

        expect(marketColumns(players, [...order])).toEqual([
            { facility: "nuclear_reactor", side: "sell" },
            { facility: "gas_burner", side: "sell" },
        ]);
    });

    it("gives storage a sell and a buy column", () => {
        const players = [
            player(
                { lithium_ion_batteries: quote(150) },
                { lithium_ion_batteries: quote(60) },
            ),
        ];

        expect(marketColumns(players, [...order])).toEqual([
            { facility: "lithium_ion_batteries", side: "sell" },
            { facility: "lithium_ion_batteries", side: "buy" },
        ]);
    });

    it("has no columns when nobody had anything operating", () => {
        expect(marketColumns([player({})], [...order])).toEqual([]);
    });
});

describe("ownRowClick", () => {
    it("opens the price panel and points to the Prices button while the window is open", () => {
        const click = ownRowClick(true);
        expect(click.openPanel).toBe(true);
        expect(click.message).toMatch(/Prices button/);
    });

    it("leaves the panel shut and says the window is closed otherwise", () => {
        const click = ownRowClick(false);
        expect(click.openPanel).toBe(false);
        expect(click.message).toMatch(/closed/);
    });
});
