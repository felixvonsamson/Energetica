/**
 * PROTOTYPE — wipe me. Recap variant C, "Briefing": split down the middle into
 * looking back and looking ahead. On the left, the Round's four seasons in a
 * row with what hit each one, then the room's numbers. On the right, a
 * checklist of what is different next Round. Built to be scanned on a laptop.
 */

import {
    ArrowRight,
    CircleSlash,
    Sparkles,
    TrendingDown,
    TrendingUp,
    Zap,
} from "lucide-react";
import type { ReactNode } from "react";

import { Money } from "@/components/ui";
import { SEASON_ICONS } from "@/components/workshop/season-icons";
import { formatEmissions, formatEnergy, formatPower } from "@/lib/format-utils";
import { cn } from "@/lib/utils";
import { SEASON_LABELS, SEASONS } from "@/lib/workshop-timeline";

import {
    demandChange,
    formatPercent,
    type RecapScenario,
    type RecapStory,
} from "./prototype-data";

export function VariantBriefing({ scenario }: { scenario: RecapScenario }) {
    const isLast = scenario.round === scenario.roundCount;
    const blackoutAt = scenario.blackout
        ? SEASONS.indexOf(scenario.blackout.season)
        : -1;

    return (
        <div className="space-y-4">
            <h1 className="font-titles text-2xl font-semibold md:text-3xl">
                Round {scenario.round} recap
            </h1>
            <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
                <section className="space-y-4 rounded-xl border border-border bg-card p-4 md:p-6">
                    <Heading>Looking back at Round {scenario.round}</Heading>

                    {scenario.blackout && (
                        <div className="flex items-start gap-3 rounded-lg border border-destructive bg-destructive/10 p-3">
                            <Zap className="mt-0.5 size-5 shrink-0 text-destructive" />
                            <p className="text-sm">
                                <span className="font-semibold">
                                    Blackout in{" "}
                                    {SEASON_LABELS[
                                        scenario.blackout.season
                                    ].toLowerCase()}
                                    .
                                </span>{" "}
                                Must-serve demand went unmet, the Round ended
                                early, and everyone's cash was reset to the same
                                amount.
                            </p>
                        </div>
                    )}

                    <div className="grid gap-2 sm:grid-cols-4">
                        {SEASONS.map((season, i) => {
                            const Icon = SEASON_ICONS[season];
                            const skipped = blackoutAt >= 0 && i > blackoutAt;
                            const isBlackout = i === blackoutAt;
                            const stories = scenario.happened.filter(
                                (story) => story.season === season,
                            );
                            return (
                                <div
                                    key={season}
                                    className={cn(
                                        "flex min-h-40 flex-col gap-2 rounded-lg border p-2",
                                        skipped && "border-dashed opacity-50",
                                        isBlackout && "border-destructive",
                                    )}
                                >
                                    <p className="flex items-center gap-1.5 text-sm font-semibold">
                                        <Icon className="size-4" />
                                        {SEASON_LABELS[season]}
                                        {isBlackout && (
                                            <Zap className="ml-auto size-4 text-destructive" />
                                        )}
                                    </p>
                                    {skipped ? (
                                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <CircleSlash className="size-3" />
                                            Not played
                                        </p>
                                    ) : stories.length === 0 ? (
                                        <p className="text-xs text-muted-foreground">
                                            Nothing unusual.
                                        </p>
                                    ) : (
                                        stories.map((story) => (
                                            <SeasonStory
                                                key={story.id}
                                                story={story}
                                            />
                                        ))
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div>
                        <p className="mb-2 text-sm font-semibold">
                            The whole room
                        </p>
                        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            <Tile label="CO₂ this Round">
                                {formatEmissions(scenario.room.emissionsRound)}
                            </Tile>
                            <Tile label="CO₂ since Round 1">
                                {formatEmissions(scenario.room.emissionsTotal)}
                            </Tile>
                            <Tile label="From renewables">
                                {(scenario.room.renewableShare * 100).toFixed(
                                    0,
                                )}
                                %
                            </Tile>
                            <Tile label="Capacity built">
                                {formatPower(scenario.room.builtCapacity)}
                            </Tile>
                            <Tile label="Energy sold">
                                {formatEnergy(scenario.room.energySold)}
                            </Tile>
                            <Tile label="Average price /MWh">
                                <Money amount={scenario.room.averagePrice} />
                            </Tile>
                        </dl>
                    </div>
                </section>

                <section className="space-y-4 rounded-xl border-2 border-brand/40 bg-brand/5 p-4 md:p-6">
                    {isLast ? (
                        <>
                            <Heading>That was the last Round</Heading>
                            <p className="text-sm text-muted-foreground">
                                Final scores come next.
                            </p>
                        </>
                    ) : (
                        <LookingAhead scenario={scenario} />
                    )}
                </section>
            </div>
        </div>
    );
}

function LookingAhead({ scenario }: { scenario: RecapScenario }) {
    const next = scenario.round + 1;
    const change = demandChange(scenario);
    const nothing =
        scenario.coming.length === 0 &&
        scenario.unlocks.length === 0 &&
        (change === null || change === 0);

    return (
        <>
            <Heading>What changes in Round {next}</Heading>
            {change !== null && scenario.demand && (
                <div className="rounded-lg bg-card p-3">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                        {change >= 0 ? (
                            <TrendingUp className="size-4" />
                        ) : (
                            <TrendingDown className="size-4" />
                        )}
                        Demand{" "}
                        {change === 0 ? "holds steady" : formatPercent(change)}
                    </p>
                    <DemandBars
                        now={scenario.demand.thisRound}
                        next={scenario.demand.nextRound}
                        round={scenario.round}
                    />
                </div>
            )}
            {scenario.coming.map((story) => (
                <div key={story.id} className="rounded-lg bg-card p-3">
                    <p
                        className={cn(
                            "text-sm font-semibold",
                            story.tone === "bad"
                                ? "text-warning"
                                : "text-success",
                        )}
                    >
                        {story.effect}
                    </p>
                    <p className="mt-1 font-serif text-sm italic">
                        “{story.headline}”
                    </p>
                </div>
            ))}
            {scenario.unlocks.map((unlock) => (
                <div
                    key={unlock.facility}
                    className="flex items-start gap-3 rounded-lg bg-card p-3"
                >
                    <Sparkles className="mt-0.5 size-5 shrink-0 text-brand" />
                    <div className="text-sm">
                        <p className="font-semibold">
                            {unlock.from && (
                                <>
                                    {unlock.from}{" "}
                                    <ArrowRight className="inline size-3" />{" "}
                                </>
                            )}
                            {unlock.facility} is now on sale
                        </p>
                        <p className="text-muted-foreground">{unlock.why}.</p>
                    </div>
                </div>
            ))}
            {nothing && (
                <p className="text-sm text-muted-foreground">
                    Same conditions as this Round.
                </p>
            )}
        </>
    );
}

function DemandBars({
    now,
    next,
    round,
}: {
    now: number;
    next: number;
    round: number;
}) {
    const max = Math.max(now, next);
    return (
        <div className="mt-2 space-y-1 text-xs">
            {[
                {
                    label: `Round ${round}`,
                    value: now,
                    className: "bg-muted-foreground/40",
                },
                {
                    label: `Round ${round + 1}`,
                    value: next,
                    className: "bg-brand",
                },
            ].map((bar) => (
                <div key={bar.label} className="flex items-center gap-2">
                    <span className="w-16 shrink-0 text-muted-foreground">
                        {bar.label}
                    </span>
                    <div className="h-3 flex-1 rounded bg-muted">
                        <div
                            className={cn("h-3 rounded", bar.className)}
                            style={{ width: `${(bar.value / max) * 100}%` }}
                        />
                    </div>
                    <span className="w-16 shrink-0 text-right">
                        {formatPower(bar.value)}
                    </span>
                </div>
            ))}
        </div>
    );
}

function SeasonStory({ story }: { story: RecapStory }) {
    return (
        <div
            className={cn(
                "rounded-md border-l-4 bg-muted/50 p-2",
                story.tone === "bad" ? "border-warning" : "border-success",
            )}
        >
            <p className="text-xs font-semibold">
                {story.name}
                {story.severity && ` · ${story.severity}`}
            </p>
            <p className="mt-0.5 text-xs leading-snug">{story.headline}</p>
            <p className="mt-1 text-xs text-muted-foreground">{story.effect}</p>
        </div>
    );
}

function Heading({ children }: { children: ReactNode }) {
    return <h2 className="text-lg font-semibold">{children}</h2>;
}

function Tile({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="rounded-lg bg-muted/50 p-2">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-lg font-semibold">{children}</dd>
        </div>
    );
}
