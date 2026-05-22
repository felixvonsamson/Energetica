import { createFileRoute } from "@tanstack/react-router";

import { ForEducatorsPage } from "@/components/for-educators-page";

export const Route = createFileRoute("/for-educators")({
    component: ForEducatorsPage,
    staticData: { title: "For Educators" },
});
