/** Hooks for fetching and managing resource market asks. */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { resourceMarketApi } from "@/lib/resource-market-api";
import { queryKeys } from "@/lib/query-client";

/**
 * Get all asks (resource listings) in the resource market. This data changes
 * frequently as players buy/sell resources.
 */
export function useResourceMarketAsks() {
    return useQuery({
        queryKey: queryKeys.resourceMarket.asks,
        queryFn: resourceMarketApi.getAsks,
        // Market data changes frequently, keep relatively fresh
        staleTime: 30 * 1000, // 30 seconds
        gcTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: true,
    });
}

/** Create a new ask (list resources for sale on the market). */
export function useCreateAsk() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: resourceMarketApi.createAsk,
        onSuccess: () => {
            // Invalidate market asks to show the new listing
            queryClient.invalidateQueries({
                queryKey: queryKeys.resourceMarket.asks,
            });
            // Invalidate player resources since we're listing resources
            queryClient.invalidateQueries({
                queryKey: queryKeys.players.resources,
            });
        },
    });
}

/** Purchase resources from an ask on the market. */
export function usePurchaseAsk() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: resourceMarketApi.purchaseAsk,
        onSuccess: () => {
            // Invalidate market asks to reflect the purchase
            queryClient.invalidateQueries({
                queryKey: queryKeys.resourceMarket.asks,
            });
            // Invalidate player money since purchases cost money
            queryClient.invalidateQueries({
                queryKey: queryKeys.players.money,
            });
            // Invalidate player resources since we're receiving resources
            queryClient.invalidateQueries({
                queryKey: queryKeys.players.resources,
            });
        },
    });
}

/** Update an existing ask (change price or quantity). */
export function useUpdateAsk() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: resourceMarketApi.updateAsk,
        onSuccess: () => {
            // Invalidate market asks to show updated listing
            queryClient.invalidateQueries({
                queryKey: queryKeys.resourceMarket.asks,
            });
            // May affect resources if quantity changed
            queryClient.invalidateQueries({
                queryKey: queryKeys.players.resources,
            });
        },
    });
}

/** Delete an ask (remove listing from the market). */
export function useDeleteAsk() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: resourceMarketApi.deleteAsk,
        onSuccess: () => {
            // Invalidate market asks to remove the listing
            queryClient.invalidateQueries({
                queryKey: queryKeys.resourceMarket.asks,
            });
            // Invalidate player resources since resources are returned
            queryClient.invalidateQueries({
                queryKey: queryKeys.players.resources,
            });
        },
    });
}

/** Calculate shipment time for a specific ask. */
export function useCalculateDeliveryTime(askId: number) {
    return useQuery({
        queryKey: queryKeys.resourceMarket.deliveryTime(askId),
        queryFn: () => resourceMarketApi.calculateDeliveryTime(askId),
        staleTime: 60 * 1000, // 1 minute
        gcTime: 5 * 60 * 1000, // 5 minutes
    });
}
