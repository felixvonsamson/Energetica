"""The loan each player can take once per session (#1225).

A player takes it in an Investment phase while the phase is open, in any Round but the last. Its amount is added to
their cash straight away, so they can spend it in the same phase. Until the phase closes, they can cancel it, as long
as their selection still fits their cash without it. Once the phase closes, the loan is final.

The loan is paid back in :data:`LOAN_PAYMENTS` equal payments. A loan taken in Round r is paid back as Rounds r+1,
r+2, … start, before the cash floor is applied (#1016). A payment due after the last Round is taken when the session
ends. A payment can take a player's cash below zero, like any other cost.

The loan costs more than it brings in. The difference, :data:`LOAN_COST`, counts in the final score as an
investment with no residual value (:mod:`~energetica.workshop.score`), whatever the cash floor does to the
payments.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

# What the loan adds to a player's cash: the starting budget, as set by the first recalibration (#1227).
LOAN_AMOUNT = 50_000_000.0

# What each payment takes back, and how many there are.
LOAN_PAYMENT = 35_000_000.0
LOAN_PAYMENTS = 2

# What the loan costs over the session: the payments, less what it brought in.
LOAN_COST = LOAN_PAYMENT * LOAN_PAYMENTS - LOAN_AMOUNT


class Loan(BaseModel):
    """A player's loan: the Round they took it in, and how many payments they have made."""

    model_config = ConfigDict(frozen=True)

    round: int = Field(ge=1)
    payments_made: int = Field(default=0, ge=0, le=LOAN_PAYMENTS)


def payment_round(loan: Loan, index: int) -> int:
    """The Round whose start takes ``loan``'s payment ``index`` (counting from 0). A Round after the last means the
    payment is taken when the session ends.
    """
    return loan.round + 1 + index


def payments_due(loan: Loan, *, round_number: int) -> int:
    """How many of ``loan``'s payments not made yet are due by the start of Round ``round_number``."""
    due = sum(1 for index in range(LOAN_PAYMENTS) if payment_round(loan, index) <= round_number)
    return max(due - loan.payments_made, 0)
