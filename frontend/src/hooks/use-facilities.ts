/** React Query hooks for facilities data. */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useTickQuery } from "@/contexts/game-tick-context";
import { facilitiesApi } from "@/lib/api/facilities";
import { getAssetLongName } from "@/lib/assets/asset-names";
import { resolveErrorMessage } from "@/lib/game-messages";
import { queryKeys } from "@/lib/query-client";

/**
 * Hook to fetch all facilities for the current player. Facilities change every
 * tick (power output, state of charge, etc.)
 */
export function useFacilities() {
    // Register for tick-based invalidation since facilities show real-time data
    useTickQuery(queryKeys.facilities.all);

    return useQuery({
        queryKey: queryKeys.facilities.all,
        queryFn: facilitiesApi.getAll,
        staleTime: 60 * 1000, // 1 minute
    });
}

/**
 * Hook to fetch facility statuses (renewables, production, consumption).
 * Statuses change every tick as market conditions evolve.
 */
export function useFacilityStatuses() {
    // Register for tick-based invalidation since statuses reflect real-time market conditions
    useTickQuery(queryKeys.facilities.statuses);

    return useQuery({
        queryKey: queryKeys.facilities.statuses,
        queryFn: facilitiesApi.getStatuses,
        staleTime: 60 * 1000, // 1 minute
    });
}

/** Hook to upgrade a single facility. */
export function useUpgradeFacility() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: facilitiesApi.upgrade,
        onSuccess: () => {
            // Invalidate facilities and money queries after upgrade
            queryClient.invalidateQueries({
                queryKey: queryKeys.facilities.all,
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.players.money,
            });
            toast.success("Facility upgraded successfully");
        },
        onError: (error) => {
            toast.error(resolveErrorMessage(error));
        },
    });
}

/** Hook to upgrade all facilities of a type. */
export function useUpgradeAllOfType() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: facilitiesApi.upgradeAll,
        onSuccess: (_data, facilityType) => {
            // Invalidate facilities and money queries after mass upgrade
            queryClient.invalidateQueries({
                queryKey: queryKeys.facilities.all,
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.players.money,
            });
            toast.success(
                `All ${getAssetLongName(facilityType)} upgraded successfully`,
            );
        },
        onError: (error) => {
            toast.error(resolveErrorMessage(error));
        },
    });
}

/** Hook to dismantle a single facility. */
export function useDismantleFacility() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: facilitiesApi.dismantle,
        onSuccess: (data) => {
            // Invalidate facilities and money queries after dismantle
            queryClient.invalidateQueries({
                queryKey: queryKeys.facilities.all,
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.players.money,
            });
            toast.success(
                data.draining
                    ? "Storage facility will be dismantled once it is empty"
                    : "Facility dismantled successfully",
            );
        },
        onError: (error) => {
            toast.error(resolveErrorMessage(error));
        },
    });
}

/** Hook to dismantle all facilities of a type. */
export function useDismantleAllOfType() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: facilitiesApi.dismantleAll,
        onSuccess: (data, facilityType) => {
            // Invalidate facilities and money queries after mass dismantle
            queryClient.invalidateQueries({
                queryKey: queryKeys.facilities.all,
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.players.money,
            });
            toast.success(
                data.draining
                    ? `All ${getAssetLongName(facilityType)} facilities will be dismantled once empty`
                    : `All ${getAssetLongName(facilityType)} dismantled successfully`,
            );
        },
        onError: (error) => {
            toast.error(resolveErrorMessage(error));
        },
    });
}
