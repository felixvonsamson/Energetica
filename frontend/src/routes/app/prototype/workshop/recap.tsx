/**
 * PROTOTYPE — Workshop Mode: Round-transition recap page (issue #992, spec
 * §12). Sits on its own timeline node between Round 3 and Round 4: demand
 * shifts, newly unlocked tech, and event headlines — never vote outcomes, those
 * are announced live before the round's first trading period (spec §4). All
 * data is invented — see `lib/workshop-prototype/sample-data.ts`.
 */
import { createFileRoute } from "@tanstack/react-router";
import { Cloud, Globe2, Sparkles, TrendingUp, Unlock } from "lucide-react";

import { WorkshopChrome } from "@/components/workshop-prototype/chrome";
import { cn } from "@/lib/utils";
import {
    RECAP_EVENTS,
    RECAP_ROUND_JUST_ENDED,
    RECAP_ROUND_NEXT,
    type RecapEventCategory,
} from "@/lib/workshop-prototype/sample-data";

export const Route = createFileRoute("/app/prototype/workshop/recap")({
    component: RecapPrototypePage,
    staticData: {
        title: "Workshop — Round Recap (Prototype)",
        routeConfig: { requiredRole: null },
    },
    // The mockup always shows the Round 3 → 4 recap regardless of which
    // recap node was clicked — accepted so the chrome's links type-check.
    validateSearch: (search: Record<string, unknown>): { round?: number } => ({
        round: search.round !== undefined ? Number(search.round) : undefined,
    }),
});

const CATEGORY_ICON: Record<
    RecapEventCategory,
    React.ComponentType<{ className?: string }>
> = {
    climate: Cloud,
    price_shock_geopolitical: Globe2,
    demand_shift: TrendingUp,
    tech_unlock: Unlock,
};

const CATEGORY_STYLE: Record<RecapEventCategory, string> = {
    climate: "border-info/30 bg-info/10 text-info",
    price_shock_geopolitical:
        "border-destructive/30 bg-destructive/10 text-destructive",
    demand_shift: "border-warning/30 bg-warning/10 text-warning",
    tech_unlock: "border-success/30 bg-success/10 text-success",
};

function RecapPrototypePage() {
    return (
        <WorkshopChrome
            phaseLabel="Recap"
            phaseKind="recap"
            phaseSeconds={null}
            carbonTaxActive
            timeline={{
                currentRound: RECAP_ROUND_NEXT,
                currentRecapForRound: RECAP_ROUND_JUST_ENDED,
            }}
        >
            <RecapContent />
        </WorkshopChrome>
    );
}

function RecapContent() {
    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 text-brand px-3 py-1 text-sm font-medium">
                    <Sparkles className="size-4" />
                    Round {RECAP_ROUND_JUST_ENDED} complete
                </div>
                <h1 className="text-3xl font-semibold font-titles">
                    What changed before Round {RECAP_ROUND_NEXT}
                </h1>
                <p className="text-muted-foreground">
                    Here&apos;s what shifted going into the next round — the
                    same story every player at the table just saw.
                </p>
            </div>

            <div className="space-y-4">
                {RECAP_EVENTS.map((event) => {
                    const Icon = CATEGORY_ICON[event.category];
                    return (
                        <div
                            key={event.headline}
                            className={cn(
                                "rounded-xl border p-5 space-y-2",
                                CATEGORY_STYLE[event.category],
                            )}
                        >
                            <div className="flex items-center gap-2 text-xs uppercase tracking-wide font-semibold opacity-80">
                                <Icon className="size-4" />
                                {event.category.replace(/_/g, " ")} ·{" "}
                                {event.severity}
                            </div>
                            <h2 className="text-lg font-semibold font-titles text-foreground">
                                {event.headline}
                            </h2>
                            <p className="text-sm text-foreground/80">
                                {event.detail}
                            </p>
                        </div>
                    );
                })}
            </div>

            <div className="rounded-xl border border-border bg-card p-5 text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                    Waiting for the moderator to open Round {RECAP_ROUND_NEXT}
                    &apos;s investment window.
                </p>
                <div className="flex justify-center gap-1">
                    <span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-0.3s]" />
                    <span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-0.15s]" />
                    <span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce" />
                </div>
            </div>
        </div>
    );
}
