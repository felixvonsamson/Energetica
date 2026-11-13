import { describe, expect, it } from "vitest";

import { documentTitle, pageTitleFromMatches } from "#core/document-title";

describe("documentTitle", () => {
    it("puts the page title before the site name", () => {
        expect(documentTitle("Changelog")).toBe("Changelog — Energetica");
    });

    it("shows only the site name for an empty or missing title", () => {
        expect(documentTitle("")).toBe("Energetica");
        expect(documentTitle("   ")).toBe("Energetica");
        expect(documentTitle(undefined)).toBe("Energetica");
    });
});

describe("pageTitleFromMatches", () => {
    it("reads the deepest match's title", () => {
        expect(
            pageTitleFromMatches([
                { staticData: { title: "" } },
                { staticData: { title: "Power Facilities" } },
            ]),
        ).toBe("Power Facilities");
    });

    it("returns undefined when there is no usable title", () => {
        expect(pageTitleFromMatches([])).toBeUndefined();
        expect(pageTitleFromMatches([{ staticData: {} }])).toBeUndefined();
        expect(pageTitleFromMatches([{}])).toBeUndefined();
    });
});
