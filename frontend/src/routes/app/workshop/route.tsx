/**
 * The Workshop page shell (#995): the layout every Workshop page renders in.
 *
 * Shown only in a Workshop Run, in place of the persistent world's
 * `GameLayout`, which reads persistent-world data a Workshop Run's backend does
 * not serve. The root route has already entered the Run by the time this
 * renders, so the socket it opens is admitted.
 */

import { createFileRoute, Outlet } from "@tanstack/react-router";

import { Toaster } from "@/components/ui/sonner";
import { WorkshopTimeline } from "@/components/workshop/workshop-timeline";
import { WorkshopTopBar } from "@/components/workshop/workshop-top-bar";
import { useWorkshopSession, useWorkshopSocket } from "@/hooks/use-workshop";

export const Route = createFileRoute("/app/workshop")({
    component: WorkshopLayout,
    staticData: { title: "Workshop", runMode: "workshop" },
});

function WorkshopLayout() {
    useWorkshopSocket();
    const { data: session } = useWorkshopSession();

    return (
        <div className="flex h-svh w-full flex-col overflow-hidden bg-background">
            <WorkshopTopBar session={session} />
            {session && (
                <WorkshopTimeline
                    checkpoint={session.checkpoint}
                    roundCount={session.round_count}
                />
            )}
            <main className="min-h-0 flex-1 overflow-auto">
                <div className="mx-auto max-w-[1400px] p-4 md:p-8">
                    <Outlet />
                </div>
            </main>
            <Toaster
                position="top-center"
                richColors
                offset="calc(var(--topbar-height) + 0.5rem)"
            />
        </div>
    );
}
