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

    return { getUserFriendlyError, isErrorType };
}
