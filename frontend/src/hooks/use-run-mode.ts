/**
 * The kind of Run this instance is, so the app can show the Workshop pages in a
 * Workshop Run instead of the persistent world's settle flow (#994, #995).
 */

import { queryOptions, useQuery } from "@tanstack/react-query";

import { runApi } from "@/lib/api/run";
import { queryKeys } from "@/lib/query-client";

/**
 * The query for this instance's Run, shared by {@link useRunMode} and the
 * `/app/` loader so both read one cache entry the same way.
 *
 * The mode is fixed for the life of the backend process, so once fetched it is
 * never refetched.
 */
export const runQueryOptions = queryOptions({
    queryKey: queryKeys.run,
    queryFn: runApi.get,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
});

/**
 * This instance's Run mode: `data` is `"freeplay"` or `"workshop"`.
 *
 * A failed fetch is retried on the next mount, and shows as `isError` rather
 * than as a mode that never arrives.
 */
export function useRunMode() {
    return useQuery({ ...runQueryOptions, select: (run) => run.mode });
}
