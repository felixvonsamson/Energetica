import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/wiki/")({
    loader: () => {
        throw redirect({ to: "/app/wiki/$slug", params: { slug: "introduction" } });
    },
    staticData: {
        title: "Game Wiki",
    },
});
