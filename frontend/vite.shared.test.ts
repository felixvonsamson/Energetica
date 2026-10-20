import fs from "fs";
import os from "os";
import path from "path";

import type { ResolvedConfig } from "vite";
import { afterEach, describe, expect, it } from "vitest";

import {
    buildInfoPlugin,
    explicitBackendUrl,
    instanceSlugFromBackend,
    resolveLobbyProxyTarget,
} from "./vite.shared";

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

describe("instanceSlugFromBackend", () => {
    it.each([
        ["a live instance subdomain", INSTANCE, APEX, "mar-27-2026"],
        ["single-label slug", `https://prod.${APEX}`, APEX, "prod"],
        // Not an instance under the apex → no pinned slug.
        ["local backend", "http://localhost:8000", APEX, null],
        ["no apex configured", INSTANCE, undefined, null],
        [
            "the bare apex (landing, not an instance)",
            `https://${APEX}`,
            APEX,
            null,
        ],
        ["a different apex", "https://x.example.com", APEX, null],
        // A nested/deep subdomain isn't a single valid run label.
        ["nested subdomain", `https://a.b.${APEX}`, APEX, null],
        ["an IP address", "http://10.0.0.5", APEX, null],
        ["unparseable URL", "not a url", APEX, null],
    ])("%s", (_label, url, apex, expected) => {
        expect(instanceSlugFromBackend(url, apex)).toBe(expected);
    });
});

describe("buildInfoPlugin", () => {
    const tmpDirs: string[] = [];
    afterEach(() => {
        for (const dir of tmpDirs.splice(0)) {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    function makeTmpDir(): string {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "build-info-"));
        tmpDirs.push(dir);
        return dir;
    }

    // Run the plugin's two hooks the way Vite would, with only the config
    // fields it reads.
    function runPlugin(root: string, outDir: string) {
        const plugin = buildInfoPlugin();
        const config = { root, build: { outDir } } as ResolvedConfig;
        (plugin.configResolved as (c: ResolvedConfig) => void)(config);
        (plugin.closeBundle as () => void)();
    }

    // The regression: the landing app's root (apps/landing) need not be the
    // process cwd, so a relative outDir must resolve against the root.
    it("resolves a relative outDir against the config root", () => {
        const root = makeTmpDir();
        expect(root).not.toBe(process.cwd());
        runPlugin(root, "dist");
        const stamp = JSON.parse(
            fs.readFileSync(path.join(root, "dist", "build-info.json"), "utf8"),
        );
        expect(stamp.source).toBe("build");
    });

    it("writes to an absolute outDir as given", () => {
        const outDir = path.join(makeTmpDir(), "out");
        runPlugin(makeTmpDir(), outDir);
        expect(fs.existsSync(path.join(outDir, "build-info.json"))).toBe(true);
    });
});
