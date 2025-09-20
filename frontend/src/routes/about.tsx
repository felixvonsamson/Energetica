import { createFileRoute } from "@tanstack/react-router";
import { HomeLayout } from "../components/HomeLayout";

export const Route = createFileRoute("/about")({
    component: RouteComponent,
    staticData: {
        title: "About",
    },
});

function RouteComponent() {
    return (
        <HomeLayout>
            <div>Hello "/about"!</div>
        </HomeLayout>
    );
}
