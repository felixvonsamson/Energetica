import { describe, expect, it } from "vitest";

import { ApiClientError } from "@energetica/core/api-client";

import { formatLeverChangeError } from "./game-messages";

describe("formatLeverChangeError", () => {
    const refused = (code: string, kwargs?: Record<string, unknown>) =>
        new ApiClientError("Bad Request", 400, {
            game_exception_type: code,
            kwargs,
        });

    it("names the Round the change would leave invalid", () => {
        expect(
            formatLeverChangeError(
                refused("WORKSHOP_LEVERS_INVALID", { round: 5 }),
            ),
        ).toBe(
            "This change would leave Round 5 invalid: every storage type needs the full-season format.",
        );
    });

    it("falls back to the usual message for any other refusal", () => {
        expect(formatLeverChangeError(refused("WORKSHOP_ROUND_LOCKED"))).toBe(
            "This Round's plan is locked: players have been told what it holds.",
        );
    });
});
