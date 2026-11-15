/**
 * The scoreboard (#1017): every player ranked by score, open all game (#1250)
 * and final once the session is over.
 */

import { createFileRoute } from "@tanstack/react-router";

import { Scoreboard } from "@/components/scoreboard";

export const Route = createFileRoute("/_entered/_shell/scoreboard")({
    component: Scoreboard,
    staticData: { title: "Scoreboard" },
});
