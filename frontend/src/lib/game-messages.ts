/**
 * Centralised mapping of all game error codes and action messages.
 *
 * Error codes correspond to `GameExceptionType` values from the Python backend
 * (`energetica/game_error.py`). When a new `GameExceptionType` is added on the
 * backend, add a matching entry here so the frontend surfaces a readable
 * message.
 *
 * For each mutation that produces a toast, the success/error wording is also
 * defined here so all copy lives in one place.
 */

import { ApiClientError, isGameError } from "@/lib/api-client";
import { getAssetLongName } from "@/lib/assets/asset-names";

// ---------------------------------------------------------------------------
// Error message map
// ---------------------------------------------------------------------------

/**
 * Maps every backend game-error code to a human-readable message shown in
 * error toasts and form error states.
 *
 * Keys are the exact string values of `GameExceptionType` (plus a handful of
 * plain HTTP `detail` strings used before game errors were introduced).
 */
export const GAME_ERROR_MESSAGES: Record<string, string> = {
    // --- Authentication ---
    "username is taken":
        "This username is already taken. Please choose another.",
    "User not found": "Username does not exist.",
    "Invalid password": "Invalid password. Please try again.",
    "Not authenticated": "Please log in to continue.",
    "User is not a player": "Access denied. Player account required.",
    "Player not set up": "Please complete your account setup.",
    "Sign-ups are disabled.": "Sign-ups are currently disabled.",
    "Old password is incorrect.":
        "The current password you entered is incorrect.",

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
        "This project cannot be reordered because of dependencies.",
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
    malformedRequest: "Invalid request. Please check your input.",

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

    // --- Validation ---
    "Field required": "This field is required.",
    "String should have at least": "This field is too short.",
    "String should have at most": "This field is too long.",
    InvalidMultiplier: "Invalid value provided.",
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
        if (GAME_ERROR_MESSAGES[code]) return GAME_ERROR_MESSAGES[code];
        // Partial match (e.g. validation messages that include a prefix)
        for (const [key, value] of Object.entries(GAME_ERROR_MESSAGES)) {
            if (code.includes(key)) return value;
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
