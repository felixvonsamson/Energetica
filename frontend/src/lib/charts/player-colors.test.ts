import { describe, expect, it } from "vitest";

import { parseOklch, playerColorGetter, shadePosition } from "./player-colors";

const palette = {
    self: "oklch(0.4 0.08 148)",
    othersFrom: "oklch(0.3 0.02 250)",
    othersTo: "oklch(0.7 0.06 230)",
};

describe("parseOklch", () => {
    it("reads lightness as a number or a percentage", () => {
        expect(parseOklch("oklch(0.5 0.1 200)")).toEqual({
            l: 0.5,
            c: 0.1,
            h: 200,
        });
        expect(parseOklch("oklch(59.425% 0.1041 137.727)")).toEqual({
            l: 0.59425,
            c: 0.1041,
            h: 137.727,
        });
    });

    it("refuses other color formats", () => {
        expect(parseOklch("#336699")).toBeNull();
        expect(parseOklch("var(--chart-1)")).toBeNull();
    });
});

describe("shadePosition", () => {
    it("starts at one end and puts neighbours far apart", () => {
        expect(shadePosition(0)).toBe(0);
        for (let i = 0; i < 20; i++) {
            const gap = Math.abs(shadePosition(i + 1) - shadePosition(i));
            expect(Math.min(gap, 1 - gap)).toBeGreaterThan(0.2);
        }
    });
});

describe("playerColorGetter", () => {
    it("gives the current player the reserved color and no one else", () => {
        const color = playerColorGetter(palette, 2, [1, 2, 3, 4]);

        expect(color(2)).toBe(palette.self);
        for (const other of [1, 3, 4]) {
            expect(color(other)).not.toBe(palette.self);
        }
    });

    it("gives each other player a different shade", () => {
        const color = playerColorGetter(palette, 1, [1, 2, 3, 4, 5, 6, 7, 8]);
        const shades = [2, 3, 4, 5, 6, 7, 8].map(color);

        expect(new Set(shades).size).toBe(shades.length);
    });

    it("keeps shades stable whatever order the players come in", () => {
        const one = playerColorGetter(palette, 1, [1, 2, 3, 4]);
        const other = playerColorGetter(palette, 1, [4, 3, 1, 2, 3]);

        for (const id of [2, 3, 4]) {
            expect(other(id)).toBe(one(id));
        }
    });

    it("shows a viewer with no player only shades", () => {
        const color = playerColorGetter(palette, null, [1, 2, 3]);

        expect([1, 2, 3].map(color)).not.toContain(palette.self);
        expect(color(1)).toBe("oklch(0.3000 0.0200 250.00)");
    });

    it("places a player it was not told about after the others", () => {
        const color = playerColorGetter(palette, null, [1, 2]);

        expect(color(9)).toBe(playerColorGetter(palette, null, [1, 2, 9])(9));
    });

    it("falls back to the first shade end when it cannot read the shades", () => {
        const color = playerColorGetter(
            { ...palette, othersFrom: "#888" },
            1,
            [1, 2],
        );

        expect(color(2)).toBe("#888");
    });
});
