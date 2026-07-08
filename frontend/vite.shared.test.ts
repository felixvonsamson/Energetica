import { describe, expect, it } from "vitest";

import { explicitBackendUrl, resolveLobbyProxyTarget } from "./vite.shared";

const APEX = "energetica-game.org";
const INSTANCE = "https://mar-27-2026.energetica-game.org";

describe("explicitBackendUrl", () => {
    it.each([
        ["unset", {}, undefined],
        // The regression that caused the recurring divergence: .env.example ships
        // VITE_BACKEND_URL= (empty), which must read as "no override", not "".
        [
            "empty string (shipped in .env.example)",
            { VITE_BACKEND_URL: "" },
            undefined,
        ],
        ["a pinned instance URL", { VITE_BACKEND_URL: INSTANCE }, INSTANCE],
        [
            "a local backend URL",
            { VITE_BACKEND_URL: "http://localhost:8000" },
            "http://localhost:8000",
        ],
    ])("%s → %s", (_label, env, expected) => {
        expect(explicitBackendUrl(env as Record<string, string>)).toBe(
            expected,
        );
    });
});

describe("resolveLobbyProxyTarget", () => {
    it.each([
        ["local (nothing set)", {}, "http://localhost:8001"],
        // Empty override must fall through exactly like an unset one — the app
        // config (truthy check) and this one (was `??`) used to disagree here.
        [
            "empty override → local",
            { VITE_BACKEND_URL: "" },
            "http://localhost:8001",
        ],
        [
            "empty override, apex set → lobby.{apex}",
            { VITE_BACKEND_URL: "", VITE_APEX_DOMAIN: APEX },
            `https://lobby.${APEX}`,
        ],
        [
            "apex selected (BACKEND=game) → lobby.{apex}",
            { VITE_APEX_DOMAIN: APEX },
            `https://lobby.${APEX}`,
        ],
        [
            "explicit override wins over apex",
            { VITE_BACKEND_URL: INSTANCE, VITE_APEX_DOMAIN: APEX },
            INSTANCE,
        ],
    ])("%s", (_label, env, expected) => {
        expect(resolveLobbyProxyTarget(env as Record<string, string>)).toBe(
            expected,
        );
    });
});
