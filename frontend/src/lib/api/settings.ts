/** User settings API calls. */

import type { UserSettings, UpdateSettingsRequest } from "@/types/settings";
import { apiClient } from "@energetica/core/api-client";

export const settingsApi = {
    /** Get the current user's settings. */
    getSettings: () => apiClient.get<UserSettings>("/players/me/settings"),

    /** Update the current user's settings. */
    updateSettings: (data: UpdateSettingsRequest) =>
        apiClient.patch<void>("/players/me/settings", data),
};
