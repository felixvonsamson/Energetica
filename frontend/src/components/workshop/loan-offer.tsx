/**
 * The loan (#1225), as a player sees it.
 *
 * - {@link LoanOffer}: above the catalog while the Investment phase is open. A
 *   player who has not taken the loan sees its terms and can take it. One who
 *   took it in this phase can cancel it until the phase closes. One who took it
 *   in an earlier Round sees what is left to pay back.
 * - {@link LoanReminder}: on a Recap, the payment taken as the next Round starts,
 *   or when the session ends, as a yellow post-it note stuck on the page.
 */

import { HandCoins } from "lucide-react";

import {
    useCancelLoan,
    useInvestmentOpen,
    useTakeLoan,
    useWorkshopEntry,
    useWorkshopLoan,
    useWorkshopSession,
} from "@/hooks/use-workshop";
import { paymentAfterRecap, paymentWhen } from "@/lib/workshop-loan";
import { Button } from "@energetica/ui/components/button";
import { Money } from "@energetica/ui/components/money";

export function LoanOffer() {
    const investmentOpen = useInvestmentOpen();
    const { data: loan } = useWorkshopLoan();
    const take = useTakeLoan();
    const cancel = useCancelLoan();
    if (!loan || !investmentOpen) return null;
    if (!loan.available && loan.taken_round === null) return null;
    const pending = take.isPending || cancel.isPending;
    const unpaid = loan.payments.filter((payment) => !payment.paid);

    return (
        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
                <HandCoins className="size-5 text-brand" />
                <h3 className="font-semibold">Loan</h3>
            </div>
            {loan.taken_round === null ? (
                <div className="space-y-2 text-sm">
                    <p>
                        Get <Money amount={loan.amount} /> now, pay back{" "}
                        <Money amount={loan.payment} /> at the start of each of
                        the next {loan.payment_count} Rounds.
                    </p>
                    <p className="text-muted-foreground">
                        The money is yours straight away, so you can spend it in
                        this Investment phase. You can take the loan once per
                        game. It costs{" "}
                        <Money
                            amount={
                                loan.payment * loan.payment_count - loan.amount
                            }
                        />{" "}
                        in total, which counts against your final score. A
                        payment due after the last Round is taken when the game
                        ends.
                    </p>
                </div>
            ) : (
                <div className="space-y-2 text-sm">
                    <p>
                        You took a loan of <Money amount={loan.amount} /> in
                        Round {loan.taken_round}.
                        {unpaid.length > 0 && " Still to pay back:"}
                    </p>
                    {unpaid.length > 0 && (
                        <ul className="list-disc pl-5">
                            {/* No two payments fall in the same Round. */}
                            {unpaid.map((payment) => (
                                <li key={payment.round ?? "session-end"}>
                                    <Money amount={payment.amount} />{" "}
                                    {paymentWhen(payment)}
                                </li>
                            ))}
                        </ul>
                    )}
                    {loan.cancellable && (
                        <p className="text-muted-foreground">
                            You can cancel it until the Investment phase closes,
                            as long as your selection fits your cash without it.
                        </p>
                    )}
                </div>
            )}
            {loan.available && (
                <Button disabled={pending} onClick={() => take.mutate()}>
                    Take the loan
                </Button>
            )}
            {loan.cancellable && (
                <Button
                    variant="outline"
                    disabled={pending}
                    onClick={() => cancel.mutate()}
                >
                    Cancel the loan
                </Button>
            )}
        </section>
    );
}

/**
 * Reminds a player on Round `round`'s Recap of the loan payment taken right
 * after it. Nothing for the facilitator, or a player with no payment due.
 */
export function LoanReminder({ round }: { round: number }) {
    const { data: entry } = useWorkshopEntry();
    const { data: session } = useWorkshopSession();
    const { data: loan } = useWorkshopLoan({
        enabled: entry?.role === "player",
    });
    if (!session || !loan) return null;
    const payment = paymentAfterRecap(loan, round, session.round_count);
    if (!payment) return null;

    return (
        // A sticky note, in the newspaper's colours rather than the theme's, so
        // it reads the same way in dark mode.
        <aside className="w-48 rotate-3 bg-yellow-200 p-3 font-sans text-sm leading-snug text-neutral-900 shadow-[2px_4px_10px_rgba(0,0,0,0.3)] sm:w-56">
            <p className="font-bold">Loan payment</p>
            <p>
                <Money amount={payment.amount} /> comes off your cash{" "}
                {paymentWhen(payment)}.
            </p>
        </aside>
    );
}
