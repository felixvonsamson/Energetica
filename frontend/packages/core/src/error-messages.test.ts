import { describe, expect, it } from "vitest";

import { ApiClientError } from "#core/api-client";
import { createErrorMessages } from "#core/error-messages";

const { getUserFriendlyError, isErrorType } = createErrorMessages({
    USERNAME_TAKEN: "This username is already taken.",
    NOT_AUTHENTICATED: "Please log in to continue.",
});

const gameError = (code: string) =>
    new ApiClientError(code, 400, { game_exception_type: code });

describe("getUserFriendlyError", () => {
    it("shows the app's message for a known error code", () => {
        expect(getUserFriendlyError(gameError("USERNAME_TAKEN"))).toBe(
            "This username is already taken.",
        );
    });

    it("shows the backend's text for a code the app has no message for", () => {
        expect(getUserFriendlyError(gameError("SOMETHING_NEW"))).toBe(
            "SOMETHING_NEW",
        );
    });

    it("shows a plain HTTP error's detail", () => {
        const error = new ApiClientError("Bad", 500, {
            detail: "Upstream down",
        });

        expect(getUserFriendlyError(error)).toBe("Upstream down");
    });

    it("shows the message of an error that is not from the API", () => {
        expect(getUserFriendlyError(new Error("offline"))).toBe("offline");
    });

    it("falls back to a generic message for anything else", () => {
        expect(getUserFriendlyError("boom")).toBe(
            "An unexpected error occurred. Please try again.",
        );
    });
});

describe("isErrorType", () => {
    it("matches an API error with that code", () => {
        expect(isErrorType(gameError("USERNAME_TAKEN"), "USERNAME_TAKEN")).toBe(
            true,
        );
    });

    it("does not match an API error with another code", () => {
        expect(
            isErrorType(gameError("NOT_AUTHENTICATED"), "USERNAME_TAKEN"),
        ).toBe(false);
    });

    it("does not match an error that is not from the API", () => {
        expect(isErrorType(new Error("USERNAME_TAKEN"), "USERNAME_TAKEN")).toBe(
            false,
        );
    });
});
