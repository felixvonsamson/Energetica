/**
 * The messages of the error codes the identity layer's routes can return: the
 * join and facilitator routes, which both Instance apps serve. Each Instance
 * app builds its own table from these and `SHARED_ERROR_MESSAGES` with
 * `errorMessageTable` from `@energetica/core/error-messages`.
 */
export const IDENTITY_ERROR_MESSAGES = {
    USER_IS_NOT_A_PLAYER: "Access denied. Player account required.",
    ACCOUNT_IS_NOT_A_FACILITATOR:
        "Access denied. Facilitator account required.",
    INSTANCE_NOT_PRIVATE:
        "This instance is not configured as private, so it has no join link.",
    JOIN_LINK_INVALID:
        "This join link isn't valid. Ask the organizer for a new one.",
    JOIN_LINK_CLOSED: "This join link isn't accepting new members right now.",
} as const satisfies Record<string, string>;
