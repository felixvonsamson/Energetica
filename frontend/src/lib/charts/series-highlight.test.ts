import { describe, expect, it } from "vitest";

import { FADED_SERIES_OPACITY, seriesOpacity } from "./series-highlight";

const visible = ["coal", "wind", "solar"];

describe("seriesOpacity", () => {
    it("shows every series in full when none is highlighted", () => {
        for (const key of visible) {
            expect(seriesOpacity(key, null, visible)).toBe(1);
            expect(seriesOpacity(key, undefined, visible)).toBe(1);
        }
    });

    it("fades every series but the highlighted one", () => {
        expect(seriesOpacity("wind", "wind", visible)).toBe(1);
        expect(seriesOpacity("coal", "wind", visible)).toBe(
            FADED_SERIES_OPACITY,
        );
        expect(seriesOpacity("solar", "wind", visible)).toBe(
            FADED_SERIES_OPACITY,
        );
    });

    it("fades nothing when the highlighted series is not on the chart", () => {
        // A hidden facility's row, or a row with no matching series.
        for (const key of visible) {
            expect(seriesOpacity(key, "nuclear", visible)).toBe(1);
        }
    });
});
