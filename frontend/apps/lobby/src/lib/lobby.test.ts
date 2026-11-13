import { describe, expect, it } from "vitest";

import { resolveRunAppHref, validateReturnSearch } from "./lobby";

const APEX = "energetica-game.org";
const APP_DEV = "http://localhost:5173";

describe("resolveRunAppHref (lobby → app entry link)", () => {
    it.each([
        // Production: run lives at {slug}.{apex}, cookie carries over the apex.
        [
            "prod → {slug}.{apex}/app",
            { apex: APEX, slug: "mar-27-2026", appDevUrl: APP_DEV, dev: false },
            `https://mar-27-2026.${APEX}/app`,
        ],
        // Full local stack: single local app backend serves every run — point at
        // the app dev server (mirror of the app's LOBBY_DEV_URL bounce).
        [
            "dev, no apex → app dev server",
            { apex: null, slug: "demo", appDevUrl: APP_DEV, dev: true },
            `${APP_DEV}/app`,
        ],
        [
            "dev with custom app dev URL (VITE_APP_URL)",
            {
                apex: null,
                slug: "demo",
                appDevUrl: "http://localhost:9998",
                dev: true,
            },
            "http://localhost:9998/app",
        ],
        // Invalid slug never becomes a host — relative fallback, even in prod.
        [
            "invalid slug (prod) → relative /app",
            { apex: APEX, slug: "not a slug", appDevUrl: APP_DEV, dev: false },
            "/app",
        ],
        [
            "invalid slug (dev) → relative /app",
            { apex: null, slug: "not a slug", appDevUrl: APP_DEV, dev: true },
            "/app",
        ],
        // Non-dev with no apex (misconfig) must NOT leak to a localhost origin.
        [
            "no apex, not dev → relative /app (never localhost)",
            { apex: null, slug: "demo", appDevUrl: APP_DEV, dev: false },
            "/app",
        ],
    ])("%s", (_label, opts, expected) => {
        expect(resolveRunAppHref(opts)).toBe(expected);
    });
});

describe("validateReturnSearch", () => {
    it("keeps a valid return slug", () => {
        expect(validateReturnSearch({ return: "mar-27-2026" })).toEqual({
            return: "mar-27-2026",
        });
    });

    it.each([
        ["invalid slug", { return: "bad slug" }],
        ["non-string", { return: 42 }],
        ["absent", {}],
    ])("drops %s", (_label, search) => {
        expect(validateReturnSearch(search as Record<string, unknown>)).toEqual(
            {
                return: undefined,
            },
        );
    });
});
