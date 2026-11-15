/**
 * The root of the Workshop's pages. It only sets the document title: the pages
 * of the Run itself enter it first, in `_entered.tsx`, while the join page and
 * the facilitator pages do not.
 */

import {
    documentTitle,
    pageTitleFromMatches,
} from "@energetica/core/document-title";
import { createRootRoute, HeadContent, Outlet } from "@tanstack/react-router";

export const Route = createRootRoute({
    staticData: { title: "" },
    head: ({ matches }) => ({
        meta: [{ title: documentTitle(pageTitleFromMatches(matches)) }],
    }),
    component: RootComponent,
});

function RootComponent() {
    return (
        <>
            <HeadContent />
            <Outlet />
        </>
    );
}
