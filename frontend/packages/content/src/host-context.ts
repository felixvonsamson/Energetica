import { createContext, useContext } from "react";

import type { ContentHost } from "#content/content-links";

/**
 * Carries the page's `ContentHost` down to the links inside it. An app never
 * provides this itself: it passes `host` to the page, which provides it.
 */
export const ContentHostContext = createContext<ContentHost | null>(null);

export function useContentHost(): ContentHost {
    const host = useContext(ContentHostContext);
    if (host === null) {
        throw new Error("Content rendered outside a page that has a host");
    }
    return host;
}
