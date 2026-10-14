/**
 * The facilitator's console (#1018): one screen to plan the session and run it.
 * Each Round has a tab with its levers, its events and its votes, which the
 * facilitator changes until the Recap before the Round locks them. The console
 * opens on the earliest Round that can still change. Outside the tabs sit what
 * belongs to the whole session: the links to the join link and roster, the
 * phase timers, and how far each technology is from unlocking its upgrade
 * (#1011). Facilitator only: players learn of a Round only at the Recap, so
 * they are sent back to the Workshop home.
 */

import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useState } from "react";

import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Money,
} from "@/components/ui";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TypographyH2, TypographyMuted } from "@/components/ui/typography";
import { PhaseTimersCard } from "@/components/workshop/phase-timers-card";
import { RoundEvents } from "@/components/workshop/round-events";
import { RoundLevers } from "@/components/workshop/round-levers";
import { RoundVotes } from "@/components/workshop/round-votes";
import {
    useWorkshopEntry,
    useWorkshopEvents,
    useWorkshopPlans,
    useWorkshopUnlocks,
} from "@/hooks/use-workshop";
import { consoleRound } from "@/lib/workshop-console";
import type { ApiSchema } from "@/types/api-helpers";

type WorkshopUnlocks = ApiSchema<"WorkshopUnlocksOut">;
type TechnologyProgress = ApiSchema<"WorkshopTechnologyProgressOut">;
type WorkshopPlans = ApiSchema<"WorkshopPlansOut">;
type WorkshopEvents = ApiSchema<"WorkshopEventsOut">;
type RoundPlan = ApiSchema<"WorkshopRoundPlanOut">;

export const Route = createFileRoute("/app/workshop/console")({
    component: ConsolePage,
    staticData: { title: "Console", runMode: "workshop", wide: true },
});

function ConsolePage() {
    const { data: entry } = useWorkshopEntry();
    if (!entry) return <Loading />;
    if (entry.role !== "facilitator")
        return <Navigate to="/app/workshop" replace />;
    return (
        <div className="space-y-6">
            <TypographyH2>Console</TypographyH2>
            <div className="grid gap-6 lg:grid-cols-2">
                <AccessCard />
                <PhaseTimersCard />
            </div>
            <RoundPlansCard />
            <TechnologyUnlocksCard />
        </div>
    );
}

function AccessCard() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Access</CardTitle>
                <TypographyMuted>
                    Who can enter this Run: share the join link or its QR code,
                    open or close it, and add or remove players on the roster.
                </TypographyMuted>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
                <Button variant="outline" asChild>
                    <Link to="/app/facilitator">Join link & QR code</Link>
                </Button>
                <Button variant="outline" asChild>
                    <Link to="/app/facilitator/roster">Roster</Link>
                </Button>
            </CardContent>
        </Card>
    );
}

function RoundPlansCard() {
    const plans = useWorkshopPlans();
    const events = useWorkshopEvents();

    return (
        <Card>
            <CardHeader>
                <CardTitle>Round plans</CardTitle>
                <TypographyMuted>
                    Each Round's levers, events and votes take effect in that
                    Round. You can change a Round until the Recap before it
                    tells players what it holds. Round 1 locks when the session
                    starts.
                </TypographyMuted>
            </CardHeader>
            <CardContent>
                {plans.isError || events.isError ? (
                    <TypographyMuted>
                        The Round plans could not be loaded.
                    </TypographyMuted>
                ) : plans.data && events.data ? (
                    <RoundTabs plans={plans.data} events={events.data} />
                ) : (
                    <Loading />
                )}
            </CardContent>
        </Card>
    );
}

function RoundTabs({
    plans,
    events,
}: {
    plans: WorkshopPlans;
    events: WorkshopEvents;
}) {
    const [chosen, setChosen] = useState<number | null>(null);
    const plan =
        plans.rounds.find((candidate) => candidate.round === chosen) ??
        plans.rounds.find(
            (candidate) => candidate.round === consoleRound(plans),
        );
    if (!plan) return null;

    return (
        <div className="space-y-6">
            <Tabs
                value={`${plan.round}`}
                onValueChange={(value) => setChosen(Number(value))}
            >
                <TabsList className="flex h-auto w-full flex-wrap justify-start sm:w-fit">
                    {plans.rounds.map((candidate) => (
                        <TabsTrigger
                            key={candidate.round}
                            value={`${candidate.round}`}
                            className="flex-none"
                        >
                            {candidate.locked && (
                                <Lock className="size-3" aria-label="locked" />
                            )}
                            Round {candidate.round}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>
            {/* Keyed by Round, so a note left by a change stays with the Round it was made in. */}
            <RoundPlanView
                key={plan.round}
                plans={plans}
                plan={plan}
                events={events}
            />
        </div>
    );
}

function RoundPlanView({
    plans,
    plan,
    events,
}: {
    plans: WorkshopPlans;
    plan: RoundPlan;
    events: WorkshopEvents;
}) {
    return (
        <div className="space-y-8">
            <TypographyMuted>
                {plan.locked
                    ? plan.round === 1
                        ? "Round 1 locked when the session started."
                        : `Round ${plan.round} locked when Recap ${plan.round - 1} opened: players have been told what it holds.`
                    : `Round ${plan.round} locks when Recap ${plan.round - 1} opens. A lever change also applies to every later Round.`}
            </TypographyMuted>
            <section className="space-y-3">
                <h3 className="text-lg font-semibold">Levers</h3>
                <RoundLevers plans={plans} plan={plan} />
            </section>
            <section className="space-y-3">
                <h3 className="text-lg font-semibold">Events & Storytelling</h3>
                <RoundEvents events={events} plan={plan} />
            </section>
            <section className="space-y-3">
                <h3 className="text-lg font-semibold">Votes</h3>
                <RoundVotes plan={plan} />
            </section>
        </div>
    );
}

function TechnologyUnlocksCard() {
    const { data: unlocks, isError } = useWorkshopUnlocks();

    return (
        <Card>
            <CardHeader>
                <CardTitle>Technology unlocks</CardTitle>
                <TypographyMuted>
                    Only you see this. Every player's purchases of a base
                    technology add up, and once they reach the threshold, its
                    upgrade unlocks from the next Round. Players find out at the
                    Recap.
                </TypographyMuted>
            </CardHeader>
            <CardContent>
                {isError ? (
                    <TypographyMuted>
                        The unlock progress could not be loaded.
                    </TypographyMuted>
                ) : unlocks ? (
                    <UnlockProgress unlocks={unlocks} />
                ) : (
                    <Loading />
                )}
            </CardContent>
        </Card>
    );
}

function UnlockProgress({ unlocks }: { unlocks: WorkshopUnlocks }) {
    const unlockedRound = (facility: ApiSchema<"FacilityId">) =>
        unlocks.unlocks.find((unlock) => unlock.facility === facility)?.round;
    const cspRound = unlockedRound("csp_solar");
    const fullSeasonRound = unlockedRound("hydrogen_storage");

    return (
        <div className="space-y-5">
            <p className="text-sm">
                Threshold: <Money amount={unlocks.threshold} /> spent on a base
                technology. It grows with the number of players.
            </p>
            <ul className="space-y-4">
                {unlocks.technologies.map((technology) => (
                    <TechnologyRow
                        key={technology.base}
                        technology={technology}
                        threshold={unlocks.threshold}
                    />
                ))}
            </ul>
            <div className="space-y-1 border-t border-border pt-4 text-sm">
                <p>
                    <span className="font-semibold">
                        Concentrated solar power
                    </span>{" "}
                    {cspRound === undefined
                        ? `unlocks from Round ${unlocks.csp_unlock_round}.`
                        : `unlocked from Round ${cspRound}.`}
                </p>
                <p>
                    <span className="font-semibold">
                        Hydrogen storage and pumped hydro
                    </span>{" "}
                    {fullSeasonRound === undefined
                        ? "unlock the first Round that allows every storage type."
                        : `unlocked from Round ${fullSeasonRound}.`}
                </p>
            </div>
        </div>
    );
}

function TechnologyRow({
    technology,
    threshold,
}: {
    technology: TechnologyProgress;
    threshold: number;
}) {
    const unlocked = technology.unlocked_round !== null;
    // The threshold is zero before anyone joins, which would leave the bar
    // nothing to fill.
    const max = Math.max(threshold, 1);
    // Reached, but upgrades unlock only when a Round ends.
    const reached =
        !unlocked &&
        technology.invested > 0 &&
        technology.invested >= threshold;

    return (
        <li className="space-y-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 text-sm">
                <span className="font-semibold">
                    {technology.base_name} → {technology.upgrade_name}
                </span>
                <span className="text-muted-foreground">
                    {unlocked ? (
                        `Unlocked from Round ${technology.unlocked_round}`
                    ) : (
                        <>
                            <Money amount={technology.invested} /> of{" "}
                            <Money amount={threshold} />
                            {reached && " — unlocks when the Round ends"}
                        </>
                    )}
                </span>
            </div>
            <ProgressBar
                value={unlocked ? max : technology.invested}
                max={max}
                showPercentage={false}
            />
        </li>
    );
}

function Loading() {
    return (
        <div className="flex justify-center py-12">
            <Spinner />
        </div>
    );
}
