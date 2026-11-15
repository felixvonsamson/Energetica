/**
 * Turns API errors into messages a player can read.
 *
 * Each app passes its own table of messages, keyed by the `ErrorCode` values in
 * its own generated types. The table's type then requires a message for every
 * code that app's backend can return, and rejects codes it cannot. The lookup
 * itself is the same for every app, so it lives here.
 */

import { ApiClientError } from "#core/api-client";

const GENERIC_MESSAGE = "An unexpected error occurred. Please try again.";

/**
 * Pydantic's validation messages start with these, as in "String should have at
 * least 3 characters", so they are matched by prefix rather than by code.
 */
const VALIDATION_MESSAGES: Record<string, string> = {
    "Field required": "This field is required.",
    "String should have at least": "This field is too short.",
    "String should have at most": "This field is too long.",
};

export function createErrorMessages<Code extends string>(
    messages: Record<Code, string>,
) {
    /**
     * A readable message for any error: the app's message for a known error
     * code, otherwise the backend's own text, the error's message, or a generic
     * fallback.
     */
    function getUserFriendlyError(error: unknown): string {
        if (error instanceof ApiClientError) {
            const code = error.getErrorMessage();
            return (
                (messages as Record<string, string | undefined>)[code] ?? code
            );
        }
        if (error instanceof Error) return error.message;
        return GENERIC_MESSAGE;
    }

    /** Whether `error` is an API error with the given code. */
    function isErrorType(error: unknown, code: Code): boolean {
        return (
            error instanceof ApiClientError && error.getErrorMessage() === code
        );
    }

    /**
     * Like {@link getUserFriendlyError}, for the message of a failed game
     * action: a validation error is reworded by its prefix, and an API error
     * with no text gets a generic message.
     */
    function resolveErrorMessage(error: unknown): string {
        if (error instanceof ApiClientError) {
            const code = error.getErrorMessage();
            const message = (messages as Record<string, string | undefined>)[
                code
            ];
            if (message) return message;
            for (const [prefix, reworded] of Object.entries(
                VALIDATION_MESSAGES,
            )) {
                if (code.includes(prefix)) return reworded;
            }
            return code || "An error occurred. Please try again.";
        }
        if (error instanceof Error) return error.message;
        return GENERIC_MESSAGE;
    }

    return { getUserFriendlyError, isErrorType, resolveErrorMessage };
}

/**
 * The messages of the error codes every app's backend can return: the kernel's
 * shared codes. Each app builds its own table from these with
 * {@link errorMessageTable}.
 */
export const SHARED_ERROR_MESSAGES = {
    USER_NOT_FOUND: "Username does not exist.",
    NOT_AUTHENTICATED: "Please log in to continue.",
    INSTANCE_ACCESS_DENIED: "Your account is not allowed on this instance.",
    LOBBY_SERVICE_UNAVAILABLE:
        "Accounts are briefly unavailable. Please try again in a moment.",
    TEMPORARY_ACCOUNT_IN_FREEPLAY:
        "This account was made for one workshop, so it can't join this run. Create your own account to play.",
} as const satisfies Record<string, string>;

/**
 * An app's table of error messages: the tables it shares with other apps, such
 * as {@link SHARED_ERROR_MESSAGES}, joined with its own messages for the rest of
 * its codes. `Code` is the app's own `ErrorCode`.
 *
 * The type check fails unless the result covers exactly the app's codes: when a
 * shared table has a code the app cannot return, or when `own` misses a code or
 * has one the app cannot return.
 *
 * It is called twice, as in `errorMessageTable<ErrorCode>()(shared, own)`, so
 * that `Code` is given while the shared table's type is inferred.
 */
export function errorMessageTable<Code extends string>() {
    return <Shared extends Record<string, string>>(
        shared: Shared & Record<Exclude<keyof Shared, Code>, never>,
        own: Record<Exclude<Code, keyof Shared>, string>,
    ): Record<Code, string> => ({ ...shared, ...own }) as Record<Code, string>;
}
