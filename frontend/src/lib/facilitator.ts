/** Pure helpers for the facilitator surfaces (#1020). */

/**
 * The instance's join link: `origin` + the `/app/join/:token` path #1021 will
 * serve.
 *
 * Built from the page's own origin (this settings page only ever runs on the
 * instance it manages, so `window.location.origin` is always the right host —
 * no apex/slug plumbing needed). A trailing slash on `origin` is stripped so
 * the path never doubles up.
 */
export function buildJoinUrl(origin: string, token: string): string {
    return `${origin.replace(/\/+$/, "")}/app/join/${token}`;
}
