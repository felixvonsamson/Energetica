/**
 * One Round's votes in the facilitator's console (#1014, #1018): one switch per
 * proposal. Only the carbon tax can be put to the vote so far. A proposal is a
 * lever of the Round's plan, so it can only change until the plan locks, at the
 * Recap before the Round, which then announces the vote. Round 1 has no Recap
 * before it, so it holds no vote. Turning a proposal on also turns it on in
 * every later Round. Once a vote closes, the session turns it off in the later
 * Rounds, so a failed carbon tax can be proposed again. A carbon tax that
 * passed stays for good, so it cannot be proposed again. The facilitator never
 * sees the tally, only the result.
 */

import { type ReactNode, useState } from "react";

import { Money } from "@/components/ui";
import { Switch } from "@/components/ui/switch";
import { TypographyMuted } from "@/components/ui/typography";
import {
    useChangeLevers,
    usePlanChangePending,
    useWorkshopSession,
    useWorkshopVote,
} from "@/hooks/use-workshop";
import { carriedNote, carriedRounds } from "@/lib/workshop-console";
import { taxPerTonne } from "@/lib/workshop-vote";
import type { ApiSchema } from "@/types/api-helpers";

type WorkshopPlans = ApiSchema<"WorkshopPlansOut">;
type RoundPlan = ApiSchema<"WorkshopRoundPlanOut">;

export function RoundVotes({
    plans,
    plan,
}: {
    plans: WorkshopPlans;
    plan: RoundPlan;
}) {
    const { data: session } = useWorkshopSession();
    const { data: vote } = useWorkshopVote();
    const { mutate: changeLevers } = useChangeLevers();
    const pending = usePlanChangePending();
    const passedIn = session?.carbon_tax_since ?? null;
    const proposed = plan.levers.carbon_tax_vote;
    // The note left by the last change, when it carried to later Rounds.
    const [carried, setCarried] = useState<string | null>(null);

    return (
        <ul className="divide-y divide-border">
            <Proposal
                id={`carbon-tax-vote-${plan.round}`}
                title="Carbon tax"
                description={
                    <>
                        A tax
                        {vote && (
                            <>
                                {" "}
                                of <Money
                                    amount={taxPerTonne(vote.tax_rate)}
                                />{" "}
                                per tonne of CO₂
                            </>
                        )}
                        , voted on in the Round's Investment phase. Players see
                        only the result, when the Round's first Trading period
                        opens. If it passes, it stays until the end of the game.
                        {plan.round === 1 &&
                            " Round 1 holds no vote: no Recap comes before it to announce one."}
                        {passedIn !== null &&
                            ` It passed in Round ${passedIn}, so it cannot be put to the vote again.`}
                    </>
                }
                checked={proposed}
                disabled={
                    plan.round === 1 ||
                    plan.locked ||
                    pending ||
                    (passedIn !== null && !proposed)
                }
                note={carried}
                onChange={(checked) => {
                    setCarried(null);
                    changeLevers(
                        {
                            round: plan.round,
                            changes: { carbon_tax_vote: checked },
                        },
                        {
                            onSuccess: (after) =>
                                setCarried(
                                    carriedNote(
                                        carriedRounds(plans, after, plan.round),
                                    ),
                                ),
                        },
                    );
                }}
            />
        </ul>
    );
}

function Proposal({
    id,
    title,
    description,
    checked,
    disabled,
    note,
    onChange,
}: {
    id: string;
    title: string;
    description: ReactNode;
    checked: boolean;
    disabled: boolean;
    note: string | null;
    onChange: (checked: boolean) => void;
}) {
    return (
        <li className="flex items-start justify-between gap-4 py-2">
            <div className="space-y-1">
                <label htmlFor={id} className="text-sm font-medium">
                    {title}
                </label>
                <TypographyMuted className="text-xs">
                    {description}
                </TypographyMuted>
                {note && (
                    <p className="text-xs font-medium" role="status">
                        {note}
                    </p>
                )}
            </div>
            <Switch
                id={id}
                checked={checked}
                disabled={disabled}
                onCheckedChange={onChange}
            />
        </li>
    );
}
