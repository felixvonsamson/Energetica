/**
 * Readable messages for the errors the Workshop's backend can return.
 *
 * The table is keyed by the Workshop's own `ErrorCode`, so the type check fails
 * if the backend gains a code with no message here, or loses one that still has
 * a message. The messages of the codes shared with other apps are defined once,
 * in `@energetica/core/error-messages` and `@energetica/instance`, and so is
 * the lookup.
 */

import { ApiClientError, isGameError } from "@energetica/core/api-client";
import {
    createErrorMessages,
    errorMessageTable,
    SHARED_ERROR_MESSAGES,
} from "@energetica/core/error-messages";
import { IDENTITY_ERROR_MESSAGES } from "@energetica/instance/lib/error-messages";

import type { ApiSchema } from "@/types/api-helpers";

type ErrorCode = ApiSchema<"ErrorCode">;

export const ERROR_MESSAGES = errorMessageTable<ErrorCode>()(
    { ...SHARED_ERROR_MESSAGES, ...IDENTITY_ERROR_MESSAGES },
    {
        WORKSHOP_SESSION_FINISHED:
            "The session is over, so there is nothing left to advance to.",
        WORKSHOP_NO_PHASE_RUNNING:
            "No phase is running, so there is no time to extend.",
        WORKSHOP_INVESTMENT_CLOSED: "Wait for the next investment phase.",
        WORKSHOP_FACILITY_NOT_OFFERED: "This facility isn't available yet.",
        WORKSHOP_NOT_ENOUGH_MONEY:
            "You don't have enough money to add this to your selection.",
        WORKSHOP_FACILITY_LIMIT_REACHED:
            "You already have as many of these as you can own at once.",
        WORKSHOP_NOT_SELECTED: "This facility isn't in your selection.",
        WORKSHOP_PRICE_SETTING_CLOSED:
            "Prices are locked. Wait for the next Trading period.",
        WORKSHOP_PRICE_BELOW_FLOOR: "This price is below the price floor.",
        WORKSHOP_PRICE_ABOVE_CEILING: "This price is above the price ceiling.",
        WORKSHOP_NOT_STORAGE: "Only storage has a buy price.",
        WORKSHOP_FUEL_NOT_MANUAL: "Fuel is bought for you this season.",
        WORKSHOP_FUEL_NOT_BURNED: "None of your facilities burn this fuel.",
        WORKSHOP_SETTLEMENT_RUNNING:
            "The Trading period is still being simulated. Advance once it has finished.",
        WORKSHOP_ROUND_LOCKED:
            "This Round's plan is locked: players have been told what it holds.",
        WORKSHOP_LEVERS_INVALID:
            "This change would leave a Round invalid: every storage type needs the full-season format.",
        WORKSHOP_NO_EVENTS_IN_ROUND_ONE: "Round 1 holds no events.",
        WORKSHOP_RECAP_NOT_OPEN: "This Round's Recap has not opened yet.",
        WORKSHOP_NO_VOTE: "This Round holds no vote.",
        WORKSHOP_NO_VOTE_IN_ROUND_ONE:
            "Round 1 holds no vote: no Recap comes before it to announce one.",
        WORKSHOP_CARBON_TAX_PASSED:
            "A carbon tax has already passed, so it cannot be put to a vote again.",
        WORKSHOP_NO_SUCH_ROUND: "The session has no such Round.",
        WORKSHOP_INVALID_PICK:
            "This event can't be planned like this: check its severity, season and fuel.",
        WORKSHOP_INVALID_FUEL_QUANTITY:
            "Enter a quantity of fuel of 0 or more.",
        WORKSHOP_NO_PERIOD_RECORD:
            "This Trading period has no record to review.",
        WORKSHOP_NO_MARKET_PRICES: "This Trading period has not started yet.",
        WORKSHOP_NO_SUCH_DAYS:
            "This Trading period did not simulate those days.",
        WORKSHOP_NO_SUCH_POINT:
            "This Trading period has no such settlement point.",
        WORKSHOP_GRID_DOWN:
            "The grid was down at this point, so the market did not clear.",
        WORKSHOP_LOAN_LAST_ROUND:
            "The loan can't be taken in the last Round: no Round is left to pay it back.",
        WORKSHOP_LOAN_TAKEN: "You have already taken the loan.",
        WORKSHOP_NO_LOAN: "You haven't taken the loan.",
        WORKSHOP_LOAN_FINAL:
            "The loan is final once the Investment phase it was taken in has closed.",
        WORKSHOP_LOAN_NEEDED:
            "The loan can't be cancelled: your selection needs it. Remove facilities from your selection first.",
        WORKSHOP_LAST_RECAP_OPEN:
            "No Round can be added: the last Recap has opened and shown the final scores.",
        WORKSHOP_NOT_ON_A_TEAM:
            "This workshop plays in teams, and your account is not on any team. Ask the facilitator to check the team list.",
        WORKSHOP_NO_SUCH_TEAM:
            "This workshop has no team by that name. Reload the page to see its teams.",
        WORKSHOP_FEEDBACK_NOT_OPEN:
            "Feedback opens once the game is over and the final scores are up.",
    },
);

/**
 * `getUserFriendlyError(error)` gives a readable message for any error, and
 * `resolveErrorMessage(error)` does the same for a failed action, rewording a
 * validation error. `isErrorType(error, code)` checks whether an error is an
 * API error with that code. See `@energetica/core/error-messages`.
 */
export const { getUserFriendlyError, isErrorType, resolveErrorMessage } =
    createErrorMessages(ERROR_MESSAGES);

/**
 * Format a refused change to a Round's levers (#1018). A change that would
 * leave a Round invalid names that Round, which may be a later one the change
 * carries to.
 */
export function formatLeverChangeError(error: unknown): string {
    if (
        error instanceof ApiClientError &&
        isGameError(error.detail) &&
        error.detail.game_exception_type === "WORKSHOP_LEVERS_INVALID" &&
        typeof error.detail.kwargs?.round === "number"
    ) {
        return ERROR_MESSAGES.WORKSHOP_LEVERS_INVALID.replace(
            "a Round",
            `Round ${error.detail.kwargs.round}`,
        );
    }
    return resolveErrorMessage(error);
}
