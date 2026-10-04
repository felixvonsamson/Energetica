/**
 * The Workshop home (#995): sends the visitor to the page for where the session
 * is now. Before the session starts there is no such page yet, so it says so.
 */

import { createFileRoute, Navigate } from "@tanstack/react-router";

import { Spinner } from "@/components/ui/spinner";
import { WorkshopPlaceholder } from "@/components/workshop/workshop-placeholder";
import { useWorkshopSession } from "@/hooks/use-workshop";
import { checkpointPage } from "@/lib/workshop-timeline";

export const Route = createFileRoute("/app/workshop/")({
    component: WorkshopHome,
    staticData: { title: "Workshop", runMode: "workshop" },
});

function WorkshopHome() {
    const { data: session } = useWorkshopSession();

    if (!session) {
        return (
            <div className="flex justify-center py-12">
                <Spinner />
            </div>
        );
    }
    const page = checkpointPage(session.checkpoint, session.round_count);
    if (page) return <Navigate {...page} replace />;
    return (
        <WorkshopPlaceholder title="Welcome to the Workshop">
            The session has not started yet. Round 1 opens when the facilitator
            starts it.
        </WorkshopPlaceholder>
    );
}
