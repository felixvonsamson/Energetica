import type { ComponentType } from "react";

import { ContentLink } from "#content/components/content-link";
import { LockedLink } from "#content/components/locked-link";
import type { ContentHost } from "#content/content-links";
import { ContentHostContext } from "#content/host-context";

/**
 * The components a page gets in place of its markdown elements, and the ones it
 * uses without importing.
 */
const components = { a: ContentLink, LockedLink };

/** A page as MDX compiles it. */
export type MdxPage = ComponentType<{ components: typeof components }>;

/** A page of content, rendered for the app given as `host`. */
export type ContentPage = ComponentType<{ host: ContentHost }>;

/** Wrap a compiled page so that it renders for the app given as `host`. */
export function contentPage(Page: MdxPage): ContentPage {
    function HostedPage({ host }: { host: ContentHost }) {
        return (
            <ContentHostContext.Provider value={host}>
                <Page components={components} />
            </ContentHostContext.Provider>
        );
    }
    return HostedPage;
}
