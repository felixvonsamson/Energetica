import { describe, expect, it } from "vitest";

import type { ApiSchema } from "@/types/api-helpers";
import type { PlayerCapabilities } from "@/types/capabilities";

import { computeRedirect, isAnnouncedTakeover } from "./route-guard";

type User = ApiSchema<"UserOut">;

function player(overrides: Partial<User> = {}): User {
    return {
        id: 1,
        username: "alice",
        role: "player",
        is_settled: true,
        ...overrides,
    };
}

function facilitator(overrides: Partial<User> = {}): User {
    return {
        id: 2,
        username: "root",
        role: "facilitator",
        is_settled: false,
        ...overrides,
    };
}

const CAPABILITIES = {} as PlayerCapabilities;

describe("computeRedirect", () => {
    it("allows a public route (requiredRole: null) for anyone", () => {
        expect(
            computeRedirect({ requiredRole: null }, player(), null),
        ).toBeNull();
        expect(
            computeRedirect({ requiredRole: null }, facilitator(), null),
        ).toBeNull();
    });

    it("allows a missing routeConfig through unchanged", () => {
        expect(computeRedirect(undefined, player(), null)).toBeNull();
    });

    // --- facilitator routes (#1019) ---------------------------------------------------------------

    it("allows a facilitator account onto a facilitator-required route", () => {
        expect(
            computeRedirect(
                { requiredRole: "facilitator" },
                facilitator(),
                null,
            ),
        ).toBeNull();
    });

    it("redirects a non-facilitator (player) account away from a facilitator-required route", () => {
        expect(
            computeRedirect(
                { requiredRole: "facilitator" },
                player(),
                CAPABILITIES,
            ),
        ).toBe("/app/logout");
    });

    // --- player routes (pre-existing behaviour, unchanged by the extraction) ----------------

    it("redirects a facilitator account away from a player-required route", () => {
        expect(
            computeRedirect(
                { requiredRole: "player", requiresSettledTile: true },
                facilitator(),
                null,
            ),
        ).toBe("/app/logout");
    });

    it("sends an unsettled player to /app/settle on a route that requires a settled tile", () => {
        expect(
            computeRedirect(
                { requiredRole: "player", requiresSettledTile: true },
                player({ is_settled: false }),
                CAPABILITIES,
            ),
        ).toBe("/app/settle");
    });

    it("sends a settled player to /app/dashboard on a route that requires an unsettled tile", () => {
        expect(
            computeRedirect(
                { requiredRole: "player", requiresSettledTile: false },
                player({ is_settled: true }),
                CAPABILITIES,
            ),
        ).toBe("/app/dashboard");
    });

    it("allows a settled player through a route that requires a settled tile and is unlocked", () => {
        expect(
            computeRedirect(
                {
                    requiredRole: "player",
                    requiresSettledTile: true,
                    isUnlocked: () => ({ unlocked: true }),
                },
                player({ is_settled: true }),
                CAPABILITIES,
            ),
        ).toBeNull();
    });

    it("sends a player to /app/dashboard when the route's capability gate is locked", () => {
        expect(
            computeRedirect(
                {
                    requiredRole: "player",
                    requiresSettledTile: true,
                    isUnlocked: () => ({
                        unlocked: false,
                        reason: "no network",
                    }),
                },
                player({ is_settled: true }),
                CAPABILITIES,
            ),
        ).toBe("/app/dashboard");
    });
});

describe("isAnnouncedTakeover", () => {
    // --- facilitator exemption (#1028) --------------------------------------------------------

    it("exempts a facilitator-required route from the announced takeover", () => {
        expect(
            isAnnouncedTakeover({ requiredRole: "facilitator" }, "announced"),
        ).toBe(false);
    });

    it("still gates a player route during the announced phase", () => {
        expect(
            isAnnouncedTakeover(
                { requiredRole: "player", requiresSettledTile: true },
                "announced",
            ),
        ).toBe(true);
    });

    it("still gates a public route (requiredRole: null) during the announced phase", () => {
        expect(isAnnouncedTakeover({ requiredRole: null }, "announced")).toBe(
            true,
        );
    });

    it("does not take over outside the announced phase", () => {
        expect(
            isAnnouncedTakeover(
                { requiredRole: "player", requiresSettledTile: true },
                "active",
            ),
        ).toBe(false);
        expect(
            isAnnouncedTakeover({ requiredRole: "facilitator" }, "active"),
        ).toBe(false);
    });

    it("does not take over while the phase is unresolved", () => {
        expect(
            isAnnouncedTakeover(
                { requiredRole: "player", requiresSettledTile: true },
                undefined,
            ),
        ).toBe(false);
    });
});
