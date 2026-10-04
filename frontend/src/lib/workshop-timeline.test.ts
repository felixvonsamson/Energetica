import { describe, expect, it } from "vitest";

import {
    type Checkpoint,
    checkpointLabel,
    checkpointPage,
    isSeason,
    nextCheckpoint,
    type NodeStatus,
    type TimelineRound,
    workshopTimeline,
} from "./workshop-timeline";

describe("workshopTimeline", () => {
    it("marks the current Trading period, what came before it, and what comes after", () => {
        const timeline = workshopTimeline(
            { kind: "trading_period", round: 1, season: "summer" },
            2,
        );

        expect(timeline).toEqual([
            {
                round: 1,
                status: "current",
                seasons: [
                    { season: "spring", status: "past" },
                    { season: "summer", status: "current" },
                    { season: "autumn", status: "future" },
                    { season: "winter", status: "future" },
                ],
                recap: "future",
            },
            {
                round: 2,
                status: "future",
                seasons: [
                    { season: "spring", status: "future" },
                    { season: "summer", status: "future" },
                    { season: "autumn", status: "future" },
                    { season: "winter", status: "future" },
                ],
                recap: "future",
            },
        ]);
    });

    it("shows every node as future before the session starts", () => {
        const timeline = workshopTimeline({ kind: "not_started" }, 3);

        expect(timeline).toHaveLength(3);
        expect(allStatuses(timeline)).toEqual(new Set(["future"]));
    });

    it("makes a Round current from its Investment phase, after the previous Round closed", () => {
        const [first, second] = workshopTimeline(
            { kind: "investment", round: 2 },
            2,
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
        );

        expect(first?.status).toBe("past");
        expect(first?.seasons.every((s) => s.status === "past")).toBe(true);
        expect(first?.recap).toBe("current");
        expect(second?.status).toBe("future");
    });

    it("shows every node as past once the session is finished", () => {
        const timeline = workshopTimeline({ kind: "finished" }, 2);

        expect(allStatuses(timeline)).toEqual(new Set(["past"]));
    });
});

describe("checkpointPage", () => {
    it("has no page before the session starts", () => {
        expect(checkpointPage({ kind: "not_started" }, 3)).toBeNull();
    });

    it("is the Round overview during the Round's Investment phase", () => {
        expect(checkpointPage({ kind: "investment", round: 2 }, 3)).toEqual({
            to: "/app/workshop/round/$round",
            params: { round: "2" },
        });
    });

    it("is the Trading period's page during a Trading period", () => {
        expect(
            checkpointPage(
                { kind: "trading_period", round: 1, season: "autumn" },
                3,
            ),
        ).toEqual({
            to: "/app/workshop/round/$round/$season",
            params: { round: "1", season: "autumn" },
        });
    });

    it("is the Recap page during a Recap", () => {
        expect(checkpointPage({ kind: "recap", round: 1 }, 3)).toEqual({
            to: "/app/workshop/recap/$round",
            params: { round: "1" },
        });
    });

    it("is the last Round's Recap once the session is finished", () => {
        expect(checkpointPage({ kind: "finished" }, 3)).toEqual({
            to: "/app/workshop/recap/$round",
            params: { round: "3" },
        });
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

describe("nextCheckpoint", () => {
    it("walks a whole session in the backend's order, then stops", () => {
        const visited: string[] = [];
        let checkpoint: Checkpoint | null = { kind: "not_started" };
        while (checkpoint) {
            visited.push(checkpointLabel(checkpoint));
            checkpoint = nextCheckpoint(checkpoint, 2);
        }

        expect(visited).toEqual([
            "Waiting to start",
            "Round 1 · Investment",
            "Round 1 · Spring trading",
            "Round 1 · Summer trading",
            "Round 1 · Autumn trading",
            "Round 1 · Winter trading",
            "Round 1 · Recap",
            "Round 2 · Investment",
            "Round 2 · Spring trading",
            "Round 2 · Summer trading",
            "Round 2 · Autumn trading",
            "Round 2 · Winter trading",
            "Round 2 · Recap",
            "Session over",
        ]);
    });
});

describe("isSeason", () => {
    it("accepts the four seasons and nothing else", () => {
        expect(isSeason("spring")).toBe(true);
        expect(isSeason("winter")).toBe(true);
        expect(isSeason("monsoon")).toBe(false);
    });
});

function allStatuses(timeline: TimelineRound[]): Set<NodeStatus> {
    return new Set(
        timeline.flatMap((round) => [
            round.status,
            round.recap,
            ...round.seasons.map((s) => s.status),
        ]),
    );
}
