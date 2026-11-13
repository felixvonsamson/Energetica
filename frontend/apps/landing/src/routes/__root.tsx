import {
    documentTitle,
    pageTitleFromMatches,
} from "@energetica/core/document-title";
import { createRootRoute, Outlet, useMatches } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createRootRoute({
    staticData: { title: "", routeConfig: { requiredRole: null } },
    component: RootComponent,
});

function RootComponent() {
    const pageTitle = pageTitleFromMatches(useMatches());
    useEffect(() => {
        document.title = documentTitle(pageTitle);
    }, [pageTitle]);
    return <Outlet />;
}
