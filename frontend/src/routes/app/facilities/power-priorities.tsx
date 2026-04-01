/** Power Priorities page - Manage production and consumption priorities. */

import { createFileRoute } from "@tanstack/react-router";

import { GameLayout } from "@/components/layout/game-layout";
import { PriorityTable } from "@/components/power-priorities/priority-table";

function PowerPrioritiesHelp() {
    return (
        <div className="space-y-3">
            <p>
                Here you can set the priority of your facilities to determine
                the order in which they will be used to satisfy your demand.
            </p>
            <p>
                Use the ↑ / ↓ buttons on each row to change its priority.
                Higher priority facilities will be used first.
            </p>
            <p>
                When you are in a network, you can also set prices for buying
                and selling electricity to trade with other players.
            </p>
        </div>
    );
}

export const Route = createFileRoute("/app/facilities/power-priorities")({
    component: PowerPrioritiesPage,
    staticData: {
        title: "Power Priorities",
        routeConfig: {
            requiredRole: "player",
            requiresSettledTile: true,
            isUnlocked: (cap) =>
                cap.has_network
                    ? { unlocked: true }
                    : { unlocked: false, reason: "Unlock the Network achievement to access" },
        },
        infoDialog: {
            contents: <PowerPrioritiesHelp />,
        },
    },
});

function PowerPrioritiesPage() {
    return (
        <GameLayout>
            <div className="py-4 md:p-8 space-y-6">
                <PriorityTable />
            </div>
        </GameLayout>
    );
}
