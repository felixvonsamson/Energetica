import { describe, expect, it } from "vitest";

import { ApiClientError } from "@energetica/core/api-client";

import {
    FREEZE_COUNTDOWN_WINDOW_MS,
    formatTimeLeft,
    INSTANCE_FROZEN_DETAIL,
    isInstanceFrozenError,
    isReadOnlyPhase,
    readOnlyFrom,
    showFreezeCountdown,
} from "./lifecycle";

const FREEZE_AT = "2026-10-30T12:00:00Z";
const freezeMs = Date.parse(FREEZE_AT);

describe("isReadOnlyPhase", () => {
    it("is read-only from freeze on", () => {
        expect(isReadOnlyPhase("freeze")).toBe(true);
        expect(isReadOnlyPhase("ended")).toBe(true);
    });

    it("is live before freeze, and while the phase is unknown", () => {
        expect(isReadOnlyPhase("announced")).toBe(false);
        expect(isReadOnlyPhase("active")).toBe(false);
        expect(isReadOnlyPhase(undefined)).toBe(false);
    });
});

describe("showFreezeCountdown", () => {
    it("shows inside the final window", () => {
        expect(
            showFreezeCountdown("active", FREEZE_AT, freezeMs - 60_000),
        ).toBe(true);
        expect(
            showFreezeCountdown(
                "active",
                FREEZE_AT,
                freezeMs - FREEZE_COUNTDOWN_WINDOW_MS,
            ),
        ).toBe(true);
    });

    it("hides before the window opens", () => {
        expect(
            showFreezeCountdown(
                "active",
                FREEZE_AT,
                freezeMs - FREEZE_COUNTDOWN_WINDOW_MS - 1,
            ),
        ).toBe(false);
    });

    it("hides for a run that never freezes", () => {
        expect(showFreezeCountdown("active", null, freezeMs)).toBe(false);
    });

    it("hides outside the active phase", () => {
        expect(showFreezeCountdown("freeze", FREEZE_AT, freezeMs - 1)).toBe(
            false,
        );
        expect(showFreezeCountdown(undefined, FREEZE_AT, freezeMs - 1)).toBe(
            false,
        );
    });
});

describe("formatTimeLeft", () => {
    it("shows minutes and seconds in the final hour", () => {
        expect(formatTimeLeft((4 * 60 + 32) * 1000)).toBe("4:32");
        expect(formatTimeLeft(5_000)).toBe("0:05");
    });

    it("shows hours and minutes within a day", () => {
        expect(formatTimeLeft((3 * 3600 + 12 * 60 + 59) * 1000)).toBe("3h 12m");
    });

    it("shows days and hours beyond a day", () => {
        expect(formatTimeLeft((2 * 86400 + 4 * 3600) * 1000)).toBe("2d 4h");
    });

    it("never goes negative", () => {
        expect(formatTimeLeft(-10_000)).toBe("0:00");
    });
});

describe("isInstanceFrozenError", () => {
    it("recognises the frozen 409", () => {
        const error = new ApiClientError("Conflict", 409, {
            detail: INSTANCE_FROZEN_DETAIL,
        });
        expect(isInstanceFrozenError(error)).toBe(true);
    });

    it("ignores any other 409", () => {
        const error = new ApiClientError("Conflict", 409, {
            detail: "Something else",
        });
        expect(isInstanceFrozenError(error)).toBe(false);
    });

    it("ignores other errors", () => {
        expect(isInstanceFrozenError(new Error(INSTANCE_FROZEN_DETAIL))).toBe(
            false,
        );
    });
});

describe("readOnlyFrom", () => {
    const ENDED_AT = "2026-11-01T12:00:00Z";

    it("closes at freeze_at", () => {
        expect(readOnlyFrom(FREEZE_AT, ENDED_AT)).toBe(freezeMs);
    });

    it("closes at ended_at for a run with no freeze phase", () => {
        expect(readOnlyFrom(null, ENDED_AT)).toBe(Date.parse(ENDED_AT));
    });

    it("never closes an open-ended run", () => {
        expect(readOnlyFrom(null, null)).toBeNull();
        expect(readOnlyFrom(undefined, undefined)).toBeNull();
    });
});
