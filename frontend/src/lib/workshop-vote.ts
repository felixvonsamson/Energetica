/**
 * The carbon tax vote (#1014): when to announce its result.
 *
 * The result is announced to everyone when the Round's first Trading period
 * opens, once, in a dialog. A visitor who arrives later in the Round still sees
 * it, at the next Trading period they open.
 */

import type { ApiSchema } from "@/types/api-helpers";

type Checkpoint = ApiSchema<"WorkshopSessionOut">["checkpoint"];
type WorkshopVote = ApiSchema<"WorkshopVoteOut">;

/**
 * Whether to announce `vote`'s result at `checkpoint`, to a visitor who has
 * seen the results of Rounds 1 to `seenRound`.
 */
export function resultToAnnounce(
    checkpoint: Checkpoint,
    vote: WorkshopVote,
    seenRound: number,
): boolean {
    return (
        checkpoint.kind === "trading_period" &&
        vote.round === checkpoint.round &&
        vote.passed !== null &&
        vote.round > seenRound
    );
}

/**
 * The cached vote `current` with the ballot from `answer`, the server's answer
 * to a ballot cast. Only the ballot is taken, and only while `current` is the
 * same Round's vote and still open: the answer can arrive after the vote was
 * counted and read again, and must not hide the result.
 */
export function withBallot(
    current: WorkshopVote | undefined,
    answer: WorkshopVote,
): WorkshopVote | undefined {
    if (current?.round !== answer.round || current.passed !== null) {
        return current;
    }
    return { ...current, ballot: answer.ballot };
}

/** The tax per tonne of CO₂, from its rate per kg. */
export function taxPerTonne(taxRate: number): number {
    return taxRate * 1000;
}
