/**
 * Readable messages for the errors the lobby backend can return.
 *
 * The table is keyed by the lobby's own `ErrorCode`, so the type check fails if
 * the lobby backend gains a code with no message here. The lookup itself is
 * shared by every app; see `@energetica/core/error-messages`.
 */

import { createErrorMessages } from "@energetica/core/error-messages";

import type { ApiSchema } from "@/types/api-helpers";

type ErrorCode = ApiSchema<"ErrorCode">;

const LOBBY_ERROR_MESSAGES: Record<ErrorCode, string> = {
    USERNAME_TAKEN: "This username is already taken. Please choose another.",
    USER_NOT_FOUND: "Username does not exist.",
    INVALID_PASSWORD: "Incorrect password. Please try again.",
    NOT_AUTHENTICATED: "Please log in to continue.",
    SIGNUP_DISABLED: "Sign-ups are currently disabled.",
    OLD_PASSWORD_INCORRECT: "The current password you entered is incorrect.",
    INSTANCE_ACCESS_DENIED: "Your account is not allowed on this instance.",
    LOBBY_SERVICE_UNAVAILABLE:
        "Accounts are briefly unavailable. Please try again in a moment.",
    TEMPORARY_ACCOUNT_IN_FREEPLAY:
        "This account was made for one workshop, so it can't join this run. Create your own account to play.",
    RUN_NOT_FOUND: "This run doesn't exist.",
};

export const { getUserFriendlyError, isErrorType } =
    createErrorMessages(LOBBY_ERROR_MESSAGES);
