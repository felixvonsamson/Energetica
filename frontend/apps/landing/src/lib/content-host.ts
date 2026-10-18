import type { ContentHost } from "@energetica/content/content-links";

/**
 * How the wiki and the changelog render on the landing page. The game is not
 * here, so links to its pages show as unavailable, and a visitor has unlocked
 * nothing.
 */
export const contentHost: ContentHost = {
    wikiPagePath: (slug) => `/wiki/${slug}`,
    servesGame: false,
    useHasCapability: () => false,
};
