/**
 * The Workshop timeline (#995): where each Round, Trading period and Recap
 * stands relative to the session's current checkpoint.
 *
 * The session runs `NotStarted → [Investment → 4 Trading periods → Recap] ×
 * Rounds → Finished` and only the moderator moves it along (#994). Each node on
 * the timeline is `past` (already reached, so its page has something to show),
 * `current`, or `future`, and each has its own page.
 */

import type { ApiSchema } from "@/types/api-helpers";

export type Checkpoint = ApiSchema<"WorkshopSessionOut">["checkpoint"];
export type Season = ApiSchema<"TradingPeriod">["season"];
export type NodeStatus = "past" | "current" | "future";

/** The four Trading periods of a Round, in the order they run. */
export const SEASONS = [
    "spring",
    "summer",
    "autumn",
    "winter",
] as const satisfies readonly Season[];

export const SEASON_LABELS: Record<Season, string> = {
    spring: "Spring",
    summer: "Summer",
    autumn: "Autumn",
    winter: "Winter",
};

export function isSeason(value: string): value is Season {
    return (SEASONS as readonly string[]).includes(value);
}

export interface TimelineRound {
    round: number;
    /**
     * `current` from the Round's Investment phase through its last Trading
     * period.
     */
    status: NodeStatus;
    seasons: { season: Season; status: NodeStatus }[];
    /** The Recap that closes this Round. */
    recap: NodeStatus;
}

// Each Round takes six steps: Investment, four Trading periods, Recap.
const STEPS_PER_ROUND = 2 + SEASONS.length;

/**
 * The checkpoint's place in the session, counting from Round 1's Investment
 * phase at 0.
 */
function stepOf(checkpoint: Checkpoint): number {
    switch (checkpoint.kind) {
        case "not_started":
            return -1;
        case "investment":
            return roundStart(checkpoint.round);
        case "trading_period":
            return (
                roundStart(checkpoint.round) +
                1 +
                SEASONS.indexOf(checkpoint.season)
            );
        case "recap":
            return roundStart(checkpoint.round) + STEPS_PER_ROUND - 1;
        case "finished":
            return Infinity;
        default:
            throw checkpoint satisfies never;
    }
}

function roundStart(round: number): number {
    return (round - 1) * STEPS_PER_ROUND;
}

/** A node that spans the steps `first` to `last` of the session. */
function statusOf(current: number, first: number, last = first): NodeStatus {
    if (current < first) return "future";
    if (current > last) return "past";
    return "current";
}

/** Every Round of a session of `roundCount` Rounds, with each node's status. */
export function workshopTimeline(
    checkpoint: Checkpoint,
    roundCount: number,
): TimelineRound[] {
    const current = stepOf(checkpoint);
    return Array.from({ length: roundCount }, (_, index) => {
        const round = index + 1;
        const start = roundStart(round);
        return {
            round,
            status: statusOf(current, start, start + SEASONS.length),
            seasons: SEASONS.map((season, i) => ({
                season,
                status: statusOf(current, start + 1 + i),
            })),
            recap: statusOf(current, start + STEPS_PER_ROUND - 1),
        };
    });
}

/** The page for a Round: its overview. */
export function roundPage(round: number) {
    return {
        to: "/app/workshop/round/$round",
        params: { round: String(round) },
    } as const;
}

/** The page for one of a Round's Trading periods. */
export function tradingPeriodPage(round: number, season: Season) {
    return {
        to: "/app/workshop/round/$round/$season",
        params: { round: String(round), season },
    } as const;
}

/** The page for the Recap that closes a Round. */
export function recapPage(round: number) {
    return {
        to: "/app/workshop/recap/$round",
        params: { round: String(round) },
    } as const;
}

/**
 * The page for where the session is now, or `null` before it starts, when no
 * page has anything to show. During an Investment phase it is the Round's
 * overview, and once the session is over it is the last Recap.
 */
export function checkpointPage(checkpoint: Checkpoint, roundCount: number) {
    switch (checkpoint.kind) {
        case "not_started":
            return null;
        case "investment":
            return roundPage(checkpoint.round);
        case "trading_period":
            return tradingPeriodPage(checkpoint.round, checkpoint.season);
        case "recap":
            return recapPage(checkpoint.round);
        case "finished":
            return recapPage(roundCount);
        default:
            throw checkpoint satisfies never;
    }
}

/** The phase the session is in, as the top bar shows it. */
export function checkpointLabel(checkpoint: Checkpoint): string {
    switch (checkpoint.kind) {
        case "not_started":
            return "Waiting to start";
        case "investment":
            return `Round ${checkpoint.round} · Investment`;
        case "trading_period":
            return `Round ${checkpoint.round} · ${SEASON_LABELS[checkpoint.season]} trading`;
        case "recap":
            return `Round ${checkpoint.round} · Recap`;
        case "finished":
            return "Session over";
        default:
            throw checkpoint satisfies never;
    }
}
