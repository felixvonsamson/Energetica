/**
 * Lobby-side URL construction.
 *
 * The lobby lives on `lobby.{apex}`; every link out of it — into a run
 * (`{slug}.{apex}/app`) or back to the landing (`https://{apex}/...`) — is
 * _constructed_ against the apex derived from the current hostname, never
 * passed through from user input. The `?return=` slug is validated against the
 * runs the lobby already knows and only ever interpolated into this fixed
 * template, so no open redirect is possible.
 *
 * The landing derives its apex from the build-time `VITE_APEX_DOMAIN` instead
 * (`lib/instances.ts`); the lobby can do better because its own hostname always
 * carries the apex in production.
 */

const LOBBY_HOSTNAME_PREFIX = "lobby.";

/**
 * The slug shape the infra enforces at provision time (setup-instance.sh):
 * lowercase kebab-case within a DNS label's 63-char limit. Checked again here
 * because a slug becomes a _hostname_ — an admin-created or migrated run with a
 * dotted, spaced, or overlong slug must never produce a URL whose host is
 * something other than a valid `{slug}.{apex}`.
 */
const RUN_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** Whether `slug` is safe to use as the run's subdomain label. */
export function isValidRunSlug(slug: string): boolean {
    return RUN_SLUG_PATTERN.test(slug);
}

/**
 * Apex domain the lobby serves, derived from the current hostname
 * (`lobby.energetica-game.org` → `energetica-game.org`). `null` in dev, where
 * the bundle is served from `localhost` and no apex exists.
 */
export function lobbyApexDomain(): string | null {
    const { hostname } = window.location;
    if (!hostname.startsWith(LOBBY_HOSTNAME_PREFIX)) return null;
    return hostname.slice(LOBBY_HOSTNAME_PREFIX.length);
}

/**
 * A run's app entry point, as an absolute cross-origin URL.
 *
 * Without an apex (local `bun run dev:lobby`) this falls back to a relative
 * `/app` that does not resolve inside the lobby dev server — the same accepted
 * dead-dev-link stance as `landingHref` in `lib/instances.ts`. A slug that is
 * not a valid DNS label gets the same fallback: a dead same-origin link beats a
 * cross-origin URL pointing at a host we did not intend.
 */
export function runAppHref(slug: string): string {
    const apex = lobbyApexDomain();
    if (!apex || !isValidRunSlug(slug)) return "/app";
    return `https://${slug}.${apex}/app`;
}

/**
 * Where the lobby links back to the apex landing site (e.g. "Learn more").
 * Falls back to a relative path in dev, like {@link runAppHref}.
 *
 * @param path Absolute landing path, e.g. `/landing-page`.
 */
export function lobbyLandingHref(path: string): string {
    const apex = lobbyApexDomain();
    if (!apex) return path;
    return `https://${apex}${path}`;
}

/**
 * Shared `validateSearch` for the `?return={slug}` parameter, used by every
 * lobby route so the parsing rule cannot drift between the entry points. Kept
 * here because this module owns the return-slug contract: anything that is not
 * a plausible run slug is dropped at the door, and a surviving value is still
 * validated against known runs before being interpolated into
 * {@link runAppHref}'s fixed template.
 */
export function validateReturnSearch(search: Record<string, unknown>): {
    return: string | undefined;
} {
    return {
        return:
            typeof search.return === "string" && isValidRunSlug(search.return)
                ? search.return
                : undefined,
    };
}
