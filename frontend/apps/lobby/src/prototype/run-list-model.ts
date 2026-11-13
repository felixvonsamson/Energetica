/**
 * PROTOTYPE — throwaway, for "What should the lobby's run list look like?"
 * (#1039). Not production code: no tests, no edge cases.
 *
 * Fixture runs covering every phase × relation × mode, plus a quick copy of the
 * decided ordering, band assignment and badge text (the grilling outcome on
 * #1039). The real versions go in `@energetica/core` in the build ticket.
 */

import { derivePhase, type Phase } from "@energetica/core/instances";

export type Mode = "freeplay" | "workshop";
export type Relation = "player" | "facilitator" | "visitor";
export type Band = "now" | "coming-up" | "past";

/** The phase as the badge shows it: `announced` splits on the 1-hour window. */
export type BadgePhase = "live" | "soon" | "upcoming" | "frozen" | "ended";

export type ProtoRun = {
    slug: string;
    name: string;
    mode: Mode;
    relation: Relation;
    starts_at: string;
    freeze_at: string | null;
    ended_at: string | null;
    joined_at: string | null;
};

export type ListedRun = ProtoRun & {
    phase: Phase;
    badgePhase: BadgePhase;
    badgeText: string;
    band: Band;
};

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

function at(offsetMs: number): string {
    return new Date(Date.now() + offsetMs).toISOString();
}

let counter = 0;
function run(
    name: string,
    mode: Mode,
    relation: Relation,
    startsIn: number,
    freezeIn: number | null,
    endIn: number | null,
): ProtoRun {
    counter += 1;
    return {
        slug: `proto-${counter}`,
        name,
        mode,
        relation,
        starts_at: at(startsIn),
        freeze_at: freezeIn === null ? null : at(freezeIn),
        ended_at: endIn === null ? null : at(endIn),
        joined_at: relation === "visitor" ? null : at(-40 * DAY),
    };
}

/**
 * Every phase (live, starting soon, upcoming, frozen, ended) × relation
 * (player, facilitator, visitor) × mode (freeplay, workshop): 30 runs.
 */
export function allCombinations(): ProtoRun[] {
    counter = 0;
    const out: ProtoRun[] = [];
    const modes: Mode[] = ["workshop", "freeplay"];
    const relations: Relation[] = ["player", "facilitator", "visitor"];
    for (const mode of modes) {
        for (const relation of relations) {
            const tag = `${mode === "workshop" ? "Workshop" : "Freeplay"} · ${relation}`;
            out.push(
                run(
                    `Live — ${tag}`,
                    mode,
                    relation,
                    -10 * DAY,
                    20 * DAY,
                    34 * DAY,
                ),
            );
            out.push(
                run(
                    `Soon — ${tag}`,
                    mode,
                    relation,
                    25 * MIN,
                    3 * DAY,
                    10 * DAY,
                ),
            );
            out.push(
                run(
                    `Upcoming — ${tag}`,
                    mode,
                    relation,
                    9 * DAY,
                    30 * DAY,
                    44 * DAY,
                ),
            );
            out.push(
                run(
                    `Frozen — ${tag}`,
                    mode,
                    relation,
                    -30 * DAY,
                    -2 * DAY,
                    7 * DAY,
                ),
            );
            out.push(
                run(
                    `Ended — ${tag}`,
                    mode,
                    relation,
                    -90 * DAY,
                    -40 * DAY,
                    -26 * DAY,
                ),
            );
        }
    }
    return out;
}

/** A plausible signed-in player: a handful of runs, some history. */
export function typicalSignedIn(): ProtoRun[] {
    counter = 0;
    return [
        run(
            "ETH Energy Systems — Group B",
            "workshop",
            "player",
            -2 * HOUR,
            3 * HOUR,
            7 * DAY,
        ),
        run(
            "Autumn Freeplay 2026",
            "freeplay",
            "player",
            -21 * DAY,
            40 * DAY,
            54 * DAY,
        ),
        run("Open World", "freeplay", "player", -200 * DAY, null, null),
        run(
            "EPFL Masterclass",
            "workshop",
            "facilitator",
            25 * MIN,
            4 * HOUR,
            7 * DAY,
        ),
        run(
            "Winter Freeplay 2026",
            "freeplay",
            "visitor",
            -3 * DAY,
            60 * DAY,
            74 * DAY,
        ),
        run(
            "Speedrun Sprint",
            "freeplay",
            "visitor",
            12 * DAY,
            19 * DAY,
            33 * DAY,
        ),
        run(
            "Climate Policy Seminar",
            "workshop",
            "player",
            5 * DAY,
            5 * DAY + 4 * HOUR,
            12 * DAY,
        ),
        run(
            "Summer Freeplay 2026",
            "freeplay",
            "player",
            -120 * DAY,
            -3 * DAY,
            11 * DAY,
        ),
        run(
            "ZHAW Workshop — Spring",
            "workshop",
            "facilitator",
            -200 * DAY,
            -190 * DAY,
            -176 * DAY,
        ),
        run(
            "Spring Freeplay 2026",
            "freeplay",
            "player",
            -220 * DAY,
            -100 * DAY,
            -86 * DAY,
        ),
        run(
            "Beta Run",
            "freeplay",
            "player",
            -400 * DAY,
            -300 * DAY,
            -286 * DAY,
        ),
        run(
            "Public Recap: Summer Cup",
            "freeplay",
            "visitor",
            -150 * DAY,
            -60 * DAY,
            -46 * DAY,
        ),
    ];
}

/** Logged out: only joinable runs and public recaps. */
export function loggedOut(): ProtoRun[] {
    return typicalSignedIn().filter((r) => r.relation === "visitor");
}

const SOON_WINDOW = HOUR;

function badgeFor(
    r: ProtoRun,
    phase: Phase,
): { badgePhase: BadgePhase; badgeText: string } {
    const now = Date.now();
    const short = (iso: string) =>
        new Intl.DateTimeFormat(undefined, {
            day: "numeric",
            month: "short",
        }).format(new Date(iso));
    switch (phase) {
        case "active":
            return { badgePhase: "live", badgeText: "Live" };
        case "announced": {
            const until = new Date(r.starts_at).getTime() - now;
            if (until <= SOON_WINDOW) {
                return {
                    badgePhase: "soon",
                    badgeText: `Starts in ${Math.max(1, Math.round(until / MIN))} min`,
                };
            }
            return {
                badgePhase: "upcoming",
                badgeText: `Starts ${short(r.starts_at)}`,
            };
        }
        case "freeze":
            return {
                badgePhase: "frozen",
                badgeText: r.ended_at
                    ? `Frozen, viewable until ${short(r.ended_at)}`
                    : "Frozen",
            };
        case "ended": {
            const month = new Intl.DateTimeFormat(undefined, {
                month: "short",
                year: "numeric",
            }).format(new Date(r.ended_at ?? r.freeze_at ?? r.starts_at));
            return { badgePhase: "ended", badgeText: `Ended ${month}` };
        }
    }
}

function bandFor(badgePhase: BadgePhase): Band {
    if (badgePhase === "live" || badgePhase === "soon") return "now";
    if (badgePhase === "upcoming") return "coming-up";
    return "past";
}

const ts = (iso: string | null) =>
    iso ? new Date(iso).getTime() : Number.POSITIVE_INFINITY;

function compare(a: ListedRun, b: ListedRun): number {
    if (a.band === "past") {
        if (a.badgePhase !== b.badgePhase)
            return a.badgePhase === "frozen" ? -1 : 1;
        const ay = a.relation !== "visitor",
            by = b.relation !== "visitor";
        if (ay !== by) return ay ? -1 : 1;
        return ts(b.freeze_at) - ts(a.freeze_at);
    }
    if (a.mode !== b.mode) return a.mode === "workshop" ? -1 : 1;
    const ay = a.relation !== "visitor",
        by = b.relation !== "visitor";
    if (ay !== by) return ay ? -1 : 1;
    if (a.badgePhase !== b.badgePhase) {
        if (a.badgePhase === "soon") return -1;
        if (b.badgePhase === "soon") return 1;
    }
    const key = a.band === "coming-up" ? "starts_at" : "freeze_at";
    const d = ts(a[key]) - ts(b[key]);
    if (d !== 0 && Number.isFinite(d)) return d;
    if (ts(a[key]) !== ts(b[key])) return ts(a[key]) < ts(b[key]) ? -1 : 1;
    return a.name.localeCompare(b.name);
}

/** Order every run and cut the order into bands. Empty bands are dropped. */
export function bandRuns(
    runs: ProtoRun[],
): { band: Band; runs: ListedRun[] }[] {
    const listed: ListedRun[] = runs.map((r) => {
        const phase = derivePhase(r);
        const badge = badgeFor(r, phase);
        return { ...r, phase, ...badge, band: bandFor(badge.badgePhase) };
    });
    // Within Now, "starting soon" sits above everything (moved to the top, not duplicated).
    const sorted = listed.sort((a, b) => {
        if (
            a.band === "now" &&
            b.band === "now" &&
            (a.badgePhase === "soon") !== (b.badgePhase === "soon")
        ) {
            return a.badgePhase === "soon" ? -1 : 1;
        }
        return compare(a, b);
    });
    const bands: Band[] = ["now", "coming-up", "past"];
    return bands
        .map((band) => ({ band, runs: sorted.filter((r) => r.band === band) }))
        .filter((b) => b.runs.length > 0);
}

export const BAND_TITLES: Record<Band, string> = {
    now: "Now",
    "coming-up": "Coming up",
    past: "Past",
};

/** The actions a card offers, per the grilling outcome. */
export function actionsFor(r: ListedRun): {
    primary: string;
    secondary: string | null;
} {
    if (r.badgePhase === "ended")
        return { primary: "View recap", secondary: null };
    if (r.badgePhase === "frozen")
        return { primary: "View recap", secondary: "Open run (read-only)" };
    const live = {
        player: "Play",
        facilitator: "Manage",
        visitor: "Join",
    } as const;
    return { primary: live[r.relation], secondary: null };
}

/**
 * The row's subtitle, after the badge.
 *
 * - "Workshop" for a workshop; nothing for freeplay, which has no good
 *   player-facing name.
 * - No join or grant date: workshops last half a day and players are usually
 *   invited, so "Joined …" and "Facilitating since …" both misread.
 * - The relation only in Past. For a live or upcoming run the action already says
 *   it (Play, Manage, Join); in Past every row says "View recap", so "You
 *   played" / "You facilitated" tells your runs from public recaps.
 */
export function subtitleParts(r: ListedRun): string[] {
    const parts: string[] = [];
    if (r.mode === "workshop") parts.push("Workshop");
    if (r.band === "past" && r.relation === "player") parts.push("You played");
    if (r.band === "past" && r.relation === "facilitator")
        parts.push("You facilitated");
    return parts;
}

/** The "Switch run" menu's rows: your runs from Now and Coming up, same order. */
export function switchRunRows(
    bands: { band: Band; runs: ListedRun[] }[],
): ListedRun[] {
    return bands
        .filter((b) => b.band !== "past")
        .flatMap((b) => b.runs)
        .filter((r) => r.relation !== "visitor");
}
