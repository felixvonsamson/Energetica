import { describe, expect, it } from "vitest";

import { buildJoinUrl } from "#instance/lib/facilitator";

describe("buildJoinUrl", () => {
    it("joins the origin and the app's join path into a join link", () => {
        expect(
            buildJoinUrl(
                "https://autumn-2025.energetica-game.org",
                "/app/join/abc123",
            ),
        ).toBe("https://autumn-2025.energetica-game.org/app/join/abc123");
    });

    it("strips a trailing slash on the origin so the path never doubles up", () => {
        expect(
            buildJoinUrl(
                "https://autumn-2025.energetica-game.org/",
                "/app/join/abc123",
            ),
        ).toBe("https://autumn-2025.energetica-game.org/app/join/abc123");
    });

    it("works with a local-dev origin (host:port, no apex)", () => {
        expect(buildJoinUrl("http://localhost:5173", "/app/join/abc123")).toBe(
            "http://localhost:5173/app/join/abc123",
        );
    });

    it("keeps whatever path the app serves its join page at", () => {
        expect(buildJoinUrl("http://localhost:5173", "/join/abc123")).toBe(
            "http://localhost:5173/join/abc123",
        );
    });
});
