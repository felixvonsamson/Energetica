/**
 * What the content package needs from the app rendering it. The wiki pages and
 * the changelog link to each other and to the game's pages, and which of those
 * exist depends on the app. Each app passes its own `ContentHost` to every page
 * it renders.
 */
export interface ContentHost {
    /**
     * The path of the wiki page with this slug in this app, such as
     * `/app/wiki/map`.
     */
    wikiPagePath: (slug: string) => string;
    /** Whether this app serves the game's pages, the paths under `/app/`. */
    servesGame: boolean;
    /**
     * A hook: whether the reader has unlocked the capability, such as
     * `has_network`. The pages write capability names as plain strings.
     */
    useHasCapability: (capability: string) => boolean;
}

/** Where a link written in the content goes in this app. */
export type ContentLinkTarget =
    | { kind: "route"; to: string; hash?: string }
    | { kind: "unavailable" }
    | { kind: "plain" };

const WIKI_PAGE = /^\.\/([^#/]+)\.mdx(?:#(.+))?$/;
const GAME_PAGE = /^(\/app(?:\/[^#]*)?)(?:#(.+))?$/;

/**
 * Resolve an `href` written in the content against the app rendering it.
 *
 * - `./map.mdx#hydro` is another wiki page, a route in every app.
 * - `/app/facilities/power` is a game page, a route only where the app serves the
 *   game, and unavailable elsewhere.
 * - Anything else, such as an external URL or a same-page `#anchor`, is left for
 *   the browser.
 */
export function resolveContentLink(
    href: string,
    host: Pick<ContentHost, "wikiPagePath" | "servesGame">,
): ContentLinkTarget {
    const wiki = WIKI_PAGE.exec(href);
    if (wiki) return route(host.wikiPagePath(wiki[1]!), wiki[2]);

    const game = GAME_PAGE.exec(href);
    if (game) {
        return host.servesGame
            ? route(game[1]!, game[2])
            : { kind: "unavailable" };
    }

    return { kind: "plain" };
}

function route(to: string, hash: string | undefined): ContentLinkTarget {
    return hash === undefined
        ? { kind: "route", to }
        : { kind: "route", to, hash };
}
