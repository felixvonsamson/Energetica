import { describe, expect, it } from "vitest";

import { isSingleOrigin, SINGLE_ORIGIN_HOSTS } from "./single-origin";

describe("isSingleOrigin (proxy-host detection)", () => {
    it.each([...SINGLE_ORIGIN_HOSTS])("treats %s as single-origin", (host) => {
        expect(isSingleOrigin(host)).toBe(true);
    });

    it.each([
        // Real deployment origins must NOT flip into single-origin mode.
        ["apex", "energetica-game.org"],
        ["instance subdomain", "hertz.energetica-game.org"],
        ["lobby subdomain", "lobby.energetica-game.org"],
        ["edu apex", "energetica-edu.org"],
        ["local dev", "localhost"],
        // A subdomain of a proxy host is a different (non-listed) origin.
        ["subdomain of a proxy host", "lobby.energetica.ethz.ch"],
        // Substring / suffix look-alikes must not match — exact host only.
        ["look-alike suffix", "evil-energetica.ethz.ch.attacker.com"],
        ["empty", ""],
    ])("does not treat %s as single-origin", (_label, host) => {
        expect(isSingleOrigin(host)).toBe(false);
    });
});
