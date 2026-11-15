/**
 * The kind of Run this instance is, so the app can tell when it is served on a
 * Workshop Run, which has its own app (#994, #995). It goes once each Instance
 * is served the app for its Run mode (#1181).
 */

import { queryOptions, useQuery } from "@tanstack/react-query";

import { runApi } from "@/lib/api/run";
import { queryKeys } from "@/lib/query-client";

/**
 * The query for this instance's Run. The mode is fixed for the life of the
 * backend process, so once fetched it is never refetched.
 */
const runQueryOptions = queryOptions({
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
