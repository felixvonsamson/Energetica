/**
 * The authenticated account's runs, for the account menu's "Switch run" list:
 * the runs it plays (`runs`) and the runs it facilitates (`facilitated_runs`).
 *
 * Served by THIS instance's own backend (`GET /api/v1/lobby/my-runs`) off the
 * shared session cookie — same origin, no CORS — so the menu never talks
 * cross-origin to the lobby (ADR-0002).
 */

import { useQuery } from "@tanstack/react-query";

import { lobbyApi, type MyRunsResponse } from "@/lib/api/lobby";
import { queryKeys } from "@/lib/query-client";

export function useMyRuns() {
    return useQuery<MyRunsResponse>({
        queryKey: queryKeys.lobby.myRuns,
        queryFn: () => lobbyApi.myRuns(),
        // The set of runs changes rarely within a session; avoid refetching on every mount.
        staleTime: 60_000,
        // No polling interval: inside a run, nobody waits for this list to
        // change. But do refetch whenever the window regains focus, even
        // inside staleTime, so a run joined in another tab shows up when the
        // player comes back (#1280).
        refetchOnWindowFocus: "always",
    });
}
