/**
 * Hooks for fetching and managing user settings.
 *
 * User settings include preferences like disclaimer visibility, notification
 * settings, and other user preferences.
 */

import { useQuery, useMutation } from "@tanstack/react-query";
import { settingsApi } from "@/lib/settings-api";
import { queryKeys, queryClient } from "@/lib/query-client";

/**
 * Get the current user's settings.
 *
 * Settings are cached for 10 minutes since they don't change frequently. A user
 * typically only updates settings occasionally.
 *
 * @example
 *     const { data: settings } = useSettings();
 *     if (settings?.show_disclaimer) {
 *     return <DisclaimerModal />;
 *     }
 *
 * @returns Query result with current user settings
 */
export function useSettings() {
    return useQuery({
        queryKey: queryKeys.players.settings,
        queryFn: settingsApi.getSettings,
        staleTime: 10 * 60 * 1000, // 10 minutes - settings don't change often
        gcTime: 15 * 60 * 1000,
        refetchOnWindowFocus: false,
    });
}

/**
 * Update the current user's settings.
 *
 * Only provided fields are updated on the server; other settings remain
 * unchanged. Automatically invalidates the settings cache to fetch updated
 * values.
 *
 * @example
 *     const { mutate: updateSettings } = useUpdateSettings();
 *     updateSettings({ show_disclaimer: false });
 *
 * @returns Mutation hook for updating settings
 */
export function useUpdateSettings() {
    return useMutation({
        mutationFn: settingsApi.updateSettings,
        onSuccess: () => {
            // Invalidate settings cache to refetch updated values
            queryClient.invalidateQueries({
                queryKey: queryKeys.players.settings,
            });
        },
    });
}
