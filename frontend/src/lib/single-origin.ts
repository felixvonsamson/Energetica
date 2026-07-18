/**
 * Single-origin proxy hosts.
 *
 * Some players sit behind a VPN that cannot reach `*.energetica-game.org` but
 * can reach a foreign host — `energetica.ethz.ch` — that reverse-proxies the
 * game. That host fronts the lobby AND a single game instance on **one origin**
 * (see the ADR-0002 amendment and `scripts/infra/apache-ethz-proxy.conf`),
 * because the ETHZ domain is not ours to carve subdomains from.
 *
 * On such a host the per-subdomain URL scheme (`lobby.{apex}`, `{slug}.{apex}`)
 * does not resolve, so the frontend must (a) build **same-origin** links instead
 * of cross-subdomain ones (see `apexDomain()` in `lib/instances.ts`) and
 * (b) collapse the multi-run chooser — there is exactly one reachable run, so
 * the picker bounces straight into it and the in-run switcher hides its lateral
 * hops.
 *
 * This is an explicit allowlist, deliberately **not** a heuristic ("hostname
 * isn't my build-time apex"): it drives auth-adjacent behaviour, so a reviewer
 * should see exactly which hosts flip it, and adding one is a one-line, reviewed
 * change. It ships in every bundle and is inert unless the current host is
 * listed.
 */
export const SINGLE_ORIGIN_HOSTS: ReadonlySet<string> = new Set([
    "energetica.ethz.ch",
]);

/**
 * Pure core of {@link isSingleOriginHost}: whether `hostname` is a single-origin
 * proxy host. Host injected so the rule is unit-testable without stubbing
 * `window.location`.
 */
export function isSingleOrigin(hostname: string): boolean {
    return SINGLE_ORIGIN_HOSTS.has(hostname);
}

/**
 * Whether this bundle is being served from a single-origin proxy host. `false`
 * outside a browser (SSR / tests) and for every normal deployment origin.
 */
export function isSingleOriginHost(): boolean {
    return (
        typeof window !== "undefined" &&
        isSingleOrigin(window.location.hostname)
    );
}
