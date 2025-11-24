/**
 * Hooks for fetching and managing user settings.
 */

import { useQuery, useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys, queryClient } from "@/lib/query-client";
import type { ApiResponse, ApiRequestBody } from "@/types/api-helpers";

/**
 * Get the current user's settings.
 */
export function useSettings() {
    return useQuery({
        queryKey: queryKeys.players.settings,
        queryFn: () =>
            apiClient.get<ApiResponse<"/api/v1/players/me/settings", "get">>(
                "/players/me/settings",
            ),
        staleTime: 10 * 60 * 1000, // 10 minutes - settings don't change often
        gcTime: 15 * 60 * 1000,
        refetchOnWindowFocus: false,
    });
}

/**
 * Update the current user's settings.
 */
export function useUpdateSettings() {
    return useMutation({
        mutationFn: (
            data: ApiRequestBody<"/api/v1/players/me/settings", "patch">,
        ) => apiClient.patch<void>("/players/me/settings", data),
        onSuccess: () => {
            // Invalidate settings cache to refetch updated values
            queryClient.invalidateQueries({
                queryKey: queryKeys.players.settings,
            });
        },
    });
}
