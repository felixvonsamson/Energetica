import { createRootRoute, Outlet } from "@tanstack/react-router";

export const Route = createRootRoute({
    staticData: { title: "", routeConfig: { requiredRole: null } },
    component: RootComponent,
});

function RootComponent() {
    return <Outlet />;
}
