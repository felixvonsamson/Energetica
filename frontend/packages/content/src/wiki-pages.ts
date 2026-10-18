import type { ComponentType, ReactNode } from "react";

export interface LockedLinkProps {
    /** The app page to link to. */
    to: string;
    /** The player capability that unlocks the page, such as `has_network`. */
    capability: string;
    children: ReactNode;
}

/**
 * Components the wiki pages use without importing them. They depend on the app
 * that renders the page, so each app supplies its own.
 */
export interface WikiComponents {
    /** A link to an app page that a player may not have unlocked yet. */
    LockedLink: ComponentType<LockedLinkProps>;
}

/** A compiled wiki page. */
export type WikiPage = ComponentType<{ components: WikiComponents }>;

// Eagerly import every page, so navigating between them never waits on a fetch.
const modules = import.meta.glob<{ default: WikiPage }>("./wiki/*.mdx", {
    eager: true,
});

/** Every wiki page, by slug. The slug is the file name, such as `introduction`. */
export const wikiPages: Record<string, WikiPage> = Object.fromEntries(
    Object.entries(modules).map(([path, module]) => [
        path.match(/\/([^/]+)\.mdx$/)?.[1] ?? "",
        module.default,
    ]),
);
