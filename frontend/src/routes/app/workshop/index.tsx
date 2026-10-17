/**
 * The Workshop home (#995): sends the visitor to the page for where the session
 * is now, or the facilitator to their console during an Investment phase.
 * Before the session starts there is no such page yet, so it says so, and a
 * player gets a short guide to getting around the game (#1254).
 */

import { createFileRoute, Navigate } from "@tanstack/react-router";

import { InfoBanner } from "@/components/ui";
import { Spinner } from "@/components/ui/spinner";
import { WelcomeGuide } from "@/components/workshop/welcome-guide";
import { WorkshopPlaceholder } from "@/components/workshop/workshop-placeholder";
import { useWorkshopEntry, useWorkshopSession } from "@/hooks/use-workshop";
import { homePage } from "@/lib/workshop-timeline";

export const Route = createFileRoute("/app/workshop/")({
    component: WorkshopHome,
    staticData: { title: "Workshop", runMode: "workshop" },
});

function WorkshopHome() {
    const { data: entry } = useWorkshopEntry();
    const { data: session, isError } = useWorkshopSession();

    if (isError) {
        return (
            <InfoBanner variant="error">
                Could not load the session. It is retried every few seconds.
            </InfoBanner>
        );
    }
    if (!session || !entry) {
        return (
            <div className="flex justify-center py-12">
                <Spinner />
            </div>
        );
    }
    const page = homePage(session.checkpoint, entry.role);
    if (page) return <Navigate {...page} replace />;
    return (
        <div className="space-y-6">
            <WorkshopPlaceholder title="Welcome to the Workshop">
                The session has not started yet. Round 1 opens when the
                facilitator starts it.
                {entry.role === "player" &&
                    " Until then, here is how to get around."}
            </WorkshopPlaceholder>
            {entry.role === "player" && <WelcomeGuide />}
        </div>
    );
}
