import { describe, expect, it } from "vitest";

import { derivePhase, isValidRunSlug, resolveLobbyBaseUrl } from "./instances";

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

describe("derivePhase (must mirror backend derive_phase)", () => {
    const lifecycle = {
        starts_at: "2026-01-01T00:00:00Z",
        freeze_at: "2026-02-01T00:00:00Z",
        ended_at: "2026-03-01T00:00:00Z",
    };
    const at = (iso: string) => new Date(iso);

    it.each([
        ["before starts_at → announced", "2025-12-31T00:00:00Z", "announced"],
        ["exactly starts_at → active", "2026-01-01T00:00:00Z", "active"],
        ["mid-active", "2026-01-15T00:00:00Z", "active"],
        ["exactly freeze_at → freeze", "2026-02-01T00:00:00Z", "freeze"],
        ["mid-freeze", "2026-02-15T00:00:00Z", "freeze"],
        ["exactly ended_at → ended", "2026-03-01T00:00:00Z", "ended"],
        ["after ended_at", "2026-04-01T00:00:00Z", "ended"],
    ])("%s", (_label, now, expected) => {
        expect(derivePhase(lifecycle, at(now))).toBe(expected);
    });

    it("open-ended run (no freeze/ended) stays active once started", () => {
        const open = { starts_at: "2026-01-01T00:00:00Z" };
        expect(derivePhase(open, at("2099-01-01T00:00:00Z"))).toBe("active");
        expect(derivePhase(open, at("2025-01-01T00:00:00Z"))).toBe("announced");
    });

    it("null boundaries are never crossed", () => {
        const open = {
            starts_at: "2026-01-01T00:00:00Z",
            freeze_at: null,
            ended_at: null,
        };
        expect(derivePhase(open, at("2030-01-01T00:00:00Z"))).toBe("active");
    });

    it("ended fires even with no freeze_at (active → ended)", () => {
        const noFreeze = {
            starts_at: "2026-01-01T00:00:00Z",
            freeze_at: null,
            ended_at: "2026-03-01T00:00:00Z",
        };
        expect(derivePhase(noFreeze, at("2026-02-15T00:00:00Z"))).toBe(
            "active",
        );
        expect(derivePhase(noFreeze, at("2026-03-02T00:00:00Z"))).toBe("ended");
    });

    it("an unparseable boundary degrades toward the earlier phase", () => {
        const bad = {
            starts_at: "2026-01-01T00:00:00Z",
            freeze_at: "not-a-date",
        };
        expect(derivePhase(bad, at("2026-06-01T00:00:00Z"))).toBe("active");
    });
});
