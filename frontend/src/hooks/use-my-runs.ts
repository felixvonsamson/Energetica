/**
 * The authenticated account's settled runs, for the in-run switcher.
 *
 * Served by THIS instance's own backend (`GET /api/v1/lobby/my-runs`) off the
 * shared session cookie — same origin, no CORS — so the switcher never talks
 * cross-origin to the lobby (ADR-0002).
 */

import { useQuery } from "@tanstack/react-query";

import { lobbyApi, type MyRun } from "@/lib/api/lobby";
import { queryKeys } from "@/lib/query-client";

export function useMyRuns() {
    return useQuery<MyRun[]>({
        queryKey: queryKeys.lobby.myRuns,
        queryFn: async () => (await lobbyApi.myRuns()).runs,
        // The set of settled runs changes rarely within a session; avoid refetching on every mount.
        staleTime: 60_000,
    });
}
