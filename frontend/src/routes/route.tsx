import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
    loader: ({ location }) => {
        // Redirect only if it's exactly /admin-dashboard
        if (location.pathname.replace(/\/+$/, "") === "") {
            throw redirect({ to: "/landing-page" });
        }
    },
    component: RouteComponent,
    staticData: {
        title: "",
    },
});

function RouteComponent() {
    return <div>Hello "/"!</div>;
}
