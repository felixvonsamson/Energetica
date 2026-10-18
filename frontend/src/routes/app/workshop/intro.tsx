/**
 * The intro (#1254): the first node on the timeline, before Round 1. It is a
 * short guide to getting around the game, open all game. Before the session
 * starts, it is where everyone waits.
 */

import { createFileRoute } from "@tanstack/react-router";

import { WelcomeGuide } from "@/components/workshop/welcome-guide";
import { useWorkshopSession } from "@/hooks/use-workshop";
import {
    TypographyH2,
    TypographyMuted,
} from "@energetica/ui/components/typography";

export const Route = createFileRoute("/app/workshop/intro")({
    component: Intro,
    staticData: { title: "Intro", runMode: "workshop" },
});

function Intro() {
    const { data: session } = useWorkshopSession();
    const notStarted = session?.checkpoint.kind === "not_started";

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <TypographyH2>Welcome to the Workshop</TypographyH2>
                <TypographyMuted>
                    {notStarted &&
                        "The session has not started yet. Round 1 opens when the facilitator starts it. "}
                    Here is how to get around.
                </TypographyMuted>
            </div>
            <WelcomeGuide />
        </div>
    );
}
