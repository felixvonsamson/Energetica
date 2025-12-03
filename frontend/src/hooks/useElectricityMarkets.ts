/** Hooks for fetching and managing electricity markets. */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { electricityMarketsApi } from "@/lib/electricity-markets-api";
import { queryKeys } from "@/lib/query-client";

/**
 * Get the list of existing electricity markets. This data changes when players
 * join or leave markets.
 */
export function useElectricityMarkets() {
    return useQuery({
        queryKey: queryKeys.electricityMarkets.all,
        queryFn: electricityMarketsApi.getAll,
        // Market list doesn't change very frequently
        staleTime: 60 * 1000, // 1 minute
        gcTime: 10 * 60 * 1000, // 10 minutes
        refetchOnWindowFocus: true,
    });
}

/** Join an electricity market. */
export function useJoinElectricityMarket() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: electricityMarketsApi.join,
        onSuccess: () => {
            // Invalidate the list of electricity markets
            queryClient.invalidateQueries({
                queryKey: queryKeys.electricityMarkets.all,
            });
            // Invalidate network data since player is now in a network
            queryClient.invalidateQueries({
                queryKey: queryKeys.network.all,
            });
        },
    });
}

/** Leave the current electricity market. */
export function useLeaveElectricityMarket() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: electricityMarketsApi.leave,
        onSuccess: () => {
            // Invalidate the list of electricity markets
            queryClient.invalidateQueries({
                queryKey: queryKeys.electricityMarkets.all,
            });
            // Invalidate network data since player is no longer in a network
            queryClient.invalidateQueries({
                queryKey: queryKeys.network.all,
            });
        },
    });
}

/** Create a new electricity market. */
export function useCreateElectricityMarket() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: electricityMarketsApi.create,
        onSuccess: () => {
            // Invalidate the list of electricity markets to show the new market
            queryClient.invalidateQueries({
                queryKey: queryKeys.electricityMarkets.all,
            });
            // Invalidate network data since a new network was created
            queryClient.invalidateQueries({
                queryKey: queryKeys.network.all,
            });
        },
    });
}

/** Update the asking prices and bid prices for the player's electricity market. */
export function useChangeElectricityMarketPrices() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: electricityMarketsApi.changePrices,
        onSuccess: () => {
            // Invalidate the electricity markets list to reflect price changes
            queryClient.invalidateQueries({
                queryKey: queryKeys.electricityMarkets.all,
            });
        },
    });
}
