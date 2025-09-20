import { createFileRoute } from "@tanstack/react-router";
import { HomeLayout } from "../components/HomeLayout";

export const Route = createFileRoute("/learning-tool")({
    component: RouteComponent,
    staticData: {
        title: "Learning Tool",
    },
});

function RouteComponent() {
    return (
        <HomeLayout>
            <div>Hello "/learning-tool"!</div>
        </HomeLayout>
    );
}
