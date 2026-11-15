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

import { ApiClientError, isGameError } from "@energetica/core/api-client";
import {
    createErrorMessages,
    errorMessageTable,
    SHARED_ERROR_MESSAGES,
} from "@energetica/core/error-messages";
import { IDENTITY_ERROR_MESSAGES } from "@energetica/instance/lib/error-messages";
import { toast } from "sonner";

import { getAssetLongName } from "@/lib/assets/asset-names";
import { isInstanceFrozenError } from "@/lib/lifecycle";
import type { ApiSchema } from "@/types/api-helpers";

/** The codes the persistent world's backend can return. */
export type ErrorCode = ApiSchema<"ErrorCode">;

// ---------------------------------------------------------------------------
// Error message map
// ---------------------------------------------------------------------------

/**
 * Maps every backend game-error code to a human-readable message shown in error
 * toasts and form error states.
 *
 * Keys are the exact string values of `ErrorCode` (plus a handful of plain HTTP
 * `detail` strings used before game errors were introduced). The messages of
 * the codes shared with other apps are defined once, in
 * `@energetica/core/error-messages` and `@energetica/instance`.
 */
export const GAME_ERROR_MESSAGES = errorMessageTable<ErrorCode>()(
    { ...SHARED_ERROR_MESSAGES, ...IDENTITY_ERROR_MESSAGES },
    {
        PLAYER_NOT_SET_UP: "Please complete your account setup.",

        // --- Lifecycle ---
        // 409 backstop when a write reaches a frozen instance (#861). Normally unseen: the client
        // derives its phase locally and stops firing game actions before this fires. The in-game
        // read-only banner/disabled-controls UI lives in T8 (#866).
        "Instance is frozen; the game is read-only.":
            "This game has ended — it's now read-only.",

        // --- Location / tile ---
        locationOccupied:
            "This location is already occupied by another player.",
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
    },
);

/**
 * The helpers for `GAME_ERROR_MESSAGES`, re-exported by `lib/error-utils.ts`
 * where most callers look for them. `resolveErrorMessage(error)` resolves any
 * unknown error to a readable string, rewording a validation error, then
 * falling back to the raw backend message. See
 * `@energetica/core/error-messages`.
 */
export const { getUserFriendlyError, isErrorType, resolveErrorMessage } =
    createErrorMessages(GAME_ERROR_MESSAGES);

/**
 * Toast a failed game action, except the backend's frozen-instance `409`
 * (#866). That one is not the player's mistake: the query client's mutation
 * error handler re-reads the engine config, and the game turns read-only in
 * place instead.
 */
export function toastActionError(
    error: unknown,
    format: (error: unknown) => string = resolveErrorMessage,
): void {
    if (isInstanceFrozenError(error)) return;
    toast.error(format(error));
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
