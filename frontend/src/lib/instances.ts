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
 * Where the signup CTA for a given instance points.
 *
 * Once the landing is served from the apex domain, each instance lives on its
 * own subdomain, so the link is an absolute cross-origin URL. In the interim
 * the landing shares an origin with the (single) app, so a same-origin relative
 * link is correct.
 */
export function instanceSignupHref(instance: InstanceFragment): string {
    if (!APEX_DOMAIN) return "/app/sign-up";
    return `https://${instance.slug}.${APEX_DOMAIN}/app/sign-up`;
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
