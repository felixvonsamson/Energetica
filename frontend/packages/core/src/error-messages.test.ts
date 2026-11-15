import { describe, expect, it } from "vitest";

import { ApiClientError } from "#core/api-client";
import { createErrorMessages, errorMessageTable } from "#core/error-messages";

const { getUserFriendlyError, isErrorType, resolveErrorMessage } =
    createErrorMessages({
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

describe("resolveErrorMessage", () => {
    it("shows the app's message for a known error code", () => {
        expect(resolveErrorMessage(gameError("USERNAME_TAKEN"))).toBe(
            "This username is already taken.",
        );
    });

    it("rewords a validation error by its prefix", () => {
        const error = new ApiClientError("Unprocessable", 422, {
            detail: "String should have at least 3 characters",
        });

        expect(resolveErrorMessage(error)).toBe("This field is too short.");
    });

    it("shows the backend's text for a code the app has no message for", () => {
        expect(resolveErrorMessage(gameError("SOMETHING_NEW"))).toBe(
            "SOMETHING_NEW",
        );
    });

    it("falls back to a generic message for an API error with no text", () => {
        expect(
            resolveErrorMessage(new ApiClientError("", 500, { detail: "" })),
        ).toBe("An error occurred. Please try again.");
    });

    it("shows the message of an error that is not from the API", () => {
        expect(resolveErrorMessage(new Error("offline"))).toBe("offline");
    });
});

describe("errorMessageTable", () => {
    type Code = "NOT_AUTHENTICATED" | "JOIN_LINK_INVALID" | "WORKSHOP_NO_VOTE";
    const shared = { NOT_AUTHENTICATED: "Please log in to continue." };

    it("joins the shared messages and the app's own", () => {
        expect(
            errorMessageTable<Code>()(shared, {
                JOIN_LINK_INVALID: "This join link isn't valid.",
                WORKSHOP_NO_VOTE: "This Round holds no vote.",
            }),
        ).toEqual({
            NOT_AUTHENTICATED: "Please log in to continue.",
            JOIN_LINK_INVALID: "This join link isn't valid.",
            WORKSHOP_NO_VOTE: "This Round holds no vote.",
        });
    });

    // The checks below are made by the type checker, which reads this file too.
    it("rejects tables that do not cover exactly the app's codes", () => {
        const table = errorMessageTable<Code>();
        // @ts-expect-error The app's own messages miss WORKSHOP_NO_VOTE.
        table(shared, { JOIN_LINK_INVALID: "Invalid." });
        table(shared, {
            JOIN_LINK_INVALID: "Invalid.",
            WORKSHOP_NO_VOTE: "No vote.",
            // @ts-expect-error The app cannot return USERNAME_TAKEN.
            USERNAME_TAKEN: "Taken.",
        });
        const sharedWithAnotherAppsCode = {
            ...shared,
            USERNAME_TAKEN: "Taken.",
        };
        table(
            // @ts-expect-error A shared table has a code the app cannot return.
            sharedWithAnotherAppsCode,
            { JOIN_LINK_INVALID: "Invalid.", WORKSHOP_NO_VOTE: "No vote." },
        );
    });
});
