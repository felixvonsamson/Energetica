/**
 * PROTOTYPE — Workshop Mode: Round overview page (issue #992, spec §12). Bonus
 * page, not one of the four screenshots requested — built so the timeline's
 * "Round N" label has somewhere real to link to. Season-by-season revenue strip
 * (fills in progressively) + a facility performance table. All data is invented
 * — see `lib/workshop-prototype/sample-data.ts`.
 */
import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";

import { Money } from "@/components/ui/money";
import { WorkshopChrome } from "@/components/workshop-prototype/chrome";
import { cn } from "@/lib/utils";
import { CATEGORY_META, SEASON_META } from "@/lib/workshop-prototype/meta";
import {
    CATALOG,
    FACILITY_PERFORMANCE,
    SEASON_REVENUE,
} from "@/lib/workshop-prototype/sample-data";

export const Route = createFileRoute("/app/prototype/workshop/round")({
    component: RoundOverviewPrototypePage,
    staticData: {
        title: "Workshop — Round Overview (Prototype)",
        routeConfig: { requiredRole: null },
    },
    validateSearch: (search: Record<string, unknown>): { round?: number } => ({
        round: search.round !== undefined ? Number(search.round) : undefined,
    }),
});

function RoundOverviewPrototypePage() {
    // `?round=` overrides which round the nav centers on — mainly so the
    // timeline's final-recap node (only reachable once the window includes
    // Round 5) can be poked at without a dedicated page for it.
    const { round = 3 } = Route.useSearch();
    return (
        <WorkshopChrome
            phaseLabel={`Review — Round ${round}`}
            phaseKind="review"
            phaseSeconds={null}
            carbonTaxActive
            timeline={{ currentRound: round }}
        >
            <RoundOverviewContent round={round} />
        </WorkshopChrome>
    );
}

const totalRevenue = SEASON_REVENUE.reduce((s, r) => s + (r.revenue ?? 0), 0);
const totalCost = SEASON_REVENUE.reduce((s, r) => s + (r.cost ?? 0), 0);
const allDone = SEASON_REVENUE.every((r) => r.status === "done");

function RoundOverviewContent({ round }: { round: number }) {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-semibold font-titles">
                Round {round} overview
            </h1>

            <div className="rounded-xl border border-border bg-card p-4 md:p-5 space-y-4">
                <h2 className="font-semibold font-titles text-sm text-muted-foreground uppercase tracking-wide">
                    Season-by-season revenue
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {SEASON_REVENUE.map((r) => {
                        const Icon = SEASON_META[r.season].icon;
                        return (
                            <div
                                key={r.season}
                                className={cn(
                                    "rounded-lg border p-3 space-y-1",
                                    r.status === "current"
                                        ? "border-brand/40 bg-brand/5"
                                        : "border-border",
                                )}
                            >
                                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                    <Icon className="size-4" />
                                    {SEASON_META[r.season].label}
                                </div>
                                <div className="font-mono">
                                    {r.revenue !== null ? (
                                        <Money amount={r.revenue - r.cost!} />
                                    ) : (
                                        <span className="text-muted-foreground">
                                            –
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    <div className="rounded-lg border border-border p-3 space-y-1 bg-muted/50">
                        <div className="text-sm text-muted-foreground">
                            Total
                        </div>
                        <div className="font-mono font-semibold">
                            {allDone ? (
                                <Money amount={totalRevenue - totalCost} />
                            ) : (
                                <span className="text-muted-foreground">–</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 md:p-5 space-y-4">
                <h2 className="flex items-center gap-2 font-semibold font-titles text-sm text-muted-foreground uppercase tracking-wide">
                    <BarChart3 className="size-4" />
                    Facility performance (updates as each period completes)
                </h2>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-muted-foreground border-b border-border">
                            <th className="py-1.5 pr-4 font-medium">
                                Facility
                            </th>
                            <th className="py-1.5 pr-4 font-medium">
                                Generated
                            </th>
                            <th className="py-1.5 pr-4 font-medium">
                                O&amp;M cost
                            </th>
                            <th className="py-1.5 pr-4 font-medium">
                                Capacity factor
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {FACILITY_PERFORMANCE.map((row) => {
                            const catalog = CATALOG.find(
                                (c) => c.id === row.catalogId,
                            )!;
                            const Icon = CATEGORY_META[catalog.category].icon;
                            return (
                                <tr
                                    key={row.catalogId}
                                    className="border-b border-border/50 last:border-0"
                                >
                                    <td className="py-2 pr-4 flex items-center gap-2">
                                        <Icon className="size-4 text-muted-foreground" />
                                        {catalog.name}
                                    </td>
                                    <td className="py-2 pr-4 font-mono">
                                        {row.generatedMwh.toLocaleString()} MWh
                                    </td>
                                    <td className="py-2 pr-4">
                                        <Money amount={row.omCost} />
                                    </td>
                                    <td className="py-2 pr-4 font-mono">
                                        {(row.capacityFactor * 100).toFixed(0)}%
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                <p className="text-xs text-muted-foreground">
                    No per-facility earnings column — revenue can&apos;t be
                    attributed to individual facilities under uniform-price
                    market clearing.
                </p>
            </div>
        </div>
    );
}
