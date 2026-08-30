/**
 * Hooks for the facilitator roster page (#1022): the joined/invited split, the
 * add-control's account search, and the add/ban mutations.
 */

import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { facilitatorApi } from "@/lib/api/facilitator";
import { queryClient, queryKeys } from "@/lib/query-client";

/**
 * This instance's roster, split into joined vs invited-not-yet-joined.
 *
 * Polls on a real `refetchInterval` (#1033), not just a `staleTime` like most
 * other list-y hooks in this codebase — those rely on the query client's global
 * refetch-on-focus/mount to catch up, which never fires for a facilitator tab
 * that's sitting open and in the foreground while a roster change (another
 * facilitator's tab, or an invited account settling in) happens elsewhere. A
 * short interval is this page's own backstop until it moves onto push-based
 * updates (see the issue for why that's a bigger change than this hook alone).
 */
export function useFacilitatorRoster() {
    return useQuery({
        queryKey: queryKeys.facilitator.roster,
        queryFn: facilitatorApi.getRoster,
        staleTime: 5 * 1000, // 5 seconds, matched to refetchInterval below
        refetchInterval: 5 * 1000,
    });
}

/**
 * Existing accounts whose username starts with `prefix` — the add control's
 * lookup. Disabled while `prefix` is empty, matching the backend's
 * `min_length=1` on the same query.
 */
export function useRosterCandidates(prefix: string) {
    return useQuery({
        queryKey: queryKeys.facilitator.rosterCandidates(prefix),
        queryFn: () => facilitatorApi.searchRosterCandidates(prefix),
        enabled: prefix.length > 0,
    });
}

/**
 * Add an existing account to the roster; it shows up under "Invited" until the
 * account's own next entry provisions its local `User`.
 *
 * @example
 *     const { mutate: addToRoster } = useAddToRoster();
 *     addToRoster("carol");
 */
export function useAddToRoster() {
    return useMutation({
        mutationFn: (username: string) =>
            facilitatorApi.addToRoster({ username }),
        onSuccess: (_data, username) => {
            toast.success(`${username} added to the roster`);
            queryClient.invalidateQueries({
                queryKey: queryKeys.facilitator.roster,
            });
        },
    });
}

/**
 * Ban/remove a username from the roster. Revocation is eventual — it takes
 * effect on the account's next entry check, not an instant kick of a live
 * session (#677 if that's ever built).
 *
 * @example
 *     const { mutate: removeFromRoster } = useRemoveFromRoster();
 *     removeFromRoster("carol");
 */
export function useRemoveFromRoster() {
    return useMutation({
        mutationFn: (username: string) =>
            facilitatorApi.removeFromRoster(username),
        onSuccess: (_data, username) => {
            toast.success(`${username} removed from the roster`);
            queryClient.invalidateQueries({
                queryKey: queryKeys.facilitator.roster,
            });
        },
    });
}
