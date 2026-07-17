/**
 * Landing-side consumer of the public instance manifest.
 *
 * Each running instance publishes a sanitised fragment to the landing dir; the
 * instances aggregate them into `/instances.json` (sorted by `starts_at`
 * descending). The `access` policy block is stripped before publication, so
 * this manifest is safe to serve statically.
 *
 * See `docs/architecture/static-serving-and-deployment.md` § Instance
 * Visibility & Access.
 */

import { isSingleOriginHost } from "./single-origin";

/**
 * Public projection of an instance. Mirrors the backend `InstanceFragment`
 * model.
 */
export type InstanceFragment = {
    slug: string;
    name: string;
    advertised: boolean;
    /** ISO-8601 UTC, e.g. "2025-09-15T00:00:00Z". */
    starts_at: string;
};

export type InstancesManifest = {
    instances: InstanceFragment[];
};

/**
 * Apex domain the instances live under (e.g. "energetica-game.org"), injected
 * at build time. Empty during the interim, when the landing is still served
 * same-origin by FastAPI.
 */
const BUILD_APEX = import.meta.env.VITE_APEX_DOMAIN;

/**
 * The apex used to build cross-origin links, or `undefined` to force a
 * same-origin fallback.
 *
 * Normally the build-time {@link BUILD_APEX}. Suppressed to `undefined` on a
 * single-origin proxy host (`lib/single-origin.ts`, ADR-0002 amendment): there,
 * the lobby and the one reachable instance share ONE origin, so `lobby.{apex}`
 * and `{slug}.{apex}` do not resolve and every helper below must emit a
 * same-origin path instead. Routing all apex reads through this one gate means
 * the existing no-apex fallbacks (`return path` / `"/app"`) cover `runAppHref`,
 * `lobbyHref`, `currentRunSlug`, and `landingHref` with no per-helper
 * special-casing.
 */
function apexDomain(): string | undefined {
    return isSingleOriginHost() ? undefined : BUILD_APEX;
}

const LOBBY_SUBDOMAIN = "lobby.";

/**
 * Where the lobby lives in local dev, when no apex is configured. The lobby
 * frontend runs on its own fixed Vite port (`DEV_PORTS.lobby` in
 * `vite.shared.ts`); `VITE_LOBBY_URL` overrides for non-default setups. Lets
 * the app bundle's "log in" bounce reach a real lobby locally instead of
 * dead-ending on a relative path, so the full local stack (`bun run dev`) is
 * clickable.
 */
const LOBBY_DEV_URL = import.meta.env.VITE_LOBBY_URL ?? "http://localhost:5174";

/**
 * The slug shape the infra enforces at provision time (setup-instance.sh):
 * lowercase kebab-case within a DNS label's 63-char limit. Checked here too
 * because a slug becomes a _hostname_ — a dotted, spaced, or overlong slug must
 * never produce a URL whose host is something other than a valid
 * `{slug}.{apex}`. Mirrors `isValidRunSlug` in `lib/lobby.ts` (the two bundles
 * derive the apex differently — build-time env here vs. hostname there — so the
 * guard is copied, not shared).
 */
const RUN_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** Whether `slug` is safe to use as a run's subdomain label. */
export function isValidRunSlug(slug: string): boolean {
    return RUN_SLUG_PATTERN.test(slug);
}

/**
 * A run's app entry point, as an absolute cross-origin URL
 * (`https://{slug}.{apex}/app`). Used by the in-run switcher to hop between the
 * account's runs. A slug that is not a valid DNS label, or a missing apex
 * (local dev / interim), falls back to a relative `/app`: a dead same-origin
 * link beats a cross-origin URL pointing at a host we did not intend.
 */
export function runAppHref(slug: string): string {
    const apex = apexDomain();
    if (!apex || !isValidRunSlug(slug)) return "/app";
    return `https://${slug}.${apex}/app`;
}

/**
 * Pure core of {@link lobbyBaseUrl}, with its environment passed in so the host
 * matrix is unit-testable without stubbing `import.meta.env`.
 *
 * The login bounce only ever needs to reach a lobby whose session cookie can
 * _actually_ authenticate this app — which is exactly two cases:
 *
 * - **Production** (`dev: false`, apex baked in): the instance (`{slug}.{apex}`)
 *   and the lobby (`lobby.{apex}`) share a registrable domain, and the lobby
 *   sets its cookie on `Domain=.{apex}`, so it reaches the app. →
 *   `lobby.{apex}`.
 * - **Local dev** (`dev: true`): every `localhost` port shares one cookie jar
 *   (cookies are not isolated by port, per RFC 6265), so the _local_ lobby's
 *   host-only cookie reaches a `localhost` app session. → the local lobby.
 *
 * The case this deliberately does **not** serve is "app dev server proxied to a
 * _remote_ backend" (`BACKEND=game bun run dev:app`): a remote lobby sets its
 * cookie on `.{apex}`, which `localhost` can never read, and its post-login
 * redirect targets the real instance host — so it cannot authenticate a
 * `localhost:5173` session no matter which lobby URL we point at. Rather than
 * derive a "correct" remote lobby that still can't log you in, dev always
 * points at the local lobby; remote-backend app login is unsupported
 * (documented in `docs/getting-started/local-development.md`).
 */
export function resolveLobbyBaseUrl(opts: {
    dev: boolean;
    apex: string | undefined;
    lobbyDevUrl: string;
}): string | null {
    if (opts.dev) return opts.lobbyDevUrl;
    return opts.apex ? `https://${LOBBY_SUBDOMAIN}${opts.apex}` : null;
}

/**
 * Origin of the lobby the app's login bounce should target, or `null` for a
 * non-dev build with no apex (degrades to a relative path). See
 * {@link resolveLobbyBaseUrl} for the resolution rule.
 */
function lobbyBaseUrl(): string | null {
    return resolveLobbyBaseUrl({
        dev: import.meta.env.DEV,
        apex: apexDomain(),
        lobbyDevUrl: LOBBY_DEV_URL,
    });
}

/**
 * A path on the lobby app as an absolute cross-origin URL
 * (`https://lobby.{apex}{path}`). The lobby owns login/signup/logout and the
 * picker (ADR-0002/0003), so every "log in", "play", and "open lobby" link
 * resolves here. In dev the origin is the local lobby dev server (see
 * {@link lobbyBaseUrl}); a non-dev build with no apex degrades to the relative
 * path.
 *
 * @param path Absolute lobby path, e.g. `/login`, `/signup`, `/logout`, `/`.
 */
export function lobbyHref(path: string): string {
    const base = lobbyBaseUrl();
    return base ? `${base}${path}` : path;
}

/**
 * The single live instance the app dev server is pinned to (its `/api` proxy
 * target), injected at dev-server startup — see `instanceSlugFromBackend` in
 * `vite.shared.ts`. `null` outside a live-backend dev server (a prod build, or
 * a local backend with no apex).
 *
 * Deliberately separate from {@link currentRunSlug}: the switcher uses this to
 * identify the pinned run, but the login bounce must NOT treat it as "the run
 * I'm in" (that would send a `?return=` and auto-bounce back after login) — in
 * a `localhost` dev app there is no run to return to.
 */
export function devInstanceSlug(): string | null {
    return import.meta.env.DEV
        ? (import.meta.env.VITE_DEV_INSTANCE_SLUG ?? null)
        : null;
}

/**
 * This run's own slug, parsed from the hostname (`{slug}.{apex}`). `null` in
 * dev / the interim, or when the host is not a single valid label under the
 * apex.
 */
export function currentRunSlug(): string | null {
    const apex = apexDomain();
    if (!apex) return null;
    const suffix = `.${apex}`;
    const { hostname } = window.location;
    if (!hostname.endsWith(suffix)) return null;
    const label = hostname.slice(0, -suffix.length);
    return isValidRunSlug(label) ? label : null;
}

/**
 * Where an unauthenticated player is sent: the lobby login, carrying
 * `?return={thisRunSlug}` so the lobby bounces back into this run after login
 * (the return value is re-validated against the live run list lobby-side, so an
 * absent/invalid slug simply omits it).
 */
export function lobbyLoginHref(): string {
    const slug = currentRunSlug();
    return slug
        ? lobbyHref(`/login?return=${encodeURIComponent(slug)}`)
        : lobbyHref("/login");
}

/**
 * Where an app-bundle page should link back to the landing site.
 *
 * The landing is served by Apache from the apex domain; an instance lives on a
 * subdomain, so from inside the app these are cross-origin links — a plain `<a
 * href>`, never a TanStack route (the landing routes don't exist in the app
 * bundle). Absolute to the apex in production, like {@link lobbyHref} and
 * {@link runAppHref}.
 *
 * When no apex is configured (local `bun run dev:app`) it falls back to a
 * relative path. The landing routes live in the separate landing bundle (served
 * by `bun run dev:landing` on its own port), so this fallback does not resolve
 * inside the app dev server — these are secondary "learn more" links and the
 * dead dev link is accepted. Set `VITE_APEX_DOMAIN` to exercise the real
 * cross-origin link locally.
 *
 * @param path Absolute landing path, e.g. `/landing-page`.
 */
export function landingHref(path: string): string {
    const apex = apexDomain();
    if (!apex) return path;
    return `https://${apex}${path}`;
}

/**
 * Fetch the public instance manifest. Returns the raw entries in their
 * published (sorted) order.
 */
export async function fetchInstances(
    signal?: AbortSignal,
): Promise<InstanceFragment[]> {
    const response = await fetch("/instances.json", { signal });
    if (!response.ok)
        throw new Error(`Failed to fetch instances.json: ${response.status}`);
    const data = (await response.json()) as Partial<InstancesManifest>;
    return data.instances ?? [];
}
