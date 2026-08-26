/**
 * Hooks for the facilitator's join-link settings (#1020): the join token/link
 * and the "allow joining" toggle backing `/app/facilitator`.
 */

import { useMutation, useQuery } from "@tanstack/react-query";

import { facilitatorApi } from "@/lib/api/facilitator";
import { queryClient, queryKeys } from "@/lib/query-client";

/**
 * This instance's join-link settings. The first call generates the join token
 * server-side (persisted from then on), so simply mounting the facilitator page
 * is what "generates the link on first visit" (see #1020's acceptance
 * criteria).
 */
export function useFacilitatorAccess() {
    return useQuery({
        queryKey: queryKeys.facilitator.access,
        queryFn: facilitatorApi.getAccess,
        // A facilitator's own toggle changes drive updates via the mutation below;
        // there's no other writer of this instance's join settings to poll for.
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
    });
}

/**
 * Flip whether the join link currently admits new accounts.
 *
 * @example
 *     const { mutate: setJoinOpen } = useSetJoinOpen();
 *     setJoinOpen(true);
 */
export function useSetJoinOpen() {
    return useMutation({
        mutationFn: (joinOpen: boolean) =>
            facilitatorApi.updateAccess({ join_open: joinOpen }),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.facilitator.access,
            });
        },
    });
}
