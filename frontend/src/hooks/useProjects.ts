/**
 * Hooks for fetching and managing construction/research projects.
 */

import { useQuery, useMutation } from "@tanstack/react-query";
import { projectsApi } from "@/lib/projects-api";
import { queryKeys, queryClient } from "@/lib/query-client";
import { useTickQuery } from "@/contexts/GameTickContext";

/**
 * Get all ongoing construction and research projects.
 * Updates every tick since projects progress over time.
 */
export function useProjects() {
    // Register for tick-based refetching (projects progress each tick)
    useTickQuery(queryKeys.projects.all);

    return useQuery({
        queryKey: queryKeys.projects.all,
        queryFn: projectsApi.getProjects,
        // Keep data fresh for the full tick duration (1 minute)
        staleTime: 60 * 1000,
        // Keep data in cache for 5 minutes
        gcTime: 5 * 60 * 1000,
        // Refetch on window focus
        refetchOnWindowFocus: true,
    });
}

/**
 * Get the catalog of all power facilities available for construction.
 * This data changes when technologies are researched.
 */
export function usePowerFacilitiesCatalog() {
    return useQuery({
        queryKey: queryKeys.projects.catalog.powerFacilities,
        queryFn: projectsApi.getPowerFacilitiesCatalog,
        // Power facilities catalog doesn't change often - only when tech is researched
        // We'll invalidate this manually when needed
        staleTime: 10 * 60 * 1000, // 10 minutes
        gcTime: 15 * 60 * 1000,
        refetchOnWindowFocus: false,
    });
}

/**
 * Queue a new construction or research project.
 */
export function useQueueProject() {
    return useMutation({
        mutationFn: projectsApi.queueProject,
        onSuccess: () => {
            // Invalidate projects list to show the new project
            queryClient.invalidateQueries({
                queryKey: queryKeys.projects.all,
            });
            // Also invalidate player money since construction costs money
            queryClient.invalidateQueries({
                queryKey: queryKeys.players.money,
            });
        },
    });
}

/**
 * Cancel an ongoing project.
 */
export function useCancelProject() {
    return useMutation({
        mutationFn: projectsApi.cancelProject,
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.projects.all,
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.players.money,
            });
        },
    });
}

/**
 * Pause an ongoing project.
 */
export function usePauseProject() {
    return useMutation({
        mutationFn: projectsApi.pauseProject,
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.projects.all,
            });
        },
    });
}

/**
 * Resume a paused project.
 */
export function useResumeProject() {
    return useMutation({
        mutationFn: projectsApi.resumeProject,
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.projects.all,
            });
        },
    });
}

/**
 * Decrease project priority in the queue.
 */
export function useDecreaseProjectPriority() {
    return useMutation({
        mutationFn: projectsApi.decreasePriority,
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.projects.all,
            });
        },
    });
}

/**
 * Increase project priority in the queue.
 */
export function useIncreaseProjectPriority() {
    return useMutation({
        mutationFn: projectsApi.increasePriority,
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.projects.all,
            });
        },
    });
}
