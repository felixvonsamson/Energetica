/**
 * Centralised mapping of all game error codes and action messages.
 *
 * Error codes correspond to the values of the Python backend's error code
 * enums: the kernel's `SharedErrorCode` and each layer's and app's own (see
 * `docs/architecture/error-handling.md`). When a new code is added on the
 * backend, add a matching entry here so the frontend surfaces a readable
 * message.
 *
 * For each mutation that produces a toast, the success/error wording is also
 * defined here so all copy lives in one place.
 */

import { getAssetLongName } from "@/lib/assets/asset-names";
import type { ApiSchema } from "@/types/api-helpers";
import { ApiClientError, isGameError } from "@energetica/core/api-client";

export type ErrorCode = ApiSchema<"ErrorCode">;

// ---------------------------------------------------------------------------
// Error message map
// ---------------------------------------------------------------------------

/**
 * Maps every backend game-error code to a human-readable message shown in error
 * toasts and form error states.
 *
 * Keys are the exact string values of `ErrorCode` (plus a handful of plain HTTP
 * `detail` strings used before game errors were introduced).
 */
export const GAME_ERROR_MESSAGES: Record<ErrorCode, string> = {
    // --- Authentication ---
    USERNAME_TAKEN: "This username is already taken. Please choose another.",
    USER_NOT_FOUND: "Username does not exist.",
    INVALID_PASSWORD: "Incorrect password. Please try again.",
    NOT_AUTHENTICATED: "Please log in to continue.",
    USER_IS_NOT_A_PLAYER: "Access denied. Player account required.",
    ACCOUNT_IS_NOT_A_FACILITATOR:
        "Access denied. Facilitator account required.",
    PLAYER_NOT_SET_UP: "Please complete your account setup.",
    SIGNUP_DISABLED: "Sign-ups are currently disabled.",
    OLD_PASSWORD_INCORRECT: "The current password you entered is incorrect.",
    INSTANCE_ACCESS_DENIED: "Your account is not allowed on this instance.",
    INSTANCE_NOT_PRIVATE:
        "This instance is not configured as private, so it has no join link.",
    JOIN_LINK_INVALID:
        "This join link isn't valid. Ask the organizer for a new one.",
    JOIN_LINK_CLOSED: "This join link isn't accepting new members right now.",
    RUN_NOT_FOUND: "This run doesn't exist.",

    // --- Workshop ---
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
    WORKSHOP_INVALID_FUEL_QUANTITY: "Enter a quantity of fuel of 0 or more.",
    WORKSHOP_NO_PERIOD_RECORD: "This Trading period has no record to review.",
    WORKSHOP_NO_MARKET_PRICES: "This Trading period has not started yet.",
    WORKSHOP_NO_SUCH_WEEK: "This Trading period did not simulate that week.",
    WORKSHOP_NO_SUCH_POINT: "This Trading period has no such settlement point.",
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

    // --- Lifecycle ---
    // 409 backstop when a write reaches a frozen instance (#861). Normally unseen: the client
    // derives its phase locally and stops firing game actions before this fires. The in-game
    // read-only banner/disabled-controls UI lives in T8 (#866).
    "Instance is frozen; the game is read-only.":
        "This game has ended — it's now read-only.",

    // --- Location / tile ---
    locationOccupied: "This location is already occupied by another player.",
    choiceUnmodifiable: "Your location choice cannot be changed.",
    "Player has no tile": "You need to choose a location first.",
    noLocation: "Please select a valid location.",
    TileNotFound: "Location not found.",
    noTile: "No location tile found.",

    // --- Financial ---
    "Not enough money": "You don't have enough money for this action.",

    // --- Projects ---
    "Project not found": "The project could not be found.",
    "Requirements not satisfied":
        "You don't meet the requirements for this project.",
    HasDependents:
        "This project cannot be cancelled — other queued projects depend on it.",
    cannotPause: "This project cannot be paused right now.",
    cannotResume: "This project cannot be resumed right now.",
    PausedPrerequisitePreventUnpause:
        "A prerequisite project is paused. Resume it before unpausing this one.",
    CannotDecreasePriorityOfLastProject:
        "This project is already at the lowest priority.",
    CannotIncreasePriorityOfFirstProject:
        "This project is already at the highest priority.",
    requirementsPreventReorder:
        "This project cannot be reordered because of dependencies. Note that all dependencies need to be finished before the project can be started.",
    CannotSwapPausedProject: "Paused projects cannot be reordered.",

    // --- Facilities ---
    "Facility not upgradable": "This facility cannot be upgraded further.",
    FacilityIsDecommissioning:
        "This facility is already scheduled for decommissioning.",
    "Facility not found": "The facility could not be found.",
    "Cannot remove technologies or functional facilities":
        "Technologies and functional facilities cannot be removed directly.",

    // --- Electricity markets / network ---
    networkNotUnlocked:
        "Unlock the Network achievement to access electricity markets.",
    playerAlreadyInNetwork: "You are already a member of this market.",
    nameAlreadyUsed: "This market name is already in use.",
    notInNetwork: "You are not a member of this market.",
    noSuchNetwork: "This electricity market does not exist.",
    networkFull: "This market has reached its maximum number of members.",
    malformedRequest: "Invalid request. Please check your input.",
    storagePriceInversion:
        "Invalid order: a storage facility's discharge price must be higher than its charge price.",

    // --- Resource market ---
    notEnoughResource: "You don't have enough of this resource.",
    invalidQuantity: "Please enter a valid quantity.",

    // --- Chat ---
    wrongTitleLength: "Chat title must be between 1 and 50 characters.",
    chatAlreadyExist: "A chat with these members already exists.",
    notInChat: "You are not a member of this chat.",
    noMessage: "Please type a message before sending.",
    messageTooLong: "Message is too long. Maximum 500 characters.",

    // --- Daily quiz ---
    quizAlreadyAnswered: "You have already answered today's quiz.",

    InvalidMultiplier: "Invalid value provided.",
};

// TODO: these should probably live elsewhere

// ---------------------------------------------------------------------------
// Pydantic validation message prefixes (partial-match, not game error codes)
// ---------------------------------------------------------------------------

// Pydantic validation errors contain the message as a prefix (e.g. "String
// should have at least 3 characters"), so we match by prefix rather than
// exact code. These are framework-level errors, not ErrorCode values.
const PYDANTIC_VALIDATION_MESSAGES: Record<string, string> = {
    "Field required": "This field is required.",
    "String should have at least": "This field is too short.",
    "String should have at most": "This field is too long.",
};

// ---------------------------------------------------------------------------
// Generic error resolver
// ---------------------------------------------------------------------------

/**
 * Resolve any unknown error to a human-readable string using
 * `GAME_ERROR_MESSAGES`. Falls back to partial-match and then the raw backend
 * message.
 */
export function resolveErrorMessage(error: unknown): string {
    if (error instanceof ApiClientError) {
        const code = error.getErrorMessage();
        const gameMessage = (GAME_ERROR_MESSAGES as Record<string, string>)[
            code
        ];
        if (gameMessage) return gameMessage;
        for (const [prefix, message] of Object.entries(
            PYDANTIC_VALIDATION_MESSAGES,
        )) {
            if (code.includes(prefix)) return message;
        }
        return code || "An error occurred. Please try again.";
    }
    if (error instanceof Error) return error.message;
    return "An unexpected error occurred. Please try again.";
}

// ---------------------------------------------------------------------------
// Specialised error formatters
// ---------------------------------------------------------------------------

/**
 * Format a cancel-project error.
 *
 * When the error is `HasDependents`, lists the dependent projects by name so
 * the player knows which projects must be removed first.
 */
export function formatCancelProjectError(error: unknown): string {
    if (error instanceof ApiClientError && isGameError(error.detail)) {
        if (error.detail.game_exception_type === "HasDependents") {
            const dependents = error.detail.kwargs?.dependents as
                | [string, number][]
                | undefined;
            if (dependents && dependents.length > 0) {
                const names = dependents
                    .map(
                        ([type, level]) =>
                            `${getAssetLongName(type)} (Level ${level})`,
                    )
                    .join(", ");
                const verb = dependents.length === 1 ? "depends" : "depend";
                return `Cannot cancel: ${names} ${verb} on this project.`;
            }
        }
    }
    return resolveErrorMessage(error);
}

/**
 * Format a refused change to a Workshop Round's levers (#1018). A change that
 * would leave a Round invalid names that Round, which may be a later one the
 * change carries to.
 */
export function formatLeverChangeError(error: unknown): string {
    if (
        error instanceof ApiClientError &&
        isGameError(error.detail) &&
        error.detail.game_exception_type === "WORKSHOP_LEVERS_INVALID" &&
        typeof error.detail.kwargs?.round === "number"
    ) {
        return GAME_ERROR_MESSAGES.WORKSHOP_LEVERS_INVALID.replace(
            "a Round",
            `Round ${error.detail.kwargs.round}`,
        );
    }
    return resolveErrorMessage(error);
}
