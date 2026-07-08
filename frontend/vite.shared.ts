import fs from "fs";
import path from "path";

import { loadEnv, type ProxyOptions } from "vite";

/**
 * Fixed dev-server ports, one per surface, so the app and lobby (and landing)
 * frontends can run at the same time without colliding on Vite's default 5173.
 * The app bundle's dev login redirect (`lobbyHref` in `src/lib/instances.ts`)
 * hard-codes the lobby port, so the two must agree.
 */
export const DEV_PORTS = { app: 5173, lobby: 5174, landing: 5175 } as const;

/**
 * Load the env for the deployment named by the `BACKEND` variable, else the
 * plain dev env. `BACKEND=game|edu|ethz` selects `.env.{game,edu,ethz}` (which
 * set `VITE_APEX_DOMAIN`), so `BACKEND=game bun run dev:app` points the dev
 * server at the live game deployment; unset falls back to the local backend.
 * Read here (not from a Vite `--mode` flag) so every surface's dev script stays
 * a static `vite`/`vite --config …` and the selector is uniform across them.
 */
export function loadDeploymentEnv(mode: string): Record<string, string> {
    const deployment = process.env.BACKEND || undefined;
    const env = loadEnv(deployment ?? mode, process.cwd(), "");
    // A misspelled or unsupported BACKEND would otherwise load no deployment file, leave
    // VITE_APEX_DOMAIN unset, and silently proxy to the local backend — so a command meant to
    // hit a live deployment would quietly exercise local data. Fail loudly instead. An explicit
    // VITE_BACKEND_URL always wins (it's the top of the precedence in resolveBackendUrl), so a
    // stale BACKEND in the shell must not pre-empt an override the developer set on purpose.
    if (
        deployment &&
        !env.VITE_BACKEND_URL &&
        !fs.existsSync(path.join(process.cwd(), `.env.${deployment}`))
    ) {
        const available = fs
            .readdirSync(process.cwd())
            .filter(
                (f) =>
                    f.startsWith(".env.") &&
                    !f.endsWith(".local") &&
                    f !== ".env.example",
            )
            .map((f) => f.slice(".env.".length));
        throw new Error(
            `[vite] BACKEND="${deployment}" has no matching frontend/.env.${deployment} ` +
                `(known: ${available.join(", ") || "none"}). Unset BACKEND for the local ` +
                `backend, or set VITE_BACKEND_URL to target a specific URL.`,
        );
    }
    return env;
}

/**
 * The explicit `VITE_BACKEND_URL` proxy override, or `undefined` when unset.
 *
 * `frontend/.env.example` ships `VITE_BACKEND_URL=` (empty), so a developer who
 * copies it must get the same "fall through to the deployment/local backend"
 * behaviour as leaving it out entirely — an empty string is _not_ a target.
 * Every proxy resolver funnels its override through this one predicate so they
 * cannot drift apart on that coercion again (the app config once used a truthy
 * check while the lobby config used `??`, which turned `""` into a broken proxy
 * target — the class of bug this centralises away).
 */
export function explicitBackendUrl(
    env: Record<string, string>,
): string | undefined {
    return env.VITE_BACKEND_URL || undefined;
}

/**
 * Which lobby backend the lobby dev server (`vite.config.lobby.ts`) proxies
 * `/api` to. Precedence mirrors the app config's `resolveBackendUrl`: an
 * explicit `VITE_BACKEND_URL` wins, else the selected deployment's lobby
 * (`lobby.{apex}` from `BACKEND=…`), else the local lobby backend
 * (`main_lobby.py`) on :8001. Pure and synchronous — unlike the app target, no
 * instance-slug discovery is needed, since the lobby always lives at the apex's
 * `lobby.` subdomain.
 */
export function resolveLobbyProxyTarget(env: Record<string, string>): string {
    const explicit = explicitBackendUrl(env);
    if (explicit) return explicit;
    return env.VITE_APEX_DOMAIN
        ? `https://lobby.${env.VITE_APEX_DOMAIN}`
        : "http://localhost:8001";
}

/**
 * Strip `Secure` and `Domain` from `Set-Cookie` on proxied responses so a
 * session cookie minted by an HTTPS backend round-trips through the
 * `http://localhost` dev origin. Without this, the browser won't persist the
 * fresh `Secure` cookie over plain-HTTP localhost (so a stale, foreign-signed
 * cookie lingers and every authed request 401s), and a parent-domain
 * (`Domain=.{apex}`) cookie — which the lobby backend sets — wouldn't match
 * `localhost` at all. No-op for a local backend, which sets neither attribute.
 *
 * Shared by every dev proxy that fronts an auth backend (vite.config.ts,
 * vite.config.lobby.ts): cookie-attribute handling is auth-critical plumbing,
 * so a fix here must reach all bundles at once.
 */
export const rewriteSetCookieForLocalhost: NonNullable<
    ProxyOptions["configure"]
> = (proxy) => {
    proxy.on("proxyRes", (proxyRes) => {
        const setCookie = proxyRes.headers["set-cookie"];
        if (setCookie) {
            proxyRes.headers["set-cookie"] = setCookie.map((cookie) =>
                cookie
                    .replace(/;\s*Secure/gi, "")
                    .replace(/;\s*Domain=[^;]*/gi, ""),
            );
        }
    });
};
