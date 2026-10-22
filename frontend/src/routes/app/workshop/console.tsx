/**
 * The facilitator's console (#1018): one screen to plan the session and run it.
 * Each Round has a tab with its levers, its events and its votes, which the
 * facilitator changes until the Recap before the Round locks them. The console
 * opens on the earliest Round that can still change, and the facilitator can
 * add a Round until the last Recap opens (#1298). Outside the tabs sit what
 * belongs to the whole session: the links to the join link and roster, the
 * phase timers, and how far each technology is from unlocking its upgrade
 * (#1011). Facilitator only: players learn of a Round only at the Recap, so
 * they are sent back to the Workshop home.
 */

import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { Lock, Plus } from "lucide-react";
import { useState } from "react";

import { PhaseTimersCard } from "@/components/workshop/phase-timers-card";
import { RoundEvents } from "@/components/workshop/round-events";
import { RoundLevers } from "@/components/workshop/round-levers";
import { RoundVotes } from "@/components/workshop/round-votes";
import {
    useAddRound,
    usePlanChangePending,
    useWorkshopEntry,
    useWorkshopEvents,
    useWorkshopPlans,
    useWorkshopSession,
    useWorkshopUnlocks,
} from "@/hooks/use-workshop";
import { canAddRound, consoleRound } from "@/lib/workshop-console";
import type { ApiSchema } from "@/types/api-helpers";
import { Button } from "@energetica/ui/components/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@energetica/ui/components/card";
import { ConfirmDialog } from "@energetica/ui/components/confirm-dialog";
import { Money } from "@energetica/ui/components/money";
import { ProgressBar } from "@energetica/ui/components/progress-bar";
import { Spinner } from "@energetica/ui/components/spinner";
import { Tabs, TabsList, TabsTrigger } from "@energetica/ui/components/tabs";
import {
    TypographyH2,
    TypographyMuted,
} from "@energetica/ui/components/typography";

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
            <AccessCard />
            <RoundPlansCard />
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                <PhaseTimersCard />
                <TechnologyUnlocksCard />
            </div>
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
    const [pickedRound, setPickedRound] = useState<number | null>(null);
    const plan =
        plans.rounds.find((candidate) => candidate.round === pickedRound) ??
        plans.rounds.find(
            (candidate) => candidate.round === consoleRound(plans),
        );
    if (!plan) return null;

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
                <Tabs
                    value={`${plan.round}`}
                    onValueChange={(value) => setPickedRound(Number(value))}
                >
                    <TabsList className="flex h-auto w-full flex-wrap justify-start sm:w-fit">
                        {plans.rounds.map((candidate) => (
                            <TabsTrigger
                                key={candidate.round}
                                value={`${candidate.round}`}
                                className="flex-none"
                            >
                                {candidate.locked && (
                                    <Lock
                                        className="size-3"
                                        aria-label="locked"
                                    />
                                )}
                                Round {candidate.round}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>
                <AddRoundButton
                    roundCount={plans.rounds.length}
                    onAdded={setPickedRound}
                />
            </div>
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

/**
 * Adds a Round after the last one (#1298), once the facilitator confirms, and
 * opens its tab. Hidden once the last Round's Recap has opened.
 */
function AddRoundButton({
    roundCount,
    onAdded,
}: {
    roundCount: number;
    onAdded: (round: number) => void;
}) {
    const { data: session } = useWorkshopSession();
    const addRound = useAddRound();
    const planChangePending = usePlanChangePending();
    if (!session || !canAddRound(session.checkpoint, roundCount)) return null;

    const newRound = roundCount + 1;
    // Prices follow the length the session starts with (#1306), so only an added Round before it starts moves them.
    const prices =
        session.checkpoint.kind === "not_started"
            ? `Facility prices change to those of a ${newRound}-Round session.`
            : "Facility prices stay as they are.";
    return (
        <ConfirmDialog
            trigger={
                <Button
                    variant="outline"
                    size="sm"
                    disabled={planChangePending}
                >
                    <Plus />
                    Add a Round
                </Button>
            }
            title={`Add Round ${newRound}?`}
            description={`The session then runs ${newRound} Rounds instead of ${roundCount}, and players see the new count straight away. Round ${newRound} starts with Round ${roundCount}'s levers and no events, and you can change it until Recap ${roundCount} opens. ${prices} A Round cannot be removed once added.`}
            confirmLabel="Add Round"
            onConfirm={() =>
                addRound.mutate(undefined, {
                    onSuccess: () => onAdded(newRound),
                })
            }
            isPending={addRound.isPending}
        />
    );
}

/**
 * When the Round's plan locked, or when it will. Round 1 has no Recap before
 * it.
 */
function lockStatus(plan: RoundPlan): string {
    const carries = "A lever change also applies to every later Round.";
    if (plan.round === 1) {
        return plan.locked
            ? "Round 1 locked when the session started."
            : `Round 1 locks when the session starts. ${carries}`;
    }
    const recap = `Recap ${plan.round - 1}`;
    return plan.locked
        ? `Round ${plan.round} locked when ${recap} opened: players have been told what it holds.`
        : `Round ${plan.round} locks when ${recap} opens. ${carries}`;
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
            <TypographyMuted>{lockStatus(plan)}</TypographyMuted>
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
                <RoundVotes plans={plans} plan={plan} />
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
