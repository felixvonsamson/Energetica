/**
 * Hook for fetching current weather data. Weather data changes every game tick
 * and includes season, temperature, wind, etc.
 */

import { useQuery } from "@tanstack/react-query";

import { useTickQuery } from "@/contexts/GameTickContext";
import { weatherApi } from "@/lib/api/weather";
import { queryKeys } from "@/lib/query-client";

export function useWeather() {
    // Register this query to be refetched on each game tick
    useTickQuery(queryKeys.weather.current);

    return useQuery({
        queryKey: queryKeys.weather.current,
        queryFn: weatherApi.getCurrent,
        // Keep data fresh for the full tick duration (1 minute)
        // This prevents unnecessary refetches between ticks
        staleTime: 60 * 1000,
        // Keep data in cache for 5 minutes even if not being used
        gcTime: 5 * 60 * 1000,
        // Refetch on window focus to ensure data is current
        refetchOnWindowFocus: true,
    });
}
