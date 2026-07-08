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
 * Where the app lives in local dev, when the lobby is served from `localhost`
 * and no apex exists. The app frontend runs on its own fixed Vite port
 * (`DEV_PORTS.app` in `vite.shared.ts`); `VITE_APP_URL` overrides for
 * non-default setups. The mirror of `LOBBY_DEV_URL` in `lib/instances.ts`: it
 * lets the lobby's "enter run" links reach the local app dev server instead of
 * dead-ending on a relative path, so the full local stack (`bun run dev`) is
 * clickable in both directions.
 */
const APP_DEV_URL = import.meta.env.VITE_APP_URL ?? "http://localhost:5173";

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
 * Pure core of {@link runAppHref}, with its environment passed in so the cases
 * are unit-testable without stubbing `window.location` / `import.meta.env`.
 *
 * - **Production** (apex derived from the `lobby.{apex}` hostname): the run lives
 *   at `{slug}.{apex}`, cross-origin from the lobby but under the shared apex,
 *   so the `Domain=.{apex}` session cookie carries over. →
 *   `https://{slug}.{apex}/app`.
 * - **Local dev** (`dev: true`, no apex): a single local app backend serves every
 *   run — there is no per-slug subdomain to select — so point at the app dev
 *   server. Its session cookie is shared through the port-agnostic `localhost`
 *   cookie jar, so the entry gate authenticates. → `{appDevUrl}/app`.
 *
 * A slug that is not a valid DNS label, or a non-dev context with no apex,
 * falls back to a relative `/app`: a dead same-origin link beats a cross-origin
 * URL pointing at a host we did not intend.
 */
export function resolveRunAppHref(opts: {
    apex: string | null;
    slug: string;
    appDevUrl: string;
    dev: boolean;
}): string {
    if (!isValidRunSlug(opts.slug)) return "/app";
    if (opts.apex) return `https://${opts.slug}.${opts.apex}/app`;
    return opts.dev ? `${opts.appDevUrl}/app` : "/app";
}

/**
 * A run's app entry point, as an absolute cross-origin URL. See
 * {@link resolveRunAppHref} for the resolution rule.
 */
export function runAppHref(slug: string): string {
    return resolveRunAppHref({
        apex: lobbyApexDomain(),
        slug,
        appDevUrl: APP_DEV_URL,
        dev: import.meta.env.DEV,
    });
}

/**
 * Where the lobby links back to the apex landing site (e.g. "Learn more").
 * Falls back to a relative path in dev (the landing has no local dev origin the
 * lobby knows about — these are secondary "learn more" links, so a dead dev
 * link is accepted).
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
