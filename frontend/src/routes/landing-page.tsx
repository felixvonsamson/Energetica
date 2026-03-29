import { createFileRoute } from "@tanstack/react-router";

import { LandingPage } from "@/components/landing-page";

export const Route = createFileRoute("/landing-page")({
    staticData: {
        title: "Landing Page",
    },
    component: LandingPage,
});
