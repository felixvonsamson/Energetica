/** Pure helpers for the facilitator surfaces (#1020). */

/**
 * The instance's join link: `origin` followed by `joinPath`, the path the app
 * serves its join page at for this token. Each app picks its own paths, so the
 * path comes from the app.
 *
 * Built from the page's own origin (this settings page only ever runs on the
 * instance it manages, so `window.location.origin` is always the right host —
 * no apex/slug plumbing needed). A trailing slash on `origin` is stripped so
 * the path never doubles up.
 */
export function buildJoinUrl(origin: string, joinPath: string): string {
    return `${origin.replace(/\/+$/, "")}${joinPath}`;
}
