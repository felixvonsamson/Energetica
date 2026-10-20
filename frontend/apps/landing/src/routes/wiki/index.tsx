import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/wiki/")({
    loader: () => {
        throw redirect({ to: "/wiki/$slug", params: { slug: "introduction" } });
    },
    staticData: { title: "Game Wiki" },
});
