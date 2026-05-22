import { createFileRoute } from "@tanstack/react-router";

import { AboutPage } from "@/components/about-page";

export const Route = createFileRoute("/about")({
    component: AboutPage,
    staticData: { title: "The Project" },
});
