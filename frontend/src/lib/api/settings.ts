/** User settings API calls. */

import { apiClient } from "@/lib/api-client";
import type { UserSettings, UpdateSettingsRequest } from "@/types/settings";

export const settingsApi = {
    /** Get the current user's settings. */
    getSettings: () => apiClient.get<UserSettings>("/players/me/settings"),

    /** Update the current user's settings. */
    updateSettings: (data: UpdateSettingsRequest) =>
        apiClient.patch<void>("/players/me/settings", data),
};
