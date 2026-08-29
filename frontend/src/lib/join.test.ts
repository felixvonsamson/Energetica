import { describe, expect, it } from "vitest";

import { rememberPendingJoinToken, takePendingJoinToken } from "./join";

/**
 * Minimal in-memory `Storage` stand-in — no DOM environment needed to test the
 * round trip.
 */
function fakeStorage(): Storage {
    const data = new Map<string, string>();
    return {
        getItem: (key) => data.get(key) ?? null,
        setItem: (key, value) => void data.set(key, value),
        removeItem: (key) => void data.delete(key),
        clear: () => data.clear(),
        key: () => null,
        get length() {
            return data.size;
        },
    };
}

describe("pending join token (storage round trip)", () => {
    it("returns null when nothing was remembered", () => {
        expect(takePendingJoinToken(fakeStorage())).toBeNull();
    });

    it("returns a remembered token", () => {
        const storage = fakeStorage();
        rememberPendingJoinToken("abc123", storage);
        expect(takePendingJoinToken(storage)).toBe("abc123");
    });

    it("clears the token on read, so a second read finds nothing", () => {
        const storage = fakeStorage();
        rememberPendingJoinToken("abc123", storage);
        takePendingJoinToken(storage);
        expect(takePendingJoinToken(storage)).toBeNull();
    });

    it("overwrites a previously remembered token", () => {
        const storage = fakeStorage();
        rememberPendingJoinToken("first", storage);
        rememberPendingJoinToken("second", storage);
        expect(takePendingJoinToken(storage)).toBe("second");
    });

    it("swallows a storage that throws (e.g. private browsing) rather than crashing", () => {
        const throwing: Storage = {
            getItem: () => {
                throw new Error("blocked");
            },
            setItem: () => {
                throw new Error("blocked");
            },
            removeItem: () => {
                throw new Error("blocked");
            },
            clear: () => {},
            key: () => null,
            length: 0,
        };
        expect(() =>
            rememberPendingJoinToken("abc123", throwing),
        ).not.toThrow();
        expect(takePendingJoinToken(throwing)).toBeNull();
    });

    it("no-ops when storage is unavailable (undefined)", () => {
        expect(() =>
            rememberPendingJoinToken("abc123", undefined),
        ).not.toThrow();
        expect(takePendingJoinToken(undefined)).toBeNull();
    });
});
