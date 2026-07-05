import type { ProxyOptions } from "vite";

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
