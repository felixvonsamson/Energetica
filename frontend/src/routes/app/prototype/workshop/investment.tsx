/**
 * PROTOTYPE — Workshop Mode: Investment page (issue #992, spec §12).
 *
 * Browsable catalog + current fleet, fuel purchase, and an active vote —
 * everything the spec's Investment-phase user stories (#26–47) describe. All
 * data is invented; see `lib/workshop-prototype/sample-data.ts`.
 */
import { createFileRoute } from "@tanstack/react-router";
import {
    AlertTriangle,
    Flame,
    Hammer,
    Lock,
    ThumbsDown,
    ThumbsUp,
    Zap,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { WorkshopChrome } from "@/components/workshop-prototype/chrome";
import { cn } from "@/lib/utils";
import { CATEGORY_META } from "@/lib/workshop-prototype/meta";
import {
    ACTIVE_VOTE,
    CATALOG,
    FLEET,
    FUEL_PRICES,
    SESSION,
} from "@/lib/workshop-prototype/sample-data";

export const Route = createFileRoute("/app/prototype/workshop/investment")({
    component: InvestmentPrototypePage,
    staticData: {
        title: "Workshop — Investment (Prototype)",
        routeConfig: { requiredRole: null },
    },
});

function InvestmentPrototypePage() {
    return (
        <WorkshopChrome
            phaseLabel="Invest"
            phaseKind="investment"
            phaseSeconds={4 * 60 + 50}
            carbonTaxActive
            timeline={{ currentRound: SESSION.currentRound }}
        >
            <InvestmentContent />
        </WorkshopChrome>
    );
}

function InvestmentContent() {
    const [vote, setVote] = useState<"yes" | "no" | null>(null);

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold font-titles">
                        Round {SESSION.currentRound} — Investment
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        Build facilities, buy fuel, and vote. Submissions lock
                        in when the window closes — nothing is final until then.
                    </p>
                </div>
                <Money amount={128400} iconSize="lg" />
            </div>

            <VoteCard vote={vote} onVote={setVote} />
            <FuelCard />
            <FleetCard />
            <CatalogSection />
        </div>
    );
}

function SectionCard({
    title,
    icon: Icon,
    children,
}: {
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    children: React.ReactNode;
}) {
    return (
        <div className="rounded-xl border border-border bg-card p-4 md:p-5 space-y-3">
            <h2 className="flex items-center gap-2 font-semibold font-titles">
                <Icon className="size-5 text-brand" />
                {title}
            </h2>
            {children}
        </div>
    );
}

function VoteCard({
    vote,
    onVote,
}: {
    vote: "yes" | "no" | null;
    onVote: (v: "yes" | "no") => void;
}) {
    return (
        <SectionCard
            title={`Proposal: ${ACTIVE_VOTE.name}`}
            icon={AlertTriangle}
        >
            <p className="text-sm text-muted-foreground">
                {ACTIVE_VOTE.description} ({ACTIVE_VOTE.ratePlaceholder},
                placeholder rate)
            </p>
            <div className="flex items-center gap-3">
                <Button
                    variant={vote === "yes" ? "success" : "outline"}
                    onClick={() => onVote("yes")}
                >
                    <ThumbsUp className="size-4" /> Yes
                </Button>
                <Button
                    variant={vote === "no" ? "destructive" : "outline"}
                    onClick={() => onVote("no")}
                >
                    <ThumbsDown className="size-4" /> No
                </Button>
                <span className="text-xs text-muted-foreground ml-2">
                    Tally is hidden until the window closes — decide on your own
                    judgment.
                </span>
            </div>
        </SectionCard>
    );
}

function FuelCard() {
    return (
        <SectionCard title="Fuel procurement" icon={Flame}>
            <p className="text-sm text-muted-foreground">
                Buy enough fuel to cover this round&apos;s generation.
                Under-buying simply caps generation later — it&apos;s not a
                penalty.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {FUEL_PRICES.map((f) => (
                    <div
                        key={f.fuel}
                        className="rounded-lg border border-border p-3 space-y-2"
                    >
                        <div className="flex items-center justify-between">
                            <span className="capitalize font-medium">
                                {f.fuel}
                            </span>
                            <span
                                className={cn(
                                    "text-xs",
                                    f.trend === "up" && "text-destructive",
                                    f.trend === "down" && "text-success",
                                    f.trend === "flat" &&
                                        "text-muted-foreground",
                                )}
                            >
                                {f.trend === "up"
                                    ? "▲"
                                    : f.trend === "down"
                                      ? "▼"
                                      : "–"}{" "}
                                {f.trend}
                            </span>
                        </div>
                        <div className="font-mono text-lg">
                            €{f.pricePerTon}
                            <span className="text-sm text-muted-foreground">
                                /ton
                            </span>
                        </div>
                        <input
                            type="number"
                            defaultValue={0}
                            min={0}
                            className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                            placeholder="Tons to buy"
                        />
                    </div>
                ))}
            </div>
        </SectionCard>
    );
}

function FleetCard() {
    return (
        <SectionCard title="Your fleet" icon={Zap}>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-muted-foreground border-b border-border">
                            <th className="py-1.5 pr-4 font-medium">
                                Facility
                            </th>
                            <th className="py-1.5 pr-4 font-medium">Built</th>
                            <th className="py-1.5 pr-4 font-medium">Status</th>
                            <th className="py-1.5 pr-4 font-medium">
                                Life remaining
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {FLEET.map((f) => {
                            const catalog = CATALOG.find(
                                (c) => c.id === f.catalogId,
                            )!;
                            const Icon = CATEGORY_META[catalog.category].icon;
                            const endingSoon =
                                f.remainingLifetimeRounds <= 0 &&
                                f.status === "operating" &&
                                catalog.isStorage;
                            return (
                                <tr
                                    key={f.id}
                                    className="border-b border-border/50 last:border-0"
                                >
                                    <td className="py-2 pr-4 flex items-center gap-2">
                                        <Icon className="size-4 text-muted-foreground" />
                                        {catalog.name}
                                    </td>
                                    <td className="py-2 pr-4 text-muted-foreground">
                                        Round {f.builtRound}
                                    </td>
                                    <td className="py-2 pr-4">
                                        {f.status === "under_construction" ? (
                                            <span className="inline-flex items-center gap-1 text-warning">
                                                <Hammer className="size-3.5" />
                                                Under construction
                                            </span>
                                        ) : (
                                            <span className="text-success">
                                                Operating
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-2 pr-4">
                                        {endingSoon ? (
                                            <span className="inline-flex items-center gap-1 text-destructive font-medium">
                                                <AlertTriangle className="size-3.5" />
                                                Retiring this round — reinvest
                                                to keep stored energy
                                            </span>
                                        ) : (
                                            `${f.remainingLifetimeRounds} round(s)`
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </SectionCard>
    );
}

function CatalogSection() {
    return (
        <SectionCard title="Facility catalog" icon={Hammer}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {CATALOG.map((f) => {
                    const Icon = CATEGORY_META[f.category].icon;
                    return (
                        <div
                            key={f.id}
                            className={cn(
                                "rounded-lg border border-border p-3 space-y-2",
                                f.locked && "opacity-70",
                            )}
                        >
                            <div className="flex items-center justify-between">
                                <span className="flex items-center gap-2 font-medium">
                                    <Icon className="size-4 text-brand" />
                                    {f.name}
                                </span>
                                {f.locked && (
                                    <Lock className="size-4 text-muted-foreground" />
                                )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                                {f.isStorage
                                    ? `${f.storageCapacityMwh} MWh capacity`
                                    : `${f.powerMw} MW max`}
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <Money amount={f.price} />
                                <span className="text-muted-foreground">
                                    {f.constructionLagRounds === 0
                                        ? "No lag"
                                        : `${f.constructionLagRounds}rd lag`}{" "}
                                    · {f.lifetimeRounds}rd life
                                </span>
                            </div>
                            {f.locked ? (
                                <p className="text-xs text-muted-foreground">
                                    {f.lockedReason}
                                </p>
                            ) : (
                                <Button
                                    size="sm"
                                    className="w-full"
                                    variant="outline"
                                >
                                    Build
                                </Button>
                            )}
                        </div>
                    );
                })}
            </div>
        </SectionCard>
    );
}
