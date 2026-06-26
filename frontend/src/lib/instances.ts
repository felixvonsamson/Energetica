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

/**
 * A path on a given instance's app, as an absolute cross-origin URL.
 *
 * Once the landing is served from the apex domain, each instance lives on its
 * own subdomain, so links from the landing into an instance are absolute. In
 * the interim the landing shares an origin with the (single) app, so a
 * same-origin relative link is correct.
 *
 * @param path Absolute app path, e.g. `/app/login` or `/app/sign-up`.
 */
export function instanceAppHref(
    instance: InstanceFragment,
    path: string,
): string {
    if (!APEX_DOMAIN) return path;
    return `https://${instance.slug}.${APEX_DOMAIN}${path}`;
}

/** Where the signup CTA for a given instance points. */
export function instanceSignupHref(instance: InstanceFragment): string {
    return instanceAppHref(instance, "/app/sign-up");
}

/**
 * Target for the landing's global app CTAs ("Play now", "Log In") — the most
 * recent advertised instance.
 *
 * `instances` is the advertised list, already sorted most-recent-first, so the
 * first entry is the current run. When the list is empty (no manifest yet, or
 * no advertised run) this falls back to the same-origin relative path: correct
 * in dev / the interim, and on the apex it 404s until a run is advertised — an
 * accepted transitory state handled by the instance-picker work (#810).
 */
export function primaryInstanceAppHref(
    instances: InstanceFragment[],
    path: string,
): string {
    const latest = instances[0];
    return latest ? instanceAppHref(latest, path) : path;
}

/**
 * Where an app-bundle page should link back to the landing site.
 *
 * The landing is served by Apache from the apex domain; an instance lives on a
 * subdomain, so from inside the app these are cross-origin links — a plain `<a
 * href>`, never a TanStack route (the landing routes don't exist in the app
 * bundle). Mirrors {@link instanceSignupHref} in the opposite direction:
 * absolute to the apex in production.
 *
 * When no apex is configured (local `bun run dev`) it falls back to a relative
 * path. The landing routes live in the separate landing bundle (served by `bun
 * run dev:landing` on its own port), so this fallback does not resolve inside
 * the app dev server — these are secondary "learn more" links and the dead dev
 * link is accepted. Set `VITE_APEX_DOMAIN` to exercise the real cross-origin
 * link locally.
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
