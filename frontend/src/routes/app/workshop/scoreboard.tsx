/**
 * The scoreboard (#1017): every player ranked by score, open all game (#1250)
 * and final once the session is over.
 */

import { createFileRoute } from "@tanstack/react-router";

import { Scoreboard } from "@/components/workshop/scoreboard";

export const Route = createFileRoute("/app/workshop/scoreboard")({
    component: Scoreboard,
    staticData: { title: "Scoreboard", runMode: "workshop" },
});
