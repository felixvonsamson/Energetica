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
    const deployment = process.env.BACKEND;
    return loadEnv(deployment ?? mode, process.cwd(), "");
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
