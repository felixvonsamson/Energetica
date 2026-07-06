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
const APEX_DOMAIN = import.meta.env.VITE_APEX_DOMAIN;

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
    if (!APEX_DOMAIN || !isValidRunSlug(slug)) return "/app";
    return `https://${slug}.${APEX_DOMAIN}/app`;
}

/**
 * Origin of the lobby that matches the backend this app is actually talking to,
 * or `null` when it can't be determined (a non-dev build with no apex).
 *
 * Resolution mirrors the dev proxy's backend precedence exactly
 * (`resolveBackendUrl` in `vite.config.ts`): in dev an explicit
 * `VITE_BACKEND_URL` wins over the apex — so if `/api` is pinned to one live
 * instance while an apex lingers in the env, the login bounce still follows the
 * pinned instance rather than the apex's (different) lobby. A live instance is
 * `{slug}.{apex}`, so its lobby is `lobby.{apex}`; a local (or unparseable)
 * backend uses the local lobby dev server. Only with no `VITE_BACKEND_URL` does
 * the apex apply — which also covers production, where `VITE_BACKEND_URL` is
 * unset and the baked-in apex is used.
 */
function lobbyBaseUrl(): string | null {
    // Explicit backend URL (dev only) — resolved entirely from the backend so it never mixes with
    // a stale apex.
    if (import.meta.env.DEV) {
        const backend = import.meta.env.VITE_BACKEND_URL;
        if (backend) {
            try {
                const { protocol, hostname } = new URL(backend);
                if (hostname !== "localhost" && hostname !== "127.0.0.1") {
                    const apex = hostname.split(".").slice(1).join(".");
                    if (apex) return `${protocol}//${LOBBY_SUBDOMAIN}${apex}`;
                }
            } catch {
                // Unparseable URL → fall through to the local lobby dev server.
            }
            return LOBBY_DEV_URL;
        }
    }
    if (APEX_DOMAIN) return `https://${LOBBY_SUBDOMAIN}${APEX_DOMAIN}`;
    return import.meta.env.DEV ? LOBBY_DEV_URL : null;
}

/**
 * A path on the lobby app as an absolute cross-origin URL
 * (`https://lobby.{apex}{path}`). The lobby owns login/signup/logout and the
 * picker (ADR-0002/0003), so every "log in", "play", and "open lobby" link
 * resolves here. In dev the origin follows the backend the proxy targets (see
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
 * This run's own slug, parsed from the hostname (`{slug}.{apex}`). `null` in
 * dev / the interim, or when the host is not a single valid label under the
 * apex.
 */
export function currentRunSlug(): string | null {
    if (!APEX_DOMAIN) return null;
    const suffix = `.${APEX_DOMAIN}`;
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
    if (!APEX_DOMAIN) return path;
    return `https://${APEX_DOMAIN}${path}`;
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
