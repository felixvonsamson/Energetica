/**
 * The carbon tax vote (#1014), as players and the facilitator see it.
 *
 * - {@link CarbonTaxBallot}: where a player votes, above the catalog while the
 *   Investment phase is open in a Round that holds a vote.
 * - {@link VoteResultDialog}: the result, announced to everyone once when the
 *   Round's first Trading period opens. Nobody ever sees the tally.
 * - {@link CarbonTaxNotice}: shown on the facility page from the moment a carbon
 *   tax passes to the end of the session.
 */

import { Check, Landmark } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Money } from "@/components/ui/money";
import { useLocalStorage } from "@/hooks/use-local-storage";
import {
    useCastBallot,
    useInvestmentOpen,
    useWorkshopSession,
    useWorkshopVote,
} from "@/hooks/use-workshop";
import { resultToAnnounce, taxPerTonne } from "@/lib/workshop-vote";
import type { ApiSchema } from "@/types/api-helpers";

type Ballot = ApiSchema<"WorkshopBallotIn">["ballot"];

/**
 * A player's ballot, while the Investment phase of a Round that holds a vote is
 * open.
 */
export function CarbonTaxBallot() {
    const { data: vote } = useWorkshopVote();
    const investmentOpen = useInvestmentOpen();
    const { mutate: cast, isPending, variables } = useCastBallot();
    if (!vote?.held || !investmentOpen) return null;
    // The ballot just cast shows straight away.
    const ballot = isPending ? variables : vote.ballot;

    return (
        <section className="space-y-3 rounded-xl border border-border-brand bg-card p-4">
            <div className="flex items-center gap-2">
                <Landmark className="size-5 text-brand" />
                <h3 className="font-semibold">Vote: carbon tax</h3>
            </div>
            <div className="space-y-2 text-sm">
                <p>
                    The facilitator proposes a carbon tax of{" "}
                    <Money amount={taxPerTonne(vote.tax_rate)} /> per tonne of
                    CO₂. If it passes, every player pays it on the CO₂ their
                    facilities emit, from this Round's first Trading period
                    until the end of the game. The money collected is shared
                    equally among all players.
                </p>
                <p className="text-muted-foreground">
                    The tax passes if more players vote yes than no. Players who
                    do not vote are not counted, and a tie means no tax. Nobody
                    sees how anyone voted. You can change your vote until the
                    Investment phase closes.
                </p>
            </div>
            <div className="flex gap-2">
                <BallotButton
                    ballot="yes"
                    chosen={ballot}
                    disabled={isPending}
                    onClick={() => cast("yes")}
                />
                <BallotButton
                    ballot="no"
                    chosen={ballot}
                    disabled={isPending}
                    onClick={() => cast("no")}
                />
            </div>
        </section>
    );
}

function BallotButton({
    ballot,
    chosen,
    disabled,
    onClick,
}: {
    ballot: Ballot;
    chosen: Ballot | null | undefined;
    disabled: boolean;
    onClick: () => void;
}) {
    const selected = ballot === chosen;
    return (
        <Button
            variant={selected ? "default" : "outline"}
            aria-pressed={selected}
            disabled={disabled}
            onClick={onClick}
        >
            {selected && <Check className="size-4" />}
            {ballot === "yes" ? "Vote yes" : "Vote no"}
        </Button>
    );
}

/**
 * The vote's result, announced once to each visitor when the Round's first
 * Trading period opens. The last Round whose result the visitor has seen is
 * kept in their browser, and forgotten once a new session shows it is behind.
 */
export function VoteResultDialog() {
    const { data: session } = useWorkshopSession();
    const { data: vote } = useWorkshopVote();
    const [seenRound, setSeenRound] = useLocalStorage(
        "workshop-vote-result-seen",
        0,
        (value): value is number => typeof value === "number",
    );
    // What the browser saw of an earlier session is forgotten as soon as this
    // one shows it is behind: not started, or in an earlier Round.
    const checkpoint = session?.checkpoint;
    const earlierSession =
        checkpoint !== undefined &&
        (checkpoint.kind === "not_started" ||
            ("round" in checkpoint && checkpoint.round < seenRound));
    useEffect(() => {
        if (earlierSession) setSeenRound(0);
    }, [earlierSession, setSeenRound]);
    if (!session || !vote) return null;
    const open = resultToAnnounce(session.checkpoint, vote, seenRound);
    const close = () => setSeenRound(vote.round);

    return (
        <Dialog open={open} onOpenChange={(next) => !next && close()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {vote.passed
                            ? "The carbon tax passed"
                            : "The carbon tax did not pass"}
                    </DialogTitle>
                    <DialogDescription>
                        Result of the Round {vote.round} vote
                    </DialogDescription>
                </DialogHeader>
                {vote.passed ? (
                    <p className="text-sm">
                        From this Trading period on, every player pays{" "}
                        <Money amount={taxPerTonne(vote.tax_rate)} /> per tonne
                        of CO₂ their facilities emit. The money collected is
                        shared equally among all players. The tax stays until
                        the end of the game.
                    </p>
                ) : (
                    <p className="text-sm">
                        Nobody pays a carbon tax. The facilitator can propose it
                        again in a later Round.
                    </p>
                )}
                <DialogFooter>
                    <Button onClick={close}>OK</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/**
 * A callout on the facility page while a carbon tax is in force (#1247), so
 * players see it where they choose what to build, from the Round its vote
 * passed in to the end of the session.
 */
export function CarbonTaxNotice() {
    const { data: session } = useWorkshopSession();
    const { data: vote } = useWorkshopVote();
    const since = session?.carbon_tax_since ?? null;
    if (since === null) return null;

    return (
        <aside className="flex items-start gap-3 rounded-lg border border-brand/30 bg-brand/10 px-4 py-3 text-sm">
            <Landmark className="mt-0.5 size-5 shrink-0 text-brand" />
            <p>
                <span className="font-semibold">Carbon tax in force.</span>{" "}
                {/* The rate comes with the vote, so it shows once that loads. */}
                {vote && (
                    <>
                        You pay <Money amount={taxPerTonne(vote.tax_rate)} />{" "}
                        per tonne of CO₂ your facilities emit.{" "}
                    </>
                )}
                It passed in Round {since} and stays until the end of the game.
            </p>
        </aside>
    );
}
