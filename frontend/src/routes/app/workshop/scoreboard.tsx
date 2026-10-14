/**
 * The scoreboard (#1017): every player ranked by final score, shown once the
 * session is over, after the last Round's Recap.
 */

import { createFileRoute } from "@tanstack/react-router";

import { Scoreboard } from "@/components/workshop/scoreboard";

export const Route = createFileRoute("/app/workshop/scoreboard")({
    component: Scoreboard,
    staticData: { title: "Scoreboard", runMode: "workshop" },
});
