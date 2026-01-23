import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/")({
    loader: () => {
        throw redirect({ to: "/app/dashboard" });
    },
    staticData: {
        title: "",
    },
});
