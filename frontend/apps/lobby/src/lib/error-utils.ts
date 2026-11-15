/**
 * Readable messages for the errors the lobby backend can return.
 *
 * The table is keyed by the lobby's own `ErrorCode`, so the type check fails if
 * the lobby backend gains a code with no message here. The messages of the
 * codes every app shares are defined once, in
 * `@energetica/core/error-messages`, and so is the lookup.
 */

import {
    createErrorMessages,
    errorMessageTable,
    SHARED_ERROR_MESSAGES,
} from "@energetica/core/error-messages";

import type { ApiSchema } from "@/types/api-helpers";

type ErrorCode = ApiSchema<"ErrorCode">;

const LOBBY_ERROR_MESSAGES = errorMessageTable<ErrorCode>()(
    SHARED_ERROR_MESSAGES,
    {
        USERNAME_TAKEN:
            "This username is already taken. Please choose another.",
        INVALID_PASSWORD: "Incorrect password. Please try again.",
        SIGNUP_DISABLED: "Sign-ups are currently disabled.",
        OLD_PASSWORD_INCORRECT:
            "The current password you entered is incorrect.",
        RUN_NOT_FOUND: "This run doesn't exist.",
    },
);

export const { getUserFriendlyError, isErrorType } =
    createErrorMessages(LOBBY_ERROR_MESSAGES);
