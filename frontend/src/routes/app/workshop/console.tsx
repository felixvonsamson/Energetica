/**
 * The facilitator's console: for now, how far each technology is from unlocking
 * its upgrade (#1011), the events to pick (#1012), and the Rounds that put a
 * carbon tax to the vote (#1014). The full lever console (#1018) builds on this
 * page. Facilitator only: players never see how close an unlock is, so they are
 * sent back to the Workshop home.
 */

import { createFileRoute, Navigate } from "@tanstack/react-router";

import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Money,
} from "@/components/ui";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Spinner } from "@/components/ui/spinner";
import { TypographyH2, TypographyMuted } from "@/components/ui/typography";
import { EventsCard } from "@/components/workshop/events-card";
import { VotesCard } from "@/components/workshop/votes-card";
import { useWorkshopEntry, useWorkshopUnlocks } from "@/hooks/use-workshop";
import type { ApiSchema } from "@/types/api-helpers";

type WorkshopUnlocks = ApiSchema<"WorkshopUnlocksOut">;
type TechnologyProgress = ApiSchema<"WorkshopTechnologyProgressOut">;

export const Route = createFileRoute("/app/workshop/console")({
    component: ConsolePage,
    staticData: { title: "Console", runMode: "workshop" },
});

function ConsolePage() {
    const { data: entry } = useWorkshopEntry();
    if (!entry) return <Loading />;
    if (entry.role !== "facilitator")
        return <Navigate to="/app/workshop" replace />;
    return (
        <div className="space-y-6">
            <TypographyH2>Console</TypographyH2>
            <EventsCard />
            <VotesCard />
            <TechnologyUnlocksCard />
        </div>
    );
}

function TechnologyUnlocksCard() {
    const { data: unlocks, isError } = useWorkshopUnlocks();

    return (
        <Card className="max-w-2xl">
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
