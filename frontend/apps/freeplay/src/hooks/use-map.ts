/** Hook for fetching the map data including all tiles and their resources. */

import { useQuery } from "@tanstack/react-query";

import { mapApi } from "@/lib/api/map";
import { queryKeys } from "@/lib/query-client";

export function useMap() {
    return useQuery({
        queryKey: queryKeys.map.all,
        queryFn: mapApi.getMap,
        // Map data doesn't change often (only when players settle)
        // Keep data fresh for 5 minutes
        staleTime: 5 * 60 * 1000,
        // Keep data in cache for 10 minutes
        gcTime: 10 * 60 * 1000,
        // Refetch on window focus to ensure ownership is current
        refetchOnWindowFocus: true,
    });
}
