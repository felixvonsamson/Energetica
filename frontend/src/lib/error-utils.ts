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

import { ApiClientError } from "@/lib/api-client";

/**
 * Maps backend error messages to user-friendly messages.
 *
 * This centralizes all error message translations in one place, making it
 * easier to maintain consistency and update messages across the app.
 *
 * Add new mappings here as you encounter new backend error messages.
 */
const ERROR_MESSAGES: Record<string, string> = {
    // Authentication errors
    "username is taken":
        "This username is already taken. Please choose another.",
    "User not found": "Username does not exist.",
    "Invalid password": "Invalid password. Please try again.",
    "Not authenticated": "Please log in to continue.",
    "User is not a player": "Access denied. Player account required.",
    "Player not set up": "Please complete your account setup.",

    // Sign-up errors
    "Sign-ups are disabled.": "Sign-ups are currently disabled.",

    // Location/settlement errors
    locationOccupied: "This location is already occupied by another player.",
    choiceUnmodifiable: "Your location choice cannot be changed.",
    "Player has no tile": "You need to choose a location first.",
    noLocation: "Please select a valid location.",

    // Financial errors
    "Not enough money": "You don't have enough money for this action.",

    // Network errors
    networkNotUnlocked: "This network is not yet unlocked.",
    playerAlreadyInNetwork: "You are already in this network.",
    nameAlreadyUsed: "This name is already in use.",
    notInNetwork: "You are not a member of this network.",

    // Project errors
    "Project not found": "The requested project could not be found.",
    "Requirements not satisfied":
        "You don't meet the requirements for this action.",
    HasDependents: "This project has dependencies that must be removed first.",

    // Facility errors
    "Facility not found": "The requested facility could not be found.",
    "Facility not upgradable": "This facility cannot be upgraded.",
    FacilityIsDecommissioning:
        "This facility is currently being decommissioned.",
    "Cannot remove technologies or functional facilities":
        "Cannot remove technologies or functional facilities.",

    // Resource market errors
    notEnoughResource: "You don't have enough of this resource.",
    invalidQuantity: "Please enter a valid quantity.",

    // Chat errors
    wrongTitleLength: "Chat title must be between 1 and 50 characters.",
    chatAlreadyExist: "A chat with this configuration already exists.",
    notInChat: "You are not a member of this chat.",
    noMessage: "Please enter a message.",
    messageTooLong: "Message is too long. Maximum 500 characters.",

    // Validation errors
    "Field required": "This field is required.",
    "String should have at least": "This field is too short.",
    "String should have at most": "This field is too long.",
};

/**
 * Get a user-friendly error message from any error object.
 *
 * This function handles different error types and formats:
 *
 * - ApiClientError with various backend response formats
 * - Standard JavaScript Error objects
 * - Unknown error types
 *
 * @example
 *     ```typescript
 *     catch (error) {
 *       const message = getUserFriendlyError(error);
 *       setError(message);
 *     }
 *     ```;
 *
 * @param error - The error object to process
 * @returns A user-friendly error message string
 */
export function getUserFriendlyError(error: unknown): string {
    if (error instanceof ApiClientError) {
        const errorMsg = error.getErrorMessage();

        // Check if we have a mapped user-friendly message
        if (ERROR_MESSAGES[errorMsg]) {
            return ERROR_MESSAGES[errorMsg];
        }

        // Check for partial matches (e.g., validation errors)
        for (const [key, value] of Object.entries(ERROR_MESSAGES)) {
            if (errorMsg.includes(key)) {
                return value;
            }
        }

        // Return the backend message if no mapping exists
        return errorMsg || "An error occurred. Please try again.";
    }

    if (error instanceof Error) {
        return error.message;
    }

    return "An unexpected error occurred. Please try again.";
}

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
 * Check if an error is a specific API error type.
 *
 * Useful for handling specific error cases differently.
 *
 * @example
 *     ```typescript
 *     if (isErrorType(error, 'username is taken')) {
 *       // Show username suggestion UI
 *     }
 *     ```;
 *
 * @param error - The error to check
 * @param errorType - The error type to check for (from backend)
 * @returns True if the error matches the specified type
 */
export function isErrorType(error: unknown, errorType: string): boolean {
    if (error instanceof ApiClientError) {
        const errorMsg = error.getErrorMessage();
        return errorMsg === errorType || errorMsg.includes(errorType);
    }
    return false;
}

/**
 * Check if an error is an authentication error.
 *
 * @example
 *     ```typescript
 *     if (isAuthError(error)) {
 *       navigate({ to: '/login' });
 *     }
 *     ```;
 *
 * @param error - The error to check
 * @returns True if the error is authentication-related
 */
export function isAuthError(error: unknown): boolean {
    if (error instanceof ApiClientError) {
        return (
            error.status === 401 ||
            isErrorType(error, "Not authenticated") ||
            isErrorType(error, "User not found") ||
            isErrorType(error, "Invalid password")
        );
    }
    return false;
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
            errors[field] = err.msg;
        }
        return errors;
    }
    return null;
}
