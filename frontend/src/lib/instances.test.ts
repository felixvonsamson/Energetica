import { describe, expect, it } from "vitest";

import { isValidRunSlug, resolveLobbyBaseUrl } from "./instances";

const APEX = "energetica-game.org";
const LOBBY_DEV = "http://localhost:5174";

describe("resolveLobbyBaseUrl (app → lobby login bounce)", () => {
    it.each([
        // Production build: apex baked in, cookie carries over the shared apex.
        [
            "prod build with apex → lobby.{apex}",
            { dev: false, apex: APEX, lobbyDevUrl: LOBBY_DEV },
            `https://lobby.${APEX}`,
        ],
        // Prod build with no apex (interim / same-origin) → relative path.
        [
            "prod build, no apex → null (relative fallback)",
            { dev: false, apex: undefined, lobbyDevUrl: LOBBY_DEV },
            null,
        ],
        // Full local stack: local lobby is the only lobby that can authenticate.
        [
            "dev, no apex → local lobby",
            { dev: true, apex: undefined, lobbyDevUrl: LOBBY_DEV },
            LOBBY_DEV,
        ],
        // The crux of the rethink: BACKEND=game bun run dev:app sets an apex, but
        // dev must STILL point at the local lobby — a remote lobby's cookie can
        // never reach localhost, so deriving lobby.{apex} would be theatre.
        [
            "dev WITH apex (BACKEND=game dev:app) → local lobby, NOT lobby.{apex}",
            { dev: true, apex: APEX, lobbyDevUrl: LOBBY_DEV },
            LOBBY_DEV,
        ],
        // VITE_LOBBY_URL override flows through untouched.
        [
            "dev with custom lobby dev URL",
            {
                dev: true,
                apex: undefined,
                lobbyDevUrl: "http://localhost:9999",
            },
            "http://localhost:9999",
        ],
    ])("%s", (_label, opts, expected) => {
        expect(resolveLobbyBaseUrl(opts)).toBe(expected);
    });
});

describe("isValidRunSlug", () => {
    it.each(["demo", "mar-27-2026", "a", "a".repeat(63)])(
        "accepts %s",
        (slug) => expect(isValidRunSlug(slug)).toBe(true),
    );

    it.each([
        ["empty", ""],
        ["uppercase", "Demo"],
        ["dotted (would split the host)", "a.b"],
        ["spaced", "a b"],
        ["leading hyphen", "-lead"],
        ["trailing hyphen", "trail-"],
        ["too long (64)", "a".repeat(64)],
        ["an IPv4 address", "10.0.0.5"],
    ])("rejects %s", (_label, slug) =>
        expect(isValidRunSlug(slug)).toBe(false),
    );
});
