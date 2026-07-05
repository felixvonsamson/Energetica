/**
 * React Query hooks for the lobby bundle: the my-runs read (doubling as the
 * lobby's auth probe), the public instance manifest, and the credential
 * mutations against the lobby backend.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { authApi } from "@/lib/api/auth";
import { lobbyApi, type MyRunsResponse } from "@/lib/api/lobby";
import { ApiClientError } from "@/lib/api-client";
import { fetchInstances, type InstanceFragment } from "@/lib/instances";
import type { LoginRequest, SignupRequest } from "@/types/auth";

/**
 * Query keys local to the lobby bundle. Deliberately not part of the game's
 * `query-client.ts` registry: that registry exists for backend Socket.IO cache
 * invalidation, which the lobby has none of.
 */
export const lobbyQueryKeys = {
    myRuns: ["lobby", "my-runs"] as const,
    instances: ["lobby", "instances"] as const,
};

/**
 * The authenticated account's settled runs.
 *
 * Also the lobby's _auth probe_ — the lobby backend has no `/auth/me`, so
 * logged-in state is read off this endpoint: `data` is `null` when the session
 * cookie is absent or invalid (401 → logged out) and the runs payload when
 * logged in. Other errors (backend unreachable, 5xx) surface as query errors so
 * the picker can distinguish "logged out" from "broken".
 */
export function useMyRuns() {
    return useQuery<MyRunsResponse | null>({
        queryKey: lobbyQueryKeys.myRuns,
        queryFn: async () => {
            try {
                return await lobbyApi.myRuns();
            } catch (error) {
                if (error instanceof ApiClientError && error.status === 401) {
                    return null;
                }
                throw error;
            }
        },
    });
}

/**
 * The public instance manifest (`/instances.json`), Apache-aliased onto the
 * lobby origin from the shared landing dir. Errors degrade silently to an empty
 * list, mirroring the landing's `useAdvertisedInstances` — in dev there is no
 * manifest and the picker simply shows no open runs.
 */
export function useInstancesManifest() {
    return useQuery<InstanceFragment[]>({
        queryKey: lobbyQueryKeys.instances,
        queryFn: ({ signal }) => fetchInstances(signal).catch(() => []),
    });
}

/** Mutation hook for lobby login; refreshes the my-runs auth probe. */
export function useLobbyLogin() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (credentials: LoginRequest) => authApi.login(credentials),
        // Returned (not just fired) so mutateAsync resolves only after the
        // refetch: the forms navigate to the picker right after awaiting the
        // mutation, and a stale null (the pre-login 401 probe) would flash
        // the logged-out hero after a successful login.
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: lobbyQueryKeys.myRuns }),
    });
}

/** Mutation hook for lobby signup (account-only); auto-logs-in on success. */
export function useLobbySignup() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: SignupRequest) => authApi.signup(data),
        // Returned for the same navigate-after-await reason as useLobbyLogin.
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: lobbyQueryKeys.myRuns }),
    });
}

/** Mutation hook for global logout (clears the parent-domain cookie). */
export function useLobbyLogout() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            try {
                await authApi.logout();
            } catch (error) {
                // The lobby's logout route itself requires auth, so a session
                // that already expired (or was cleared by another tab) answers
                // 401 — which IS the desired end state; anything else (network,
                // 5xx) stays an error.
                if (
                    !(error instanceof ApiClientError && error.status === 401)
                ) {
                    throw error;
                }
            }
        },
        onSuccess: () => {
            // Mark as logged out directly instead of invalidating: a refetch
            // would race the cookie deletion (same reasoning as the game's
            // useLogout in use-auth-queries.ts).
            queryClient.setQueryData(lobbyQueryKeys.myRuns, null);
        },
    });
}
