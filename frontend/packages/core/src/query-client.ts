/**
 * The query client factory every app starts from. Each app creates its own
 * client with it and owns its own query keys.
 *
 * Mutations are not retried by default. If a write reached the server but its
 * response was lost, a retry would apply the write twice. A mutation that is
 * safe to repeat, such as one that sets a value outright, opts in with `retry:
 * 1` on its own `useMutation` call.
 */

import {
    MutationCache,
    QueryClient,
    type QueryObserverOptions,
} from "@tanstack/react-query";

export interface CreateQueryClientOptions {
    /** Query defaults that replace the shared ones, key by key. */
    queries?: Partial<QueryObserverOptions>;
    /** Called once for every mutation that fails, after its own `onError`. */
    onMutationError?: (error: Error) => void;
}

/** Create a query client with the shared defaults. */
export function createQueryClient({
    queries,
    onMutationError,
}: CreateQueryClientOptions = {}): QueryClient {
    return new QueryClient({
        defaultOptions: {
            queries: {
                // Cache data for 5 minutes by default
                staleTime: 5 * 60 * 1000,
                // Keep unused data in cache for 10 minutes
                gcTime: 10 * 60 * 1000,
                // Retry failed requests - important for mobile users with spotty connections
                retry: (failureCount, error) => {
                    // Don't retry on 4xx errors (client errors)
                    if (error instanceof Error && "status" in error) {
                        const status = (error as unknown as { status: number })
                            .status;
                        if (status >= 400 && status < 500) return false;
                    }
                    // Retry up to 3 times for network errors
                    return failureCount < 3;
                },
                // Exponential backoff for retries (better for mobile)
                retryDelay: (attemptIndex) =>
                    Math.min(1000 * 2 ** attemptIndex, 30000),
                // Refetch on window focus for important data
                refetchOnWindowFocus: true,
                // Refetch on mount if data is stale
                refetchOnMount: true,
                // Refetch when connection restored
                refetchOnReconnect: true,
                // Network mode: 'online' = only fetch when online, keep stale data when offline
                networkMode: "online",
                ...queries,
            },
            mutations: {
                retry: false,
                networkMode: "online",
            },
        },
        mutationCache: new MutationCache({
            onError: (error) => onMutationError?.(error),
        }),
    });
}
