/**
 * The kind of Run this instance is, so the app can show the Workshop pages in a
 * Workshop Run instead of the persistent world's settle flow (#994, #995).
 */

import { useQuery } from "@tanstack/react-query";

import { runApi } from "@/lib/api/run";
import { queryKeys } from "@/lib/query-client";

/**
 * This instance's Run mode: `data` is `"freeplay"` or `"workshop"`.
 *
 * The mode is fixed for the life of the backend process, so once fetched it is
 * never refetched. A failed fetch is retried on the next mount, and shows as
 * `isError` rather than as a mode that never arrives.
 */
export function useRunMode() {
    return useQuery({
        queryKey: queryKeys.run,
        queryFn: runApi.get,
        select: (run) => run.mode,
        staleTime: Infinity,
        gcTime: Infinity,
        refetchOnWindowFocus: false,
    });
}
