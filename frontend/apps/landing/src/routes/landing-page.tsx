import { createFileRoute, redirect } from "@tanstack/react-router";

// The home page used to live here. Kept so that links already shared still work.
export const Route = createFileRoute("/landing-page")({
    loader: () => {
        throw redirect({ to: "/" });
    },
    staticData: { title: "" },
});
