/**
 * PROTOTYPE — Workshop Mode UI mockup (issue #992). Landing page linking to the
 * four requested screens plus the bonus round-overview page. Not part of the
 * spec — purely a way to get around this throwaway route tree by hand.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { FlaskConical } from "lucide-react";

export const Route = createFileRoute("/app/prototype/workshop/")({
    component: WorkshopPrototypeIndex,
    staticData: {
        title: "Workshop Mode Prototype",
        routeConfig: { requiredRole: null },
    },
});

const PAGES = [
    {
        to: "/app/prototype/workshop/investment",
        label: "Investment page",
        desc: "Facility catalog, fleet, fuel purchase, and voting.",
    },
    {
        to: "/app/prototype/workshop/trading-period",
        label: "Trading-period review",
        desc: "Generation chart, scrubber, merit order, submitted price. Open the price-setting panel from the top bar to see it push the layout.",
    },
    {
        to: "/app/prototype/workshop/recap",
        label: "Round-transition recap",
        desc: "Event headlines, tech unlocks, demand shifts between rounds.",
    },
    {
        to: "/app/prototype/workshop/round",
        label: "Round overview (bonus)",
        desc: "Season-by-season revenue strip and facility performance table.",
    },
] as const;

function WorkshopPrototypeIndex() {
    return (
        <div className="min-h-svh flex items-center justify-center p-8 bg-background">
            <div className="max-w-lg w-full space-y-6">
                <div className="text-center space-y-2">
                    <FlaskConical className="size-8 mx-auto text-brand" />
                    <h1 className="text-2xl font-semibold font-titles">
                        Workshop Mode UI Prototype
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        Mockup for issue #992 — every page uses invented data.
                    </p>
                </div>
                <div className="space-y-3">
                    {PAGES.map((p) => (
                        <Link
                            key={p.to}
                            to={p.to}
                            className="block rounded-xl border border-border bg-card p-4 hover:border-brand-secondary transition-colors"
                        >
                            <div className="font-semibold font-titles">
                                {p.label}
                            </div>
                            <div className="text-sm text-muted-foreground">
                                {p.desc}
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
