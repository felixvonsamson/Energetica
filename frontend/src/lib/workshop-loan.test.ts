import { describe, expect, it } from "vitest";

import type { ApiSchema } from "@/types/api-helpers";

import { paymentAfterRecap, paymentWhen } from "./workshop-loan";

type WorkshopLoan = ApiSchema<"WorkshopLoanOut">;

/**
 * A loan taken in Round `round` of a 3-Round session, with `paid` payments
 * made.
 */
const loan = (round: number, paid = 0): WorkshopLoan => ({
    amount: 1_000_000,
    payment: 600_000,
    payment_count: 2,
    available: false,
    taken_round: round,
    cancellable: false,
    payments: [round + 1, round + 2].map((due, index) => ({
        round: due <= 3 ? due : null,
        amount: 600_000,
        paid: index < paid,
    })),
});

describe("paymentWhen", () => {
    it("names the Round whose start takes the payment", () => {
        expect(paymentWhen({ round: 2, amount: 600_000, paid: false })).toBe(
            "at the start of Round 2",
        );
    });

    it("names the session end for a payment after the last Round", () => {
        expect(paymentWhen({ round: null, amount: 600_000, paid: false })).toBe(
            "when the session ends",
        );
    });
});

describe("paymentAfterRecap", () => {
    it("finds the payment the next Round's start takes", () => {
        expect(paymentAfterRecap(loan(1), 1, 3)?.round).toBe(2);
        expect(paymentAfterRecap(loan(1, 1), 2, 3)?.round).toBe(3);
    });

    it("finds the payment taken when the session ends after the last Recap", () => {
        expect(paymentAfterRecap(loan(2, 1), 3, 3)).toEqual({
            round: null,
            amount: 600_000,
            paid: false,
        });
    });

    it("finds nothing once the loan is paid back, or before it is due", () => {
        expect(paymentAfterRecap(loan(1, 2), 3, 3)).toBeUndefined();
        expect(paymentAfterRecap(loan(2), 1, 3)).toBeUndefined();
    });
});
