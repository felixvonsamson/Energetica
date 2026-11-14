import { describe, expect, it } from "vitest";

import {
    bandRuns,
    compareRuns,
    runBadge,
    runBand,
    runStatus,
    type ListedRun,
} from "#core/run-list";

const NOW = new Date("2026-11-13T12:00:00Z");
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** An ISO timestamp `offset` ms from {@link NOW}. */
function at(offset: number): string {
    return new Date(NOW.getTime() + offset).toISOString();
}

/** A live freeplay run the account plays, unless overridden. */
function run(overrides: Partial<ListedRun> & { slug: string }): ListedRun {
    return {
        name: overrides.slug,
        mode: "freeplay",
        relation: "player",
        starts_at: at(-10 * DAY),
        freeze_at: at(10 * DAY),
        ended_at: at(20 * DAY),
        ...overrides,
    };
}

const live = (slug: string, o: Partial<ListedRun> = {}) => run({ slug, ...o });
const soon = (slug: string, o: Partial<ListedRun> = {}) =>
    run({ slug, starts_at: at(30 * MIN), ...o });
const upcoming = (slug: string, o: Partial<ListedRun> = {}) =>
    run({ slug, starts_at: at(5 * DAY), ...o });
const frozen = (slug: string, o: Partial<ListedRun> = {}) =>
    run({
        slug,
        starts_at: at(-30 * DAY),
        freeze_at: at(-2 * DAY),
        ended_at: at(7 * DAY),
        ...o,
    });
const ended = (slug: string, o: Partial<ListedRun> = {}) =>
    run({
        slug,
        starts_at: at(-90 * DAY),
        freeze_at: at(-40 * DAY),
        ended_at: at(-26 * DAY),
        ...o,
    });

/** Sort with the total ordering and return the slugs. */
function order(runs: ListedRun[]): string[] {
    return [...runs].sort((a, b) => compareRuns(a, b, NOW)).map((r) => r.slug);
}

describe("runStatus and runBand", () => {
    it.each([
        ["starts in exactly 1 hour", at(HOUR), "starting-soon", "now"],
        [
            "starts in 1 hour and 1 minute",
            at(HOUR + MIN),
            "upcoming",
            "coming-up",
        ],
        ["started", at(-MIN), "live", "now"],
    ] as const)("a run that %s is %s, in %s", (_, starts_at, status, band) => {
        const r = run({ slug: "r", starts_at });
        expect(runStatus(r, NOW)).toBe(status);
        expect(runBand(r, NOW)).toBe(band);
    });

    it("frozen and ended runs are Past", () => {
        expect(runStatus(frozen("f"), NOW)).toBe("frozen");
        expect(runBand(frozen("f"), NOW)).toBe("past");
        expect(runStatus(ended("e"), NOW)).toBe("ended");
        expect(runBand(ended("e"), NOW)).toBe("past");
    });

    it("an open-ended run stays live", () => {
        const open = run({ slug: "o", freeze_at: null, ended_at: null });
        expect(runBand(open, new Date("2099-01-01"))).toBe("now");
    });
});

describe("compareRuns: Now", () => {
    it("puts runs starting soon at the top, ahead of live workshops", () => {
        expect(
            order([
                live("live-workshop", { mode: "workshop" }),
                soon("soon-freeplay-visitor", { relation: "visitor" }),
            ]),
        ).toEqual(["soon-freeplay-visitor", "live-workshop"]);
    });

    it("orders runs starting soon by when they start", () => {
        expect(
            order([
                soon("later", { starts_at: at(50 * MIN) }),
                soon("sooner", { starts_at: at(10 * MIN) }),
            ]),
        ).toEqual(["sooner", "later"]);
    });

    it("orders runs starting soon by start before mode and relation", () => {
        expect(
            order([
                soon("own-workshop-later", {
                    mode: "workshop",
                    starts_at: at(55 * MIN),
                }),
                soon("visitor-freeplay-sooner", {
                    relation: "visitor",
                    starts_at: at(5 * MIN),
                }),
            ]),
        ).toEqual(["visitor-freeplay-sooner", "own-workshop-later"]);
    });

    it("falls back to mode and relation for runs starting at the same time", () => {
        expect(
            order([
                soon("a-freeplay", { starts_at: at(20 * MIN) }),
                soon("b-workshop", {
                    mode: "workshop",
                    starts_at: at(20 * MIN),
                }),
            ]),
        ).toEqual(["b-workshop", "a-freeplay"]);
    });

    it("puts workshops before freeplay, then own runs before joinable ones", () => {
        expect(
            order([
                live("freeplay-visitor", { relation: "visitor" }),
                live("freeplay-own"),
                live("workshop-visitor", {
                    mode: "workshop",
                    relation: "visitor",
                }),
                live("workshop-facilitated", {
                    mode: "workshop",
                    relation: "facilitator",
                }),
            ]),
        ).toEqual([
            "workshop-facilitated",
            "workshop-visitor",
            "freeplay-own",
            "freeplay-visitor",
        ]);
    });

    it("ranks played and facilitated runs equally", () => {
        expect(
            order([
                live("b-facilitated", { relation: "facilitator" }),
                live("a-played"),
            ]),
        ).toEqual(["a-played", "b-facilitated"]);
    });

    it("orders live runs by soonest freeze, open-ended last, then by name", () => {
        expect(
            order([
                live("open", { freeze_at: null, ended_at: null }),
                live("late", { freeze_at: at(9 * DAY) }),
                live("early", { freeze_at: at(2 * DAY) }),
                live("z-tied", { name: "Beta", freeze_at: at(5 * DAY) }),
                live("a-tied", { name: "Gamma", freeze_at: at(5 * DAY) }),
            ]),
        ).toEqual(["early", "z-tied", "a-tied", "late", "open"]);
    });

    it("reads a run with no mode as freeplay", () => {
        expect(
            order([
                live("a-unknown", { mode: undefined }),
                live("b-workshop", { mode: "workshop" }),
            ]),
        ).toEqual(["b-workshop", "a-unknown"]);
    });
});

describe("compareRuns: Coming up", () => {
    it("puts workshops first, then own runs, then soonest start", () => {
        expect(
            order([
                upcoming("freeplay-late", { starts_at: at(9 * DAY) }),
                upcoming("freeplay-early", { starts_at: at(3 * DAY) }),
                upcoming("freeplay-visitor", {
                    relation: "visitor",
                    starts_at: at(2 * DAY),
                }),
                upcoming("workshop", {
                    mode: "workshop",
                    starts_at: at(20 * DAY),
                }),
            ]),
        ).toEqual([
            "workshop",
            "freeplay-early",
            "freeplay-late",
            "freeplay-visitor",
        ]);
    });
});

describe("compareRuns: Past", () => {
    it("puts frozen before ended, own before public, then most recent freeze", () => {
        expect(
            order([
                ended("ended-own-old", { freeze_at: at(-300 * DAY) }),
                ended("ended-public", { relation: "visitor" }),
                ended("ended-own-recent", { freeze_at: at(-20 * DAY) }),
                frozen("frozen-public", { relation: "visitor" }),
                frozen("frozen-own"),
            ]),
        ).toEqual([
            "frozen-own",
            "frozen-public",
            "ended-own-recent",
            "ended-own-old",
            "ended-public",
        ]);
    });

    it("ignores mode", () => {
        expect(
            order([
                ended("workshop", {
                    mode: "workshop",
                    freeze_at: at(-50 * DAY),
                }),
                ended("freeplay", { freeze_at: at(-45 * DAY) }),
            ]),
        ).toEqual(["freeplay", "workshop"]);
    });
});

describe("compareRuns: across bands", () => {
    it("orders Now, then Coming up, then Past", () => {
        expect(
            order([
                ended("e"),
                upcoming("u"),
                frozen("f"),
                live("l"),
                soon("s"),
            ]),
        ).toEqual(["s", "l", "u", "f", "e"]);
    });

    it("breaks a full tie by slug, so input order does not matter", () => {
        const a = live("a", { name: "Same" });
        const b = live("b", { name: "Same" });
        expect(order([b, a])).toEqual(["a", "b"]);
        expect(order([a, b])).toEqual(["a", "b"]);
    });
});

describe("bandRuns", () => {
    it("cuts the order into bands and drops empty ones", () => {
        const bands = bandRuns(
            [ended("e"), live("l2", { mode: "workshop" }), live("l1")],
            NOW,
        );
        expect(
            bands.map(({ band, runs }) => [band, runs.map((r) => r.slug)]),
        ).toEqual([
            ["now", ["l2", "l1"]],
            ["past", ["e"]],
        ]);
    });

    it("returns no bands for no runs", () => {
        expect(bandRuns([], NOW)).toEqual([]);
    });

    it("keeps the caller's own fields", () => {
        const extra = { ...live("l"), joined_at: "2026-01-01T00:00:00Z" };
        expect(bandRuns([extra], NOW)[0]?.runs[0]?.joined_at).toBe(
            "2026-01-01T00:00:00Z",
        );
    });
});

describe("runBadge", () => {
    const format = { locale: "en-GB", timeZone: "UTC" };
    const badge = (r: ListedRun) => runBadge(r, NOW, format);

    it("is null for a live run", () => {
        expect(badge(live("l"))).toBeNull();
    });

    it.each([
        [
            "starting soon",
            soon("s", { starts_at: at(24 * MIN + 10_000) }),
            "starting-soon",
            "Starts in 25 min",
            "warning",
        ],
        [
            "starting in under a minute",
            soon("s", { starts_at: at(1_000) }),
            "starting-soon",
            "Starts in 1 min",
            "warning",
        ],
        [
            "upcoming",
            upcoming("u", { starts_at: "2026-11-18T09:00:00Z" }),
            "upcoming",
            "Starts 18 Nov",
            "info",
        ],
        [
            "upcoming next year",
            upcoming("u", { starts_at: "2027-01-05T09:00:00Z" }),
            "upcoming",
            "Starts 5 Jan 2027",
            "info",
        ],
        [
            "frozen",
            frozen("f", { ended_at: "2026-11-24T00:00:00Z" }),
            "frozen",
            "Frozen, viewable until 24 Nov",
            "frozen",
        ],
        [
            "frozen with no end",
            frozen("f", { ended_at: null }),
            "frozen",
            "Frozen",
            "frozen",
        ],
        [
            "ended",
            ended("e", { ended_at: "2026-08-10T00:00:00Z" }),
            "ended",
            "Ended Aug 2026",
            "muted-foreground",
        ],
    ] as const)("%s", (_, r, status, text, colour) => {
        expect(badge(r)).toEqual({ status, text, colour });
    });
});
