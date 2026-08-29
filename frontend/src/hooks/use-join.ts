/**
 * Hooks for the visitor-facing join flow (#1021): resolving a join token and
 * confirming membership, backing `/app/join/$token`.
 */

import { useMutation, useQuery } from "@tanstack/react-query";

import { joinApi } from "@/lib/api/join";
import { queryClient, queryKeys } from "@/lib/query-client";

/**
 * What this join link offers: the instance's name, whether it's currently
 * accepting new members, and — if the visitor already has an SSO session —
 * their username.
 */
export function useJoinLink(token: string) {
    return useQuery({
        queryKey: queryKeys.join.link(token),
        queryFn: () => joinApi.getLink(token),
        // Nothing else in this session writes this instance's join settings; the toggle only
        // ever changes from the facilitator's own page, in a different browser entirely.
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
    });
}

/**
 * Confirm joining: appends the visitor's username to the instance's allowlist.
 * Invalidates `auth.me` on success — the entry gate (`GET /auth/me`) now admits
 * this account, so the SPA's global auth state must re-resolve before the
 * caller navigates into the app.
 */
export function useConfirmJoin(token: string) {
    return useMutation({
        mutationFn: () => joinApi.confirm(token),
        onSuccess: async () => {
            void queryClient.invalidateQueries({
                queryKey: queryKeys.join.link(token),
            });
            await queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
        },
    });
}
