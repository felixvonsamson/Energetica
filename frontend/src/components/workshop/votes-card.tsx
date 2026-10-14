/**
 * The facilitator's votes (#1014): put a carbon tax to the vote in a Round. The
 * switch is a lever of the Round's plan, so it can only change until the plan
 * locks, at the Recap before the Round, which then announces the vote. Round 1
 * has no Recap before it, so it holds no vote. Turning it on also turns it on
 * in every later Round. Once a vote closes, the session turns it off in the
 * later Rounds, so a failed tax can be proposed again. A carbon tax that passed
 * stays for good, so it cannot be proposed again. The facilitator never sees
 * the tally, only the result. #1018 builds the full lever console around this
 * card.
 */

import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Money,
} from "@/components/ui";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { TypographyMuted } from "@/components/ui/typography";
import {
    useChangeLevers,
    usePlanChangePending,
    useWorkshopPlans,
    useWorkshopSession,
    useWorkshopVote,
} from "@/hooks/use-workshop";
import { taxPerTonne } from "@/lib/workshop-vote";
import type { ApiSchema } from "@/types/api-helpers";

type RoundPlan = ApiSchema<"WorkshopRoundPlanOut">;

export function VotesCard() {
    const { data: plans, isError } = useWorkshopPlans();
    const { data: session } = useWorkshopSession();
    const { data: vote } = useWorkshopVote();
    const passedIn = session?.carbon_tax_since ?? null;

    return (
        <Card className="max-w-2xl">
            <CardHeader>
                <CardTitle>Votes</CardTitle>
                <TypographyMuted>
                    Put a carbon tax
                    {vote && (
                        <>
                            {" "}
                            of <Money amount={taxPerTonne(vote.tax_rate)} /> per
                            tonne of CO₂
                        </>
                    )}{" "}
                    to the vote in a Round's Investment phase. The Recap before
                    that Round announces it. Players see only the result, when
                    the Round's first Trading period opens. If it passes, the
                    tax stays until the end of the game.
                </TypographyMuted>
            </CardHeader>
            <CardContent>
                {isError ? (
                    <TypographyMuted>
                        The plans could not be loaded.
                    </TypographyMuted>
                ) : !plans ? (
                    <div className="flex justify-center py-6">
                        <Spinner />
                    </div>
                ) : (
                    <div className="space-y-3">
                        {passedIn !== null && (
                            <p className="text-sm font-semibold">
                                The carbon tax passed in Round {passedIn}. It
                                cannot be put to the vote again.
                            </p>
                        )}
                        <ul className="divide-y divide-border">
                            {plans.rounds.map((plan) => (
                                <VoteRow
                                    key={plan.round}
                                    plan={plan}
                                    taxPassed={passedIn !== null}
                                />
                            ))}
                        </ul>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function VoteRow({ plan, taxPassed }: { plan: RoundPlan; taxPassed: boolean }) {
    const { mutate: changeLevers } = useChangeLevers();
    const pending = usePlanChangePending();
    const id = `carbon-tax-vote-${plan.round}`;
    const proposed = plan.levers.carbon_tax_vote;

    return (
        <li className="flex items-center justify-between gap-4 py-2 text-sm">
            <label htmlFor={id} className="font-medium">
                Round {plan.round}
                {plan.locked && (
                    <span className="ml-2 font-normal text-muted-foreground">
                        locked
                    </span>
                )}
            </label>
            <Switch
                id={id}
                checked={proposed}
                disabled={
                    plan.round === 1 ||
                    plan.locked ||
                    pending ||
                    (taxPassed && !proposed)
                }
                onCheckedChange={(checked) =>
                    changeLevers({
                        round: plan.round,
                        changes: { carbon_tax_vote: checked },
                    })
                }
            />
        </li>
    );
}
