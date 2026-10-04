import { describe, expect, it } from "vitest";

import {
    formatCountdown,
    phaseDeadline,
    phaseLabel,
} from "./workshop-countdown";

describe("phaseLabel", () => {
    it("names the decision each timed checkpoint is for", () => {
        expect(phaseLabel({ kind: "investment", round: 2 })).toBe("Invest");
        expect(
            phaseLabel({ kind: "trading_period", round: 1, season: "autumn" }),
        ).toBe("Set prices");
    });

    it("has no label for a checkpoint without a countdown", () => {
        expect(phaseLabel({ kind: "not_started" })).toBeNull();
        expect(phaseLabel({ kind: "recap", round: 1 })).toBeNull();
        expect(phaseLabel({ kind: "finished" })).toBeNull();
    });
});

describe("formatCountdown", () => {
    it("shows minutes and two-digit seconds", () => {
        expect(formatCountdown(134_000)).toBe("2:14");
        expect(formatCountdown(480_000)).toBe("8:00");
        expect(formatCountdown(9_000)).toBe("0:09");
    });

    it("rounds a part-second up, so 0:00 shows only once time is up", () => {
        expect(formatCountdown(133_100)).toBe("2:14");
        expect(formatCountdown(200)).toBe("0:01");
        expect(formatCountdown(0)).toBe("0:00");
    });

    it("never shows negative time", () => {
        expect(formatCountdown(-5_000)).toBe("0:00");
    });
});

describe("phaseDeadline", () => {
    it("counts the time left from when the answer arrived, not from the server's clock", () => {
        expect(phaseDeadline({ remaining_seconds: 90.5 }, 1_000_000)).toBe(
            1_090_500,
        );
    });
});
