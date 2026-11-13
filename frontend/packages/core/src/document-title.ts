/**
 * The browser tab title for a page (#792). Every bundle's root route sets
 * `document.title` from the deepest matched route's `staticData.title`, so a
 * player with several Energetica tabs open can tell them apart.
 */

const SITE_NAME = "Energetica";

/**
 * `"Changelog"` gives `"Changelog — Energetica"`; an empty title gives
 * `"Energetica"`.
 */
export function documentTitle(pageTitle: string | undefined): string {
    const trimmed = pageTitle?.trim();
    return trimmed ? `${trimmed} — ${SITE_NAME}` : SITE_NAME;
}

/** Reads the page title from the deepest matched route's static data. */
export function pageTitleFromMatches(
    matches: readonly { staticData?: unknown }[],
): string | undefined {
    const staticData = matches[matches.length - 1]?.staticData;
    if (typeof staticData !== "object" || staticData === null) return undefined;
    const title = (staticData as { title?: unknown }).title;
    return typeof title === "string" ? title : undefined;
}
