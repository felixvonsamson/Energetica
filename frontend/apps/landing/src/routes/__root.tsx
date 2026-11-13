import {
    documentTitle,
    pageTitleFromMatches,
} from "@energetica/core/document-title";
import { createRootRoute, HeadContent, Outlet } from "@tanstack/react-router";

export const Route = createRootRoute({
    staticData: { title: "", routeConfig: { requiredRole: null } },
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
