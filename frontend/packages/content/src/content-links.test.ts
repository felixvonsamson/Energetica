import { describe, expect, it } from "vitest";

import { resolveContentLink } from "./content-links";

const game = {
    wikiPagePath: (slug: string) => `/app/wiki/${slug}`,
    servesGame: true,
};
const landing = {
    wikiPagePath: (slug: string) => `/wiki/${slug}`,
    servesGame: false,
};

describe("resolveContentLink", () => {
    it("sends a link to another wiki page to that page in this app", () => {
        expect(resolveContentLink("./map.mdx", game)).toEqual({
            kind: "route",
            to: "/app/wiki/map",
        });
        expect(resolveContentLink("./map.mdx", landing)).toEqual({
            kind: "route",
            to: "/wiki/map",
        });
    });

    it("keeps the heading a wiki link points at", () => {
        expect(
            resolveContentLink(
                "./resources.mdx#extraction-facilities",
                landing,
            ),
        ).toEqual({
            kind: "route",
            to: "/wiki/resources",
            hash: "extraction-facilities",
        });
    });

    it("sends a link to a game page to that page where the app serves the game", () => {
        expect(resolveContentLink("/app/facilities/power#hydro", game)).toEqual(
            {
                kind: "route",
                to: "/app/facilities/power",
                hash: "hydro",
            },
        );
    });

    it("marks a link to a game page unavailable where the app does not serve the game", () => {
        expect(resolveContentLink("/app/facilities/power", landing)).toEqual({
            kind: "unavailable",
        });
    });

    it("leaves every other link as it is", () => {
        for (const href of [
            "https://example.com",
            "#heading",
            "mailto:someone@example.com",
            "/wiki/map",
        ]) {
            expect(resolveContentLink(href, game)).toEqual({ kind: "plain" });
        }
    });
});
