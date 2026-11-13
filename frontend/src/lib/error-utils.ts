/**
 * Centralized error handling utilities for the frontend.
 *
 * This module provides:
 *
 * - User-friendly error message mapping
 * - Error logging and monitoring
 * - Type-safe error handling helpers
 * - Utilities for common error scenarios
 *
 * @example
 *     ```typescript
 *     import { getUserFriendlyError, handleApiError } from '@/lib/error-utils';
 *
 *     try {
 *       await apiClient.post('/endpoint', data);
 *     } catch (error) {
 *       const message = getUserFriendlyError(error);
 *       setError(message);
 *     }
 *     ```;
 */

import { GAME_ERROR_MESSAGES } from "@/lib/game-messages";
import { ApiClientError } from "@energetica/core/api-client";
import { createErrorMessages } from "@energetica/core/error-messages";

/**
 * `getUserFriendlyError(error)` gives a readable message for any error, using
 * `GAME_ERROR_MESSAGES` for known error codes. `isErrorType(error, code)`
 * checks whether an error is an API error with that code. See
 * `@energetica/core/error-messages`.
 */
export const { getUserFriendlyError, isErrorType } =
    createErrorMessages(GAME_ERROR_MESSAGES);

/**
 * Handle API errors with logging and user-friendly messaging.
 *
 * This function:
 *
 * - Converts errors to user-friendly messages
 * - Logs errors to the console (and could log to external services)
 * - Returns a fallback message if provided
 *
 * Use this in catch blocks or error callbacks where you need both logging and
 * user-friendly error messages.
 *
 * @example
 *     ```typescript
 *     catch (error) {
 *       const message = handleApiError(error, 'Failed to load data');
 *       toast.error(message);
 *     }
 *     ```;
 *
 * @param error - The error object to handle
 * @param fallback - Optional fallback message if error cannot be parsed
 * @returns A user-friendly error message string
 */
export function handleApiError(error: unknown, fallback?: string): string {
    const message = getUserFriendlyError(error);

    // Log error for debugging and monitoring
    console.error("API Error:", {
        error,
        userMessage: message,
        timestamp: new Date().toISOString(),
    });

    // TODO: Add external error logging service (e.g., Sentry)
    // if (import.meta.env.PROD) {
    //   Sentry.captureException(error, {
    //     extra: { userMessage: message },
    //   });
    // }

    return message || fallback || "An error occurred. Please try again.";
}

/**
 * Check if an error is a validation error.
 *
 * @example
 *     ```typescript
 *     if (isValidationError(error)) {
 *       // Highlight form fields
 *     }
 *     ```;
 *
 * @param error - The error to check
 * @returns True if the error is a validation error
 */
export function isValidationErrorType(error: unknown): boolean {
    if (error instanceof ApiClientError) {
        return error.status === 422;
    }
    return false;
}

/**
 * Extract validation field errors from a validation error.
 *
 * @example
 *     ```typescript
 *     const fieldErrors = getValidationFieldErrors(error);
 *     if (fieldErrors) {
 *       setFieldError('username', fieldErrors.username);
 *     }
 *     ```;
 *
 * @param error - The error to extract fields from
 * @returns Record of field names to error messages, or null if not a validation
 *   error
 */
export function getValidationFieldErrors(
    error: unknown,
): Record<string, string> | null {
    if (
        error instanceof ApiClientError &&
        error.detail &&
        "detail" in error.detail &&
        Array.isArray(error.detail.detail)
    ) {
        const errors: Record<string, string> = {};
        for (const err of error.detail.detail) {
            const field = err.loc[err.loc.length - 1];
            if (field !== undefined) {
                errors[field] = err.msg;
            }
        }
        return errors;
    }
    return null;
}
