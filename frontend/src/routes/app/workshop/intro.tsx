/**
 * The intro (#1254): the first node on the timeline, before Round 1. It says
 * what the game is about and gives a short guide to getting around it, open all
 * game. Before the session starts, it is where everyone waits.
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
                {session && <GameIntro roundCount={session.round_count} />}
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

/** What the game is about, before the guide shows how to play it. */
function GameIntro({ roundCount }: { roundCount: number }) {
    return (
        <div className="space-y-2">
            <p>
                You lead an <strong>energy company</strong>. You{" "}
                <strong>invest in power facilities</strong> and{" "}
                <strong>bid your electricity on a market shared</strong> with
                the other teams. The game lasts{" "}
                <strong>{roundCount} Rounds</strong>, and the goal is to make
                the <strong>largest profit</strong>.
            </p>
            <p>
                Before each Round, you decide{" "}
                <strong>which facilities to buy</strong> ({roundCount} times in
                the game). Before each season, you can{" "}
                <strong>adjust your prices</strong> ({roundCount * 4} times in
                the game).
            </p>
        </div>
    );
}
