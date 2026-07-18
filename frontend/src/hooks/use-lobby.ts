/**
 * React Query hooks for the lobby bundle: the my-runs read (doubling as the
 * lobby's auth probe), the public instance manifest, and the credential
 * mutations against the lobby backend.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { lobbyApi, lobbyAuthApi, type MyRunsResponse } from "@/lib/api/lobby";
import { ApiClientError } from "@/lib/api-client";
import { fetchInstances, type InstanceFragment } from "@/lib/instances";
import { fetchRecap, RecapNotMintedError, type Recap } from "@/lib/recap";
import type { LoginRequest, SignupRequest } from "@/types/auth";

/**
 * Query keys local to the lobby bundle. Deliberately not part of the game's
 * `query-client.ts` registry: that registry exists for backend Socket.IO cache
 * invalidation, which the lobby has none of.
 */
export const lobbyQueryKeys = {
    myRuns: ["lobby", "my-runs"] as const,
    instances: ["lobby", "instances"] as const,
    recap: (slug: string) => ["lobby", "recap", slug] as const,
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
 * list — in dev there is no manifest and the picker simply shows no open runs.
 */
export function useInstancesManifest() {
    return useQuery<InstanceFragment[]>({
        queryKey: lobbyQueryKeys.instances,
        queryFn: ({ signal }) => fetchInstances(signal).catch(() => []),
    });
}

/**
 * A run's published recap (`/recaps/{slug}.json`). `data` is `null` while the
 * run hasn't reached `freeze` yet — {@link RecapNotMintedError} (a 404) is
 * swallowed rather than surfaced as a query error, since "not frozen yet" is an
 * expected, common state, not a failure. Other errors (network, malformed
 * payload) surface normally so the page can distinguish "not minted" from
 * "broken". (`null`, not `undefined`: React Query's `queryFn` must resolve to
 * a defined value.)
 */
export function useRecap(slug: string) {
    return useQuery<Recap | null>({
        queryKey: lobbyQueryKeys.recap(slug),
        queryFn: async ({ signal }) => {
            try {
                return await fetchRecap(slug, signal);
            } catch (error) {
                if (error instanceof RecapNotMintedError) return null;
                throw error;
            }
        },
    });
}

/** Mutation hook for lobby login; refreshes the my-runs auth probe. */
export function useLobbyLogin() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (credentials: LoginRequest) =>
            lobbyAuthApi.login(credentials),
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
        mutationFn: (data: SignupRequest) => lobbyAuthApi.signup(data),
        // Returned for the same navigate-after-await reason as useLobbyLogin.
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: lobbyQueryKeys.myRuns }),
    });
}

// Change-password has no hook: the account page submits it as a native <form> POST
// (see frontend/src/routes-lobby/account.tsx) so Safari/Apple Passwords detects the
// credential change (issue #849). It never goes through this fetch/React Query layer.

/** Mutation hook for global logout (clears the parent-domain cookie). */
export function useLobbyLogout() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            try {
                await lobbyAuthApi.logout();
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
            // would race the cookie deletion.
            queryClient.setQueryData(lobbyQueryKeys.myRuns, null);
        },
    });
}
