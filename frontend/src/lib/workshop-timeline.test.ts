import { describe, expect, it } from "vitest";

import type { ApiSchema } from "@/types/api-helpers";

import {
    adjacentSeasons,
    advanceAction,
    type Checkpoint,
    checkpointLabel,
    checkpointPage,
    homePage,
    introStatus,
    isSeason,
    latestRecapRound,
    latestSeason,
    scoreboardStatus,
    type Season,
    type SeasonStatus,
    type TimelineRound,
    type TradingPeriod,
    workshopTimeline,
} from "./workshop-timeline";

describe("workshopTimeline", () => {
    it("marks the current Trading period, what came before it, and what comes after", () => {
        const timeline = workshopTimeline(
            { kind: "trading_period", round: 1, season: "summer" },
            2,
            [],
        );

        expect(timeline).toEqual([
            {
                round: 1,
                status: "current",
                seasons: [
                    { season: "spring", status: "past", blackout: false },
                    { season: "summer", status: "current", blackout: false },
                    { season: "autumn", status: "future", blackout: false },
                    { season: "winter", status: "future", blackout: false },
                ],
                recap: "future",
            },
            {
                round: 2,
                status: "future",
                seasons: [
                    { season: "spring", status: "future", blackout: false },
                    { season: "summer", status: "future", blackout: false },
                    { season: "autumn", status: "future", blackout: false },
                    { season: "winter", status: "future", blackout: false },
                ],
                recap: "future",
            },
        ]);
    });

    it("shows every node as future before the session starts", () => {
        const timeline = workshopTimeline({ kind: "not_started" }, 3, []);

        expect(timeline).toHaveLength(3);
        expect(allStatuses(timeline)).toEqual(new Set(["future"]));
    });

    it("makes a Round current from its Investment phase, after the previous Round closed", () => {
        const [first, second] = workshopTimeline(
            { kind: "investment", round: 2 },
            2,
            [],
        );

        expect(first?.status).toBe("past");
        expect(first?.recap).toBe("past");
        expect(second?.status).toBe("current");
        expect(second?.seasons.map((s) => s.status)).toEqual([
            "future",
            "future",
            "future",
            "future",
        ]);
    });

    it("makes the Recap current once its Round's last Trading period is done", () => {
        const [first, second] = workshopTimeline(
            { kind: "recap", round: 1 },
            2,
            [],
        );

        expect(first?.status).toBe("past");
        expect(first?.seasons.every((s) => s.status === "past")).toBe(true);
        expect(first?.recap).toBe("current");
        expect(second?.status).toBe("future");
    });

    it("marks the season the grid went down in, and skips the rest of its Round", () => {
        const [first, second] = workshopTimeline(
            { kind: "investment", round: 2 },
            2,
            [{ kind: "trading_period", round: 1, season: "summer" }],
        );

        expect(first?.seasons).toEqual([
            { season: "spring", status: "past", blackout: false },
            { season: "summer", status: "past", blackout: true },
            { season: "autumn", status: "skipped", blackout: false },
            { season: "winter", status: "skipped", blackout: false },
        ]);
        expect(first?.recap).toBe("past");
        expect(second?.seasons.map((s) => s.status)).toEqual([
            "future",
            "future",
            "future",
            "future",
        ]);
    });

    it("shows the skipped seasons while the session still waits on the blacked-out one", () => {
        const [round] = workshopTimeline(
            { kind: "trading_period", round: 1, season: "spring" },
            1,
            [{ kind: "trading_period", round: 1, season: "spring" }],
        );

        expect(round?.seasons.map((s) => [s.status, s.blackout])).toEqual([
            ["current", true],
            ["skipped", false],
            ["skipped", false],
            ["skipped", false],
        ]);
    });

    it("shows every node as past once the session is finished", () => {
        const timeline = workshopTimeline({ kind: "finished" }, 2, []);

        expect(allStatuses(timeline)).toEqual(new Set(["past"]));
    });
});

describe("checkpointPage", () => {
    it("is the intro before the session starts", () => {
        expect(checkpointPage({ kind: "not_started" })).toEqual({
            to: "/app/workshop/intro",
        });
    });

    it("is the Round overview during the Round's Investment phase", () => {
        expect(checkpointPage({ kind: "investment", round: 2 })).toEqual({
            to: "/app/workshop/round/$round",
            params: { round: "2" },
        });
    });

    it("is the Trading period's page during a Trading period", () => {
        expect(
            checkpointPage({
                kind: "trading_period",
                round: 1,
                season: "autumn",
            }),
        ).toEqual({
            to: "/app/workshop/round/$round/$season",
            params: { round: "1", season: "autumn" },
        });
    });

    it("is the Recap page during a Recap", () => {
        expect(checkpointPage({ kind: "recap", round: 1 })).toEqual({
            to: "/app/workshop/recap/$round",
            params: { round: "1" },
        });
    });

    it("is the scoreboard once the session is finished", () => {
        expect(checkpointPage({ kind: "finished" })).toEqual({
            to: "/app/workshop/scoreboard",
        });
    });
});

describe("homePage", () => {
    it("sends a player to the page for where the session is now", () => {
        expect(homePage({ kind: "investment", round: 2 }, "player")).toEqual({
            to: "/app/workshop/round/$round",
            params: { round: "2" },
        });
    });

    it("sends the facilitator to the console during an Investment phase, since the Round overview is for players", () => {
        expect(
            homePage({ kind: "investment", round: 2 }, "facilitator"),
        ).toEqual({ to: "/app/workshop/console" });
    });

    it("sends the facilitator to the page for any other checkpoint", () => {
        expect(homePage({ kind: "recap", round: 1 }, "facilitator")).toEqual({
            to: "/app/workshop/recap/$round",
            params: { round: "1" },
        });
    });

    it("sends everyone to the intro before the session starts", () => {
        const intro = { to: "/app/workshop/intro" };
        expect(homePage({ kind: "not_started" }, "facilitator")).toEqual(intro);
        expect(homePage({ kind: "not_started" }, "player")).toEqual(intro);
    });
});

describe("introStatus", () => {
    it("is current before the session starts, and open all game after", () => {
        expect(introStatus({ kind: "not_started" })).toBe("current");
        expect(introStatus({ kind: "investment", round: 1 })).toBe("past");
        expect(introStatus({ kind: "finished" })).toBe("past");
    });
});

describe("scoreboardStatus", () => {
    it("is open all game, and current once the session is finished", () => {
        expect(scoreboardStatus({ kind: "not_started" })).toBe("past");
        expect(scoreboardStatus({ kind: "recap", round: 3 })).toBe("past");
        expect(scoreboardStatus({ kind: "finished" })).toBe("current");
    });
});

describe("latestSeason", () => {
    function round(
        checkpoint: Checkpoint,
        blackouts: TradingPeriod[] = [],
    ): TimelineRound {
        const [first] = workshopTimeline(checkpoint, 2, blackouts);
        if (!first) throw new Error("the session has no Round 1");
        return first;
    }

    it("is the Trading period the session is in during the Round", () => {
        expect(
            latestSeason(
                round({ kind: "trading_period", round: 1, season: "autumn" }),
            ),
        ).toBe("autumn");
    });

    it("is null while no Trading period of the Round has been reached", () => {
        expect(latestSeason(round({ kind: "investment", round: 1 }))).toBe(
            null,
        );
    });

    it("is winter once the Round is over", () => {
        expect(latestSeason(round({ kind: "recap", round: 1 }))).toBe("winter");
    });

    it("is the season of the blackout in a Round that ended early", () => {
        expect(
            latestSeason(
                round({ kind: "recap", round: 1 }, [
                    { kind: "trading_period", round: 1, season: "summer" },
                ]),
            ),
        ).toBe("summer");
    });
});

describe("adjacentSeasons", () => {
    function adjacent(
        checkpoint: Checkpoint,
        round: number,
        season: Season,
        blackouts: TradingPeriod[] = [],
    ) {
        return adjacentSeasons(
            workshopTimeline(checkpoint, 2, blackouts),
            round,
            season,
        );
    }

    it("links the seasons before and after within a Round", () => {
        expect(adjacent({ kind: "recap", round: 1 }, 1, "summer")).toEqual({
            previous: { round: 1, season: "spring", blackout: false },
            next: { round: 1, season: "autumn", blackout: false },
        });
    });

    it("goes from winter to the next Round's spring, and back", () => {
        const checkpoint: Checkpoint = { kind: "finished" };
        expect(adjacent(checkpoint, 1, "winter").next).toEqual({
            round: 2,
            season: "spring",
            blackout: false,
        });
        expect(adjacent(checkpoint, 2, "spring").previous).toEqual({
            round: 1,
            season: "winter",
            blackout: false,
        });
    });

    it("has nothing before the first Round's spring or after the last winter", () => {
        const checkpoint: Checkpoint = { kind: "finished" };
        expect(adjacent(checkpoint, 1, "spring").previous).toBe(null);
        expect(adjacent(checkpoint, 2, "winter").next).toBe(null);
    });

    it("does not link a season the session has not reached", () => {
        const checkpoint: Checkpoint = {
            kind: "trading_period",
            round: 1,
            season: "summer",
        };
        expect(adjacent(checkpoint, 1, "summer").next).toBe(null);
        expect(adjacent(checkpoint, 1, "spring").next).toEqual({
            round: 1,
            season: "summer",
            blackout: false,
        });
    });

    it("steps over the seasons a blackout skipped", () => {
        const blackouts: TradingPeriod[] = [
            { kind: "trading_period", round: 1, season: "summer" },
        ];
        const checkpoint: Checkpoint = { kind: "finished" };
        expect(adjacent(checkpoint, 1, "summer", blackouts).next).toEqual({
            round: 2,
            season: "spring",
            blackout: false,
        });
        expect(adjacent(checkpoint, 2, "spring", blackouts).previous).toEqual({
            round: 1,
            season: "summer",
            blackout: true,
        });
    });

    it("has nothing after a blackout while the next Round has not started", () => {
        const blackouts: TradingPeriod[] = [
            { kind: "trading_period", round: 1, season: "summer" },
        ];
        expect(
            adjacent({ kind: "recap", round: 1 }, 1, "summer", blackouts).next,
        ).toBe(null);
    });
});

describe("checkpointLabel", () => {
    it("names the phase the session is in", () => {
        expect(checkpointLabel({ kind: "not_started" })).toBe(
            "Waiting to start",
        );
        expect(checkpointLabel({ kind: "investment", round: 1 })).toBe(
            "Round 1 · Investment",
        );
        expect(
            checkpointLabel({
                kind: "trading_period",
                round: 2,
                season: "winter",
            }),
        ).toBe("Round 2 · Winter trading");
        expect(checkpointLabel({ kind: "recap", round: 3 })).toBe(
            "Round 3 · Recap",
        );
        expect(checkpointLabel({ kind: "finished" })).toBe("Session over");
    });
});

describe("isSeason", () => {
    it("accepts the four seasons and nothing else", () => {
        expect(isSeason("spring")).toBe(true);
        expect(isSeason("winter")).toBe(true);
        expect(isSeason("monsoon")).toBe(false);
    });
});

function allStatuses(timeline: TimelineRound[]): Set<SeasonStatus> {
    return new Set(
        timeline.flatMap((round) => [
            round.status,
            round.recap,
            ...round.seasons.map((s) => s.status),
        ]),
    );
}

describe("advanceAction", () => {
    const spring = {
        kind: "trading_period",
        round: 1,
        season: "spring",
    } as const;
    const session = (
        overrides: Partial<ApiSchema<"WorkshopSessionOut">>,
    ): ApiSchema<"WorkshopSessionOut"> => ({
        checkpoint: spring,
        next_checkpoint: { kind: "trading_period", round: 1, season: "summer" },
        round_count: 3,
        phase_timer: null,
        players: [],
        round_format: {
            trading_format: "representative_week",
            clearings_per_day: 24,
            storage: "batteries",
        },
        settlement: null,
        blackouts: [],
        carbon_tax_since: null,
        ...overrides,
    });

    it("closes an open price-setting window rather than moving on", () => {
        expect(advanceAction(session({}), true)).toEqual({
            kind: "close_window",
            label: "Close the price-setting window",
        });
    });

    it("closes an open investment window rather than moving on", () => {
        const investing = session({
            checkpoint: { kind: "investment", round: 1 },
            next_checkpoint: spring,
        });

        expect(advanceAction(investing, true)?.label).toBe(
            "Close the investment window",
        );
    });

    it("waits while the Trading period is being simulated", () => {
        const simulating = session({
            settlement: { days_done: 3, days_total: 91 },
        });

        expect(advanceAction(simulating, false)?.kind).toBe("simulating");
    });

    it("names the next checkpoint once the window is closed", () => {
        expect(advanceAction(session({}), false)).toEqual({
            kind: "next",
            label: "Next: Round 1 · Summer trading",
        });
    });

    it("starts the session from before Round 1", () => {
        const waiting = session({
            checkpoint: { kind: "not_started" },
            next_checkpoint: { kind: "investment", round: 1 },
        });

        expect(advanceAction(waiting, false)?.label).toBe("Start the session");
    });

    it("offers nothing once the session is over", () => {
        const over = session({
            checkpoint: { kind: "finished" },
            next_checkpoint: null,
        });

        expect(advanceAction(over, false)).toBeNull();
    });
});

describe("latestRecapRound", () => {
    it("is the Recap that opened last, or none before the first", () => {
        expect(latestRecapRound({ kind: "not_started" }, 3)).toBeNull();
        expect(
            latestRecapRound({ kind: "investment", round: 1 }, 3),
        ).toBeNull();
        expect(
            latestRecapRound(
                { kind: "trading_period", round: 2, season: "spring" },
                3,
            ),
        ).toBe(1);
        expect(latestRecapRound({ kind: "recap", round: 2 }, 3)).toBe(2);
        expect(latestRecapRound({ kind: "finished" }, 3)).toBe(3);
    });
});
