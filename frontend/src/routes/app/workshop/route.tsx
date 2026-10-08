/**
 * The Workshop page shell (#995): the layout every Workshop page renders in.
 *
 * Shown only in a Workshop Run, in place of the persistent world's
 * `GameLayout`, which reads persistent-world data a Workshop Run's backend does
 * not serve. The root route has already entered the Run by the time this
 * renders, so the socket it opens is admitted.
 *
 * A player can open the price-setting panel (#1002) from the top bar on every
 * page. It takes its width from the page beside it instead of covering it, and
 * the page stays mounted, so the player keeps their place.
 *
 * While a Trading period is being simulated, a bar under the timeline shows how
 * far it has got (#1155).
 */

import { createFileRoute, Outlet } from "@tanstack/react-router";

import { Toaster } from "@/components/ui/sonner";
import { PricePanel } from "@/components/workshop/price-panel";
import { SettlementProgress } from "@/components/workshop/settlement-progress";
import { WorkshopTimeline } from "@/components/workshop/workshop-timeline";
import { WorkshopTopBar } from "@/components/workshop/workshop-top-bar";
import { useLocalStorage } from "@/hooks/use-local-storage";
import {
    useWorkshopEntry,
    useWorkshopSession,
    useWorkshopSocket,
} from "@/hooks/use-workshop";

export const Route = createFileRoute("/app/workshop")({
    component: WorkshopLayout,
    staticData: { title: "Workshop", runMode: "workshop" },
});

function WorkshopLayout() {
    useWorkshopSocket();
    const { data: session } = useWorkshopSession();
    const { data: entry } = useWorkshopEntry();
    const [pricePanelOpen, setPricePanelOpen] = useLocalStorage(
        "workshop-price-panel-open",
        false,
    );
    // A facilitator moderates rather than plays, so has no prices.
    const showPricePanel = pricePanelOpen && entry?.role === "player";

    return (
        <div className="flex h-svh w-full flex-col overflow-hidden bg-background">
            <WorkshopTopBar
                session={session}
                pricePanelOpen={showPricePanel}
                onTogglePricePanel={() => setPricePanelOpen(!pricePanelOpen)}
            />
            {session && (
                <WorkshopTimeline
                    checkpoint={session.checkpoint}
                    roundCount={session.round_count}
                    blackouts={session.blackouts}
                />
            )}
            <SettlementProgress />
            <div className="flex min-h-0 flex-1">
                <main className="min-w-0 flex-1 overflow-auto">
                    <div className="mx-auto max-w-[1400px] p-4 md:p-8">
                        <Outlet />
                    </div>
                </main>
                {showPricePanel && (
                    <PricePanel onClose={() => setPricePanelOpen(false)} />
                )}
            </div>
            <Toaster
                position="top-center"
                richColors
                offset="calc(var(--topbar-height) + 0.5rem)"
            />
        </div>
    );
}
