/** Hooks for fetching and managing electricity markets. */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { electricityMarketsApi } from "@/lib/api/electricity-markets";
import { queryKeys } from "@/lib/query-client";
import { ElectricityMarket } from "@/types/electricity-markets";

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

/** Create a map of electricity market IDs to market names for quick lookup. */
export function useElectricityMarketMap() {
    const { data: marketsData } = useElectricityMarkets();

    return useMemo(() => {
        const map: Record<number, string> = {};
        if (marketsData) {
            marketsData.electricity_markets.forEach((market) => {
                map[market.id] = market.name;
            });
        }
        return map;
    }, [marketsData]);
}

/** Get a specific electricity market by ID. Returns null if not found. */
export function useElectricityMarket(marketId: number) {
    const { data: marketsData } = useElectricityMarkets();

    return useMemo(() => {
        return (
            marketsData?.electricity_markets.find((m) => m.id === marketId) ??
            null
        );
    }, [marketsData, marketId]);
}

function usePlayerToElectricityMarketMap() {
    const { data: marketsData } = useElectricityMarkets();

    return useMemo(() => {
        if (!marketsData) return undefined;
        const map: Record<number, ElectricityMarket> = {};
        marketsData.electricity_markets.forEach((market) => {
            market.member_ids.forEach((player_id) => {
                map[player_id] = market;
            });
        });
        return map;
    }, [marketsData]);
}

/** Given a player ID, returns the market they belong to, possibly null */
export function useElectricityMarketForPlayer(playerId: number | undefined) {
    const playerToElectricityMarketMap = usePlayerToElectricityMarketMap();

    if (playerId === undefined) return undefined;
    if (!playerToElectricityMarketMap) return undefined;
    if (!(playerId in playerToElectricityMarketMap)) return null;
    return playerToElectricityMarketMap[playerId];
}
