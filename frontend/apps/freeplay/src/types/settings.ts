/**
 * Type definitions for user settings.
 *
 * These types correspond to backend schemas in energetica/schemas/settings.py
 */

import type { ApiRequestBody } from "@/types/api-helpers";

/**
 * User settings response from GET /api/v1/players/me/settings
 *
 * Contains user preferences like disclaimer visibility, notification settings,
 * etc.
 */
export interface UserSettings {
    show_disclaimer: boolean;
}

/**
 * Request body for PATCH /api/v1/players/me/settings
 *
 * Update one or more user settings. Only provided fields are updated.
 */
export type UpdateSettingsRequest = ApiRequestBody<
    "/api/v1/players/me/settings",
    "patch"
>;
