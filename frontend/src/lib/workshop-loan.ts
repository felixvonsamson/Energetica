/**
 * Wording and timing for the Workshop loan (#1225): when each payment is taken,
 * and which one a Recap reminds the player of.
 */

import type { ApiSchema } from "@/types/api-helpers";

type WorkshopLoan = ApiSchema<"WorkshopLoanOut">;
type LoanPayment = ApiSchema<"WorkshopLoanPaymentOut">;

/**
 * When `payment` is taken: "at the start of Round 3", or "when the session
 * ends".
 */
export function paymentWhen(payment: LoanPayment): string {
    return payment.round === null
        ? "when the session ends"
        : `at the start of Round ${payment.round}`;
}

/**
 * The payment taken right after Round `round`'s Recap, if one is still to be
 * paid: as the next Round starts, or, after the last Round, when the session
 * ends.
 */
export function paymentAfterRecap(
    loan: WorkshopLoan,
    round: number,
    roundCount: number,
): LoanPayment | undefined {
    return loan.payments.find(
        (payment) =>
            !payment.paid &&
            (round < roundCount
                ? payment.round === round + 1
                : payment.round === null),
    );
}
